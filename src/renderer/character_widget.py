"""
Full-Featured Character Widget with Expressions, Camera Flash, Speech Bubbles & Actions.
Demonstrates the full MVP loop:
- Perception (Face tracking, mic speech)
- Intent classification (6 classes)
- Action execution (Skip song, real camera photo, countdown timers)
- Template dialogue & dynamic expressions (Annoyed, Camera Flash, Happy, Confused, Perked Up)
- Basic Memory & Context (Song, Timer, Command history)
"""

import math
import sys
import time
from collections import deque
from typing import Optional

from PySide6.QtCore import QPointF, QRectF, Qt, QTimer, Signal
from PySide6.QtGui import (
    QBrush,
    QColor,
    QFont,
    QLinearGradient,
    QPainter,
    QPainterPath,
    QPen,
    QRadialGradient,
)
from PySide6.QtWidgets import QApplication, QWidget

from src.actions.action_executor import ActionExecutor
from src.intent.classifier import IntentClassifier, IntentResult
from src.memory.context_memory import CompanionMemory
from src.perception.audio_detector import AudioDetector
from src.perception.face_tracker import FaceTracker
from src.renderer.audio_sfx import CompanionSFX
from src.renderer.body_geometry import BodyAnimator
from src.renderer.controls_overlay import ControlsManager
from src.renderer.eye_geometry import EyeAnimator
from src.speech.voice_listener import VoiceListener
from src.templates.dialogue_engine import DialogueEngine, TemplateResponse


class CharacterWidget(QWidget):
    # Signals for thread-safe UI updates
    speech_received = Signal(str)
    person_status_changed = Signal(bool)

    def __init__(self, size: int = 380):
        super().__init__()
        self.setWindowTitle("Physical AI Companion — Laptop MVP")
        self.setFixedSize(size, size)

        # Frameless, transparent floating display
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setMouseTracking(True)

        # 1. Perception & Speech Engines
        self.face_tracker = FaceTracker(camera_index=0)
        self.audio_detector = AudioDetector()
        self.voice_listener = VoiceListener(on_text_callback=self._on_voice_text)

        # 2. Core Engines
        self.memory = CompanionMemory()
        self.action_executor = ActionExecutor(self.memory, frame_provider=self.face_tracker)
        self.intent_classifier = IntentClassifier()
        self.dialogue_engine = DialogueEngine()
        self.eye_animator = EyeAnimator()
        self.body_animator = BodyAnimator()
        self.controls_manager = ControlsManager(on_action_callback=self._handle_media_action)
        self.sfx = CompanionSFX()

        # Connect signals
        self.speech_received.connect(self.process_utterance)

        # Start background threads
        self.face_tracker.start()
        self.audio_detector.start()
        self.voice_listener.start()

        # 3. Dynamic Visual & Expression State
        self.current_expression = "neutral"
        self.expression_expires = 0.0
        self.speech_bubble_text = ""
        self.speech_bubble_expires = 0.0

        # Camera Flash Effect
        self.flash_opacity = 0.0

        # Person Presence Tracking
        self.was_person_detected = False

        # Dragging state
        self._drag_pos = None
        self._is_dragging = False
        self._mouse_history = deque(maxlen=15)

        # 60 FPS Animation Timer
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._game_loop)
        self.last_time = time.time()
        self.timer.start(16)

        # 1-second Clock for Timer Countdown
        self.clock_timer = QTimer(self)
        self.clock_timer.timeout.connect(self._timer_tick)
        self.clock_timer.start(1000)

        # Startup greet
        QTimer.singleShot(700, lambda: self.set_dialogue("Online & listening!", "happy"))

    def closeEvent(self, event):
        self.face_tracker.stop()
        self.audio_detector.stop()
        self.voice_listener.stop()
        self.memory.save()
        super().closeEvent(event)

    def _on_voice_text(self, text: str):
        # Dispatch to main Qt thread via signal
        self.speech_received.emit(text)

    def set_dialogue(self, text: str, expression: str = "neutral", duration: float = 3.5):
        self.speech_bubble_text = text
        self.speech_bubble_expires = time.time() + duration
        self.current_expression = expression
        self.expression_expires = time.time() + duration

        # Wave happily on greetings and cheerful expressions
        if expression in ("happy", "perked_up") or any(g in text.lower() for g in ["hi", "hello", "see you", "welcome", "friend"]):
            self.body_animator.trigger_wave(duration)

        if expression == "camera_flash":
            self.flash_opacity = 1.0
            self.sfx.play_click_pop()
        elif expression == "annoyed":
            self.sfx.play_worried_whimper()
        elif expression in ("happy", "perked_up"):
            self.sfx.play_happy_chirp()
        else:
            self.sfx.play_alert_ping()

    def process_phone_event(self, event):
        """Handle incoming phone simulation events (MESSAGE, CALL, TIMER, etc.)."""
        print(f"\n[Phone Event] Received: {event}")
        event_type = getattr(event, "event_type", "UNKNOWN")
        sender = getattr(event, "sender", "Phone")
        body = getattr(event, "body", "")

        if event_type == "MESSAGE":
            self.sfx.play_alert_ping()
            self.set_dialogue(f"{sender}: {body}", "perked_up", 3.8)
        elif event_type == "CALL":
            self.sfx.play_alert_ping()
            self.set_dialogue(f"Call from {sender}...", "attentive", 4.2)
        else:
            self.sfx.play_alert_ping()
            self.set_dialogue(f"{sender}: {body}", "curious", 3.0)

    def process_utterance(self, raw_input):
        """Core MVP loop: Text -> Intent Classifier -> Action Executor -> Template Response."""
        if hasattr(raw_input, "event_type"):
            return self.process_phone_event(raw_input)

        raw_text = str(raw_input)
        print(f"\n[MVP Input] User Utterance: \"{raw_text}\"")

        # 1. Classify Intent
        result: IntentResult = self.intent_classifier.classify(raw_text)
        print(f"[MVP Intent] Classified: {result.intent} (conf: {result.confidence:.2f})")

        # 2. Get Template Response
        template: TemplateResponse = self.dialogue_engine.get_response(result.intent, raw_text, result.params)

        # 3. Execute Real Action
        action_desc = "None"
        if result.intent == "NEXT_TRACK":
            action_desc = self.action_executor.execute_next_track()
        elif result.intent == "PREVIOUS_TRACK":
            action_desc = self.action_executor.execute_prev_track()
        elif result.intent == "TAKE_PHOTO":
            photo_path = self.action_executor.execute_take_photo()
            action_desc = f"Saved photo to {photo_path}"
        elif result.intent == "SET_TIMER":
            secs = result.params.get("seconds", 60)
            lbl = result.params.get("label", "1m")
            action_desc = self.action_executor.execute_set_timer(secs, lbl)

        # 4. Record to Memory
        self.memory.record_command(raw_text, result.intent, action_desc)

        # 5. Animate Character & Display Dialogue
        self.set_dialogue(template.text, template.expression, template.duration)

    def _timer_tick(self):
        """Updates active countdown timer every second."""
        if self.memory.timer.is_active:
            if self.memory.timer.remaining_seconds > 0:
                self.memory.timer.remaining_seconds -= 1
            else:
                # Timer Finished Alarm!
                self.memory.timer.is_active = False
                print("[Action: Timer] ⏱️ TIMER EXPIRED!")
                self.set_dialogue("Time is up! ⏰🔔", "camera_flash", duration=4.0)
                self.sfx.play_alert_ping()
                self.action_executor.send_system_notification("Companion Timer", "Your timer has finished!")

    def _handle_media_action(self, action: str):
        if action == "NEXT":
            self.process_utterance("skip this song")
        elif action == "PREV":
            self.process_utterance("previous song")
        elif action == "PLAY_PAUSE":
            self.memory.song.is_playing = not self.memory.song.is_playing
            state = "Playing" if self.memory.song.is_playing else "Paused"
            self.set_dialogue(f"Music {state} 🎵", "happy", 2.0)

    # --- Mouse & Keyboard Controls ---

    def trigger_shake(self):
        self.sfx.play_shake_woosh()
        self.controls_manager.trigger_shake()

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            x, y = event.position().x(), event.position().y()
            if self.controls_manager.morph_progress > 0.4:
                clicked = self.controls_manager.handle_mouse_click(x, y)
                if clicked:
                    self.update()
                    return

            self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            self._is_dragging = True

    def mouseMoveEvent(self, event):
        x, y = event.position().x(), event.position().y()
        w, h = self.width(), self.height()

        self.controls_manager.handle_mouse_move(x, y)

        if self._is_dragging and self._drag_pos is not None:
            self.move(event.globalPosition().toPoint() - self._drag_pos)
            return

        # Face/gaze tracking fallback to mouse if no camera face
        face_data = self.face_tracker.get_perception()
        if not face_data.face_detected and not self.controls_manager.active:
            norm_x = (x - w / 2) / (w / 2)
            norm_y = (y - h / 2) / (h / 2)
            self.eye_animator.set_target_gaze(norm_x * 0.85, norm_y * 0.85, user_directed=True)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self._is_dragging = False
            self._drag_pos = None

    def keyPressEvent(self, event):
        if event.key() in (Qt.Key.Key_Space, Qt.Key.Key_S):
            self.trigger_shake()
        elif event.key() == Qt.Key.Key_Escape:
            if self.controls_manager.active:
                self.controls_manager.dismiss()
            else:
                QApplication.quit()
        elif event.key() == Qt.Key.Key_Q:
            QApplication.quit()

    # --- Game Loop ---

    def _game_loop(self):
        now = time.time()
        dt = min(now - self.last_time, 0.1)
        self.last_time = now

        # 1. Camera Face & Gaze Tracking
        face = self.face_tracker.get_perception()

        # Check Person Arrival (Walk into camera view event)
        if face.face_detected and not self.was_person_detected:
            self.was_person_detected = True
            template = self.dialogue_engine.get_response("PERSON_DETECTED")
            self.set_dialogue(template.text, template.expression, template.duration)
        elif not face.face_detected:
            self.was_person_detected = False

        if face.face_detected and not self.controls_manager.active:
            self.eye_animator.set_target_gaze(face.gaze_x, face.gaze_y, user_directed=True)

        # 2. Camera Flash Fade
        if self.flash_opacity > 0.0:
            self.flash_opacity = max(0.0, self.flash_opacity - 5.0 * dt)

        # 3. Expression Expiration
        if now > self.expression_expires:
            self.current_expression = "neutral"

        # 4. Update Eye, Body & Controls Physics
        audio = self.audio_detector.get_perception()
        music_active = audio.energy > 0.15 or self.memory.song.is_playing
        is_talking = now < self.speech_bubble_expires

        self.eye_animator.update()
        self.body_animator.update(
            gaze_x=self.eye_animator.state.gaze_x,
            gaze_y=self.eye_animator.state.gaze_y,
            expression=self.current_expression,
            is_talking=is_talking,
            is_beat=audio.is_beat,
            music_playing=music_active,
        )
        self.controls_manager.update(dt)

        self.update()

    # --- Render Pipeline ---

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, True)

        w, h = self.width(), self.height()
        cx, cy = w / 2, h / 2

        # 1. Outer Bezel & OLED Screen
        self._draw_cube_bezel(p, w, h)

        # 2. Controls Layout
        self.controls_manager.layout_buttons(cx, cy, w)
        morph = self.controls_manager.morph_progress

        # 3. Draw Complete Living Character (Feet, Body, Core, Eyes, Mouth, Hands)
        if morph < 0.99:
            self._draw_character(p, cx, cy, w, h, opacity=1.0 - morph)

        # 4. Draw Morphing Controls
        if morph > 0.01:
            self._draw_controls(p, cx, cy, w, h, opacity=morph)

        # 5. Draw Speech Bubble / Template Dialogue
        now = time.time()
        if now < self.speech_bubble_expires and morph < 0.2:
            self._draw_speech_bubble(p, cx, h)

        # 6. Active Timer Banner
        if self.memory.timer.is_active:
            self._draw_timer_badge(p, cx)

        # 7. Camera Flash Overlay
        if self.flash_opacity > 0.01:
            p.setBrush(QColor(255, 255, 255, int(240 * self.flash_opacity)))
            p.setPen(Qt.PenStyle.NoPen)
            p.drawRoundedRect(QRectF(18, 18, w - 36, h - 36), 34, 34)

        # 8. Bottom Status
        if morph < 0.2 and now >= self.speech_bubble_expires:
            p.setPen(QColor(100, 116, 139, 220))
            p.setFont(QFont("Inter", 8, QFont.Weight.Medium))
            song_info = f"♪ {self.memory.song.title}"
            p.drawText(QRectF(0, h - 25, w, 18), Qt.AlignmentFlag.AlignCenter, song_info)

    def _draw_cube_bezel(self, p: QPainter, w: int, h: int):
        bezel_margin = 8
        bezel_rect = QRectF(bezel_margin, bezel_margin, w - bezel_margin * 2, h - bezel_margin * 2)
        corner_r = 44

        # Clean modern ceramic casing
        p.setPen(QPen(QColor(203, 213, 225, 230), 2.5))
        p.setBrush(QBrush(QColor(248, 250, 252, 255)))
        p.drawRoundedRect(bezel_rect, corner_r, corner_r)

        # Light OLED Active Screen Surface
        screen_m = 18
        screen_rect = QRectF(screen_m, screen_m, w - screen_m * 2, h - screen_m * 2)
        p.setPen(QPen(QColor(226, 232, 240, 220), 1.5))
        screen_grad = QLinearGradient(0, screen_m, 0, h - screen_m)
        screen_grad.setColorAt(0.0, QColor(255, 255, 255))
        screen_grad.setColorAt(1.0, QColor(241, 245, 249))
        p.setBrush(screen_grad)
        p.drawRoundedRect(screen_rect, corner_r - 8, corner_r - 8)

    def _draw_character(self, p: QPainter, cx: float, cy: float, w: float, h: float, opacity: float):
        """Renders the full living companion: feet, body chassis, belly patch, core, cheeks, eyes, mouth, and hands."""
        body_state = self.body_animator.state
        breath = self.eye_animator.state.breath_offset

        p.save()
        p.setOpacity(opacity)

        # Apply subtle body tilt towards gaze
        p.translate(cx, cy)
        p.rotate(body_state.tilt_angle)
        p.translate(-cx, -cy)

        # 1. Ear Caps / Headphone nubs (Sides of head)
        self._draw_ear_nubs(p, cx, cy, w, h, breath, opacity)

        # 2. Legs & Feet (Behind body)
        self._draw_feet(p, cx, cy, w, h, breath, opacity)

        # 3. Body Chassis (Torso)
        self._draw_body_chassis(p, cx, cy, w, h, breath, opacity)

        # 4. Belly Patch (Cute creamy rounded tummy)
        self._draw_belly_patch(p, cx, cy, w, h, breath, opacity)

        # 5. Chest Core / Heart Gem (Glowing life pulse)
        self._draw_chest_core(p, cx, cy, w, h, breath, opacity)

        # 6. Rosy Cheeks (Blush)
        self._draw_cheeks(p, cx, cy, w, h, breath, opacity)

        # 7. Eyes (Expressive gaze, glossy highlights, blinks)
        self._draw_eyes(p, cx, cy, w, h, breath, opacity)

        # 8. Expressive Mouth (Speaking flaps, smiles, gasps, smirks)
        self._draw_mouth(p, cx, cy, w, h, breath, opacity)

        # 9. Hands & Arms (Idle float, waving, music groove)
        self._draw_hands(p, cx, cy, w, h, breath, opacity)

        p.restore()

    def _draw_ear_nubs(self, p: QPainter, cx: float, cy: float, w: float, h: float, breath: float, opacity: float):
        body_w = w * 0.46
        body_h = h * 0.48
        body_cy = cy + 10 + breath
        ear_w, ear_h = 9.0, 24.0

        for is_left, ex in [(True, cx - body_w * 0.5 - ear_w + 3), (False, cx + body_w * 0.5 - 3)]:
            ey = body_cy - body_h * 0.12
            ear_rect = QRectF(ex, ey - ear_h / 2, ear_w, ear_h)

            # Golden amber cap
            p.setPen(QPen(QColor(217, 119, 6, int(220 * opacity)), 1.5))
            ear_grad = QLinearGradient(ex, ey - ear_h / 2, ex, ey + ear_h / 2)
            ear_grad.setColorAt(0.0, QColor(251, 191, 36))
            ear_grad.setColorAt(1.0, QColor(245, 158, 11))
            p.setBrush(ear_grad)
            p.drawRoundedRect(ear_rect, 4.5, 4.5)

            # Glowing mint center dot
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(16, 185, 129, int(220 * opacity)))
            p.drawEllipse(QPointF(ex + ear_w / 2, ey), 2.5, 2.5)

    def _draw_feet(self, p: QPainter, cx: float, cy: float, w: float, h: float, breath: float, opacity: float):
        body_w = w * 0.46
        body_h = h * 0.48
        body_cy = cy + 10 + breath
        foot_w = w * 0.13
        foot_h = h * 0.08
        base_y = body_cy + body_h * 0.5 - 2

        body_state = self.body_animator.state

        for is_left, foot_x, lift_y in [
            (True, cx - body_w * 0.25 - foot_w / 2, body_state.left_foot_y),
            (False, cx + body_w * 0.25 - foot_w / 2, body_state.right_foot_y),
        ]:
            fy = base_y - lift_y
            rect = QRectF(foot_x, fy, foot_w, foot_h)

            # Boot base: deep azure gradient
            p.setPen(QPen(QColor(3, 105, 161, int(220 * opacity)), 2))
            foot_grad = QLinearGradient(foot_x, fy, foot_x, fy + foot_h)
            foot_grad.setColorAt(0.0, QColor(2, 132, 199))
            foot_grad.setColorAt(1.0, QColor(3, 105, 161))
            p.setBrush(foot_grad)
            p.drawRoundedRect(rect, 10, 10)

            # Sole tread: crisp white with cyan trim
            p.setPen(QPen(QColor(255, 255, 255, int(240 * opacity)), 2.5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            p.drawLine(QPointF(foot_x + 6, fy + foot_h - 2.5), QPointF(foot_x + foot_w - 6, fy + foot_h - 2.5))

    def _draw_body_chassis(self, p: QPainter, cx: float, cy: float, w: float, h: float, breath: float, opacity: float):
        body_w = w * 0.46
        body_h = h * 0.48
        body_cy = cy + 10 + breath
        body_rect = QRectF(cx - body_w / 2, body_cy - body_h / 2, body_w, body_h)
        corner_r = 46

        # Soft ambient shadow underneath body on the light screen
        shadow_rad = body_w * 0.72
        shadow = QRadialGradient(cx, body_cy + body_h * 0.46, shadow_rad)
        shadow.setColorAt(0.0, QColor(148, 163, 184, int(70 * opacity)))
        shadow.setColorAt(0.7, QColor(203, 213, 225, int(25 * opacity)))
        shadow.setColorAt(1.0, QColor(0, 0, 0, 0))
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(shadow)
        p.drawEllipse(QPointF(cx, body_cy + body_h * 0.46), shadow_rad, shadow_rad * 0.32)

        # Body chassis fill: Cheerful, vibrant Sky-Blue gradient
        body_grad = QLinearGradient(cx, body_rect.top(), cx, body_rect.bottom())
        body_grad.setColorAt(0.0, QColor(56, 189, 248))   # Vibrant bright sky cyan
        body_grad.setColorAt(0.4, QColor(14, 165, 233))   # Electric rich sky blue
        body_grad.setColorAt(1.0, QColor(2, 132, 199))    # Deep royal cyan base

        p.setPen(QPen(QColor(3, 105, 161, int(230 * opacity)), 2.5))
        p.setBrush(body_grad)
        p.drawRoundedRect(body_rect, corner_r, corner_r)

        # Glossy curved head highlight arc
        p.setPen(QPen(QColor(255, 255, 255, int(150 * opacity)), 2.5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawArc(QRectF(cx - body_w * 0.32, body_cy - body_h * 0.45, body_w * 0.64, 20), 20 * 16, 140 * 16)

    def _draw_belly_patch(self, p: QPainter, cx: float, cy: float, w: float, h: float, breath: float, opacity: float):
        body_w = w * 0.46
        body_h = h * 0.48
        body_cy = cy + 12 + breath
        belly_w = body_w * 0.64
        belly_h = body_h * 0.36
        belly_cy = body_cy + body_h * 0.25
        belly_rect = QRectF(cx - belly_w / 2, belly_cy - belly_h / 2, belly_w, belly_h)

        # Soft warm creamy white belly patch
        belly_grad = QLinearGradient(cx, belly_rect.top(), cx, belly_rect.bottom())
        belly_grad.setColorAt(0.0, QColor(255, 255, 255, int(250 * opacity)))
        belly_grad.setColorAt(1.0, QColor(240, 249, 255, int(240 * opacity)))

        p.setPen(QPen(QColor(186, 230, 253, int(190 * opacity)), 1.5))
        p.setBrush(belly_grad)
        p.drawRoundedRect(belly_rect, 22, 22)

    def _draw_chest_core(self, p: QPainter, cx: float, cy: float, w: float, h: float, breath: float, opacity: float):
        body_h = h * 0.48
        body_cy = cy + 12 + breath
        gaze_x = self.eye_animator.state.gaze_x
        core_cx = cx + gaze_x * 2.0
        core_cy = body_cy + body_h * 0.25

        pulse = self.body_animator.state.core_pulse
        core_w, core_h = 22.0 * pulse, 12.0 * pulse
        core_rect = QRectF(core_cx - core_w / 2, core_cy - core_h / 2, core_w, core_h)

        # Glowing rosy pulse
        glow = QRadialGradient(core_cx, core_cy, 18.0 * pulse)
        glow.setColorAt(0.0, QColor(255, 107, 139, int(150 * opacity)))
        glow.setColorAt(0.7, QColor(244, 63, 94, int(40 * opacity)))
        glow.setColorAt(1.0, QColor(0, 0, 0, 0))
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(glow)
        p.drawEllipse(QPointF(core_cx, core_cy), 18.0 * pulse, 18.0 * pulse)

        # Core pill: vibrant rosy ruby
        core_grad = QLinearGradient(core_rect.left(), core_rect.top(), core_rect.right(), core_rect.bottom())
        core_grad.setColorAt(0.0, QColor(255, 107, 139))
        core_grad.setColorAt(1.0, QColor(244, 63, 94))
        p.setPen(QPen(QColor(255, 255, 255, int(210 * opacity)), 1.5))
        p.setBrush(core_grad)
        p.drawRoundedRect(core_rect, 6.0, 6.0)

        # Specular glint
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(255, 255, 255, int(240 * opacity)))
        p.drawEllipse(QPointF(core_cx - 3, core_cy - 2), 2.0, 2.0)

    def _draw_cheeks(self, p: QPainter, cx: float, cy: float, w: float, h: float, breath: float, opacity: float):
        state = self.eye_animator.state
        body_h = h * 0.48
        body_cy = cy + 12 + breath
        eye_w = w * 0.125
        eye_spacing = w * 0.10
        max_gaze = eye_w * 0.40
        gaze_x = state.gaze_x * max_gaze
        eye_cy = body_cy - body_h * 0.20 + state.gaze_y * (max_gaze * 0.6)

        left_cx = cx - eye_spacing - (eye_w / 2) + gaze_x
        right_cx = cx + eye_spacing + (eye_w / 2) + gaze_x
        cheek_y = eye_cy + (h * 0.17) * 0.46

        cw, ch = 16.0, 8.5
        blush_alpha = int(210 * self.body_animator.state.blush_intensity * opacity)

        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(251, 113, 133, blush_alpha))
        p.drawEllipse(QRectF(left_cx - cw / 2 - 3, cheek_y - ch / 2, cw, ch))
        p.drawEllipse(QRectF(right_cx - cw / 2 + 3, cheek_y - ch / 2, cw, ch))

    def _draw_eyes(self, p: QPainter, cx: float, cy: float, w: float, h: float, breath: float, opacity: float):
        state = self.eye_animator.state
        expr = self.current_expression

        eye_w = w * 0.125
        eye_h = h * 0.17
        eye_spacing = w * 0.10

        if expr == "annoyed":
            eye_h *= 0.5
        elif expr in ("happy", "perked_up"):
            eye_h *= 1.12

        max_gaze = eye_w * 0.40
        gaze_x = state.gaze_x * max_gaze
        gaze_y = state.gaze_y * (max_gaze * 0.6)

        body_h = h * 0.48
        body_cy = cy + 12 + breath
        eye_cy = body_cy - body_h * 0.20 + gaze_y

        left_cx = cx - eye_spacing - (eye_w / 2) + gaze_x
        right_cx = cx + eye_spacing + (eye_w / 2) + gaze_x

        for eye_x, openness in [(left_cx, state.openness_left), (right_cx, state.openness_right)]:
            curr_h = max(3.0, eye_h * openness)
            y_top = eye_cy - (curr_h / 2)
            eye_rect = QRectF(eye_x - eye_w / 2, y_top, eye_w, curr_h)
            corner_r = min(eye_w, curr_h) / 2

            # Cute joyful crescent eyes ^ ^
            if expr == "happy" and openness > 0.4:
                path = QPainterPath()
                path.moveTo(eye_x - eye_w * 0.42, eye_cy + 2)
                path.quadTo(eye_x, eye_cy - 10, eye_x + eye_w * 0.42, eye_cy + 2)
                p.setPen(QPen(QColor(15, 23, 42, int(240 * opacity)), 3.2, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
                p.setBrush(Qt.BrushStyle.NoBrush)
                p.drawPath(path)
                continue

            # Deep glossy sapphire iris
            eye_grad = QLinearGradient(eye_rect.left(), eye_rect.top(), eye_rect.left(), eye_rect.bottom())
            if expr == "annoyed":
                eye_grad.setColorAt(0.0, QColor(30, 41, 59))
                eye_grad.setColorAt(1.0, QColor(239, 68, 68))
            elif expr == "confused":
                eye_grad.setColorAt(0.0, QColor(15, 23, 42))
                eye_grad.setColorAt(1.0, QColor(139, 92, 246))
            else:
                eye_grad.setColorAt(0.0, QColor(15, 23, 42))
                eye_grad.setColorAt(1.0, QColor(30, 58, 138))

            p.setPen(QPen(QColor(14, 165, 233, int(220 * opacity)), 1.5))
            p.setBrush(eye_grad)
            p.drawRoundedRect(eye_rect, corner_r, corner_r)

            # Specular sparkle glints (creates soul and Pixar charm!)
            if openness > 0.4 and expr != "annoyed":
                # Primary reflection highlight (top-left)
                p.setPen(Qt.PenStyle.NoPen)
                p.setBrush(QColor(255, 255, 255, int(250 * opacity)))
                p.drawEllipse(QPointF(eye_x - eye_w * 0.20, eye_cy - curr_h * 0.20), 3.5, 3.5)

                # Secondary reflection sparkle (bottom-right)
                p.drawEllipse(QPointF(eye_x + eye_w * 0.18, eye_cy + curr_h * 0.16), 1.8, 1.8)

    def _draw_mouth(self, p: QPainter, cx: float, cy: float, w: float, h: float, breath: float, opacity: float):
        body_state = self.body_animator.state
        gaze_x = self.eye_animator.state.gaze_x
        body_h = h * 0.48
        body_cy = cy + 12 + breath
        eye_cy = body_cy - body_h * 0.20

        mouth_cx = cx + gaze_x * 2.5
        mouth_cy = eye_cy + (h * 0.17) * 0.46 + 4

        style = body_state.mouth_style
        mw = body_state.mouth_width

        if style == "talking":
            # Animated open mouth cavity with pink tongue
            mh = max(4.5, 12.0 * body_state.mouth_open)
            mouth_rect = QRectF(mouth_cx - mw / 2, mouth_cy - mh / 2, mw, mh)

            # Deep cherry cavity
            p.setPen(QPen(QColor(225, 29, 72, int(240 * opacity)), 1.8))
            p.setBrush(QBrush(QColor(136, 19, 55, int(240 * opacity))))
            p.drawRoundedRect(mouth_rect, mh / 2, mh / 2)

            # Soft pink tongue
            tongue_rect = QRectF(mouth_cx - mw * 0.28, mouth_cy + mh * 0.08, mw * 0.56, mh * 0.45)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(253, 164, 175, int(230 * opacity)))
            p.drawRoundedRect(tongue_rect, 2.5, 2.5)

        elif style == "gasp":
            # Round surprised "O"
            mouth_rect = QRectF(mouth_cx - 5.5, mouth_cy - 6.5, 11, 13)
            p.setPen(QPen(QColor(225, 29, 72, int(240 * opacity)), 2))
            p.setBrush(QBrush(QColor(136, 19, 55, int(240 * opacity))))
            p.drawEllipse(mouth_rect)

        elif style == "annoyed":
            # Flat downturned pout line
            p.setPen(QPen(QColor(239, 68, 68, int(240 * opacity)), 2.5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            p.drawLine(QPointF(mouth_cx - mw / 2, mouth_cy + 1), QPointF(mouth_cx + mw / 2, mouth_cy + 1))

        elif style == "cheeky":
            # Asymmetrical smirk
            path = QPainterPath()
            path.moveTo(mouth_cx - mw * 0.4, mouth_cy + 1)
            path.quadTo(mouth_cx, mouth_cy + 4, mouth_cx + mw * 0.5, mouth_cy - 3)
            p.setPen(QPen(QColor(225, 29, 72, int(240 * opacity)), 2.5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.drawPath(path)

        else:
            # Cute cheerful curved smile
            curve_depth = 5.0 * body_state.mouth_curve
            path = QPainterPath()
            path.moveTo(mouth_cx - mw / 2, mouth_cy - 2)
            path.quadTo(mouth_cx, mouth_cy + curve_depth, mouth_cx + mw / 2, mouth_cy - 2)
            p.setPen(QPen(QColor(225, 29, 72, int(240 * opacity)), 2.2, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.drawPath(path)

    def _draw_hands(self, p: QPainter, cx: float, cy: float, w: float, h: float, breath: float, opacity: float):
        body_w = w * 0.46
        body_h = h * 0.48
        body_cy = cy + 12 + breath
        hand_w = w * 0.09
        hand_h = h * 0.12

        body_state = self.body_animator.state

        # Left Hand (Beside left hip, rounded pill mitten)
        lx = cx - body_w * 0.54 - hand_w * 0.45 + body_state.left_hand_x
        ly = body_cy + body_h * 0.16 + body_state.left_hand_y
        left_rect = QRectF(lx - hand_w / 2, ly - hand_h / 2, hand_w, hand_h)

        p.setPen(QPen(QColor(3, 105, 161, int(220 * opacity)), 2))
        hand_grad = QLinearGradient(lx, ly - hand_h / 2, lx, ly + hand_h / 2)
        hand_grad.setColorAt(0.0, QColor(56, 189, 248))
        hand_grad.setColorAt(1.0, QColor(2, 132, 199))
        p.setBrush(hand_grad)
        p.drawRoundedRect(left_rect, hand_w / 2, hand_w / 2)

        # Left Hand Palm Pad
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(255, 255, 255, int(240 * opacity)))
        p.drawEllipse(QPointF(lx, ly), 4.5, 4.5)
        p.setBrush(QColor(251, 113, 133, int(200 * opacity)))
        p.drawEllipse(QPointF(lx, ly), 2.0, 2.0)

        # Right Hand (Waving or resting beside right hip)
        rx = cx + body_w * 0.54 + hand_w * 0.45 + body_state.right_hand_x
        ry = body_cy + body_h * 0.16 + body_state.right_hand_y

        p.save()
        if body_state.is_waving:
            now = time.time()
            wave_rot = math.sin(now * 12.0) * 22.0
            p.translate(rx, ry)
            p.rotate(wave_rot)
            p.translate(-rx, -ry)

        right_rect = QRectF(rx - hand_w / 2, ry - hand_h / 2, hand_w, hand_h)
        p.setPen(QPen(QColor(3, 105, 161, int(220 * opacity)), 2))
        p.setBrush(hand_grad)
        p.drawRoundedRect(right_rect, hand_w / 2, hand_w / 2)

        # Right Hand Palm Pad
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(255, 255, 255, int(240 * opacity)))
        p.drawEllipse(QPointF(rx, ry), 4.5, 4.5)
        p.setBrush(QColor(251, 113, 133, int(200 * opacity)))
        p.drawEllipse(QPointF(rx, ry), 2.0, 2.0)

        p.restore()

    def _draw_controls(self, p: QPainter, cx: float, cy: float, w: float, h: float, opacity: float):
        p.save()
        p.setOpacity(opacity)
        mgr = self.controls_manager

        p.setPen(QColor(2, 132, 199, int(230 * opacity)))
        p.setFont(QFont("Inter", 10, QFont.Weight.Bold))
        p.drawText(QRectF(0, cy - h * 0.30, w, 24), Qt.AlignmentFlag.AlignCenter, "MUSIC CONTROLS")

        for btn in [mgr.btn_prev, mgr.btn_play, mgr.btn_next]:
            rx, ry, rw, rh = btn.rect
            scale = btn.press_scale
            bx, by = rx + rw / 2, ry + rh / 2
            sw, sh = rw * scale, rh * scale
            draw_rect = QRectF(bx - sw / 2, by - sh / 2, sw, sh)
            corner_r = sw / 2 if btn.name == "PLAY_PAUSE" else 18

            if btn.is_hovered:
                p.setBrush(QColor(238, 246, 255, 255))
                p.setPen(QPen(QColor(14, 165, 233), 2))
            else:
                p.setBrush(QColor(255, 255, 255, 245))
                p.setPen(QPen(QColor(203, 213, 225), 1.5))

            p.drawRoundedRect(draw_rect, corner_r, corner_r)
            p.setPen(QColor(15, 23, 42, 240))
            p.setFont(QFont("Inter", 16 if btn.name == "PLAY_PAUSE" else 14, QFont.Weight.Bold))
            p.drawText(draw_rect, Qt.AlignmentFlag.AlignCenter, btn.icon)

        p.restore()

    def _draw_speech_bubble(self, p: QPainter, cx: float, h: float):
        """Draws template personality dialogue bubble in clean light theme."""
        p.save()
        bubble_w, bubble_h = 280, 42
        rect = QRectF(cx - bubble_w / 2, 32, bubble_w, bubble_h)

        # Subtle shadow
        shadow_rect = QRectF(cx - bubble_w / 2 + 1, 34, bubble_w, bubble_h)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(148, 163, 184, 70))
        p.drawRoundedRect(shadow_rect, 21, 21)

        # Bubble card
        p.setPen(QPen(QColor(14, 165, 233), 2))
        p.setBrush(QBrush(QColor(255, 255, 255, 250)))
        p.drawRoundedRect(rect, 21, 21)

        p.setPen(QColor(15, 23, 42, 255))
        p.setFont(QFont("Inter", 9, QFont.Weight.DemiBold))
        p.drawText(rect, Qt.AlignmentFlag.AlignCenter, self.speech_bubble_text)
        p.restore()

    def _draw_timer_badge(self, p: QPainter, cx: float):
        """Displays active countdown timer in light theme."""
        p.save()
        rem = self.memory.timer.remaining_seconds
        mins, secs = divmod(rem, 60)
        time_str = f"Timer {mins:02d}:{secs:02d}"

        badge_rect = QRectF(cx - 55, 36, 110, 28)
        p.setPen(QPen(QColor(249, 115, 22), 2))
        p.setBrush(QBrush(QColor(255, 247, 237, 250)))
        p.drawRoundedRect(badge_rect, 14, 14)

        p.setPen(QColor(194, 65, 12, 255))
        p.setFont(QFont("Inter", 10, QFont.Weight.Bold))
        p.drawText(badge_rect, Qt.AlignmentFlag.AlignCenter, time_str)
        p.restore()
