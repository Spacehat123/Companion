"""
Controls Overlay & Morphing UI.
Manages the transformation of the character into media controls:
- Left hand: ⏮ Previous Track
- Center body: ⏯ Play / Pause
- Right hand: ⏭ Next Track
Includes hover detection, squish click animation, and auto-timeout.
"""

import math
import time
from typing import Callable, Optional, Tuple


class ControlButton:
    def __init__(self, name: str, icon: str, label: str):
        self.name = name
        self.icon = icon
        self.label = label
        self.rect = (0, 0, 0, 0)  # x, y, w, h
        self.is_hovered = False
        self.press_scale = 1.0
        self.last_press_time = 0.0

    def trigger_press(self):
        self.press_scale = 0.82
        self.last_press_time = time.time()

    def update(self):
        # Spring back to 1.0 scale
        if self.press_scale < 1.0:
            self.press_scale += (1.0 - self.press_scale) * 0.25
            if abs(1.0 - self.press_scale) < 0.01:
                self.press_scale = 1.0


class ControlsManager:
    """Manages the morphing transition between Face mode and Controls mode."""

    def __init__(self, on_action_callback: Optional[Callable[[str], None]] = None):
        self.active = False
        self.morph_progress = 0.0  # 0.0 = pure face, 1.0 = fully morphed controls
        self.target_morph = 0.0
        
        self.last_interaction_time = time.time()
        self.timeout_duration = 4.5  # Seconds before automatically morphing back to face
        self.on_action = on_action_callback
        
        # 3 control zones
        self.btn_prev = ControlButton("PREV", "⏮", "Previous")
        self.btn_play = ControlButton("PLAY_PAUSE", "⏯", "Play/Pause")
        self.btn_next = ControlButton("NEXT", "⏭", "Next")
        
        # Last triggered action text for visual feedback
        self.feedback_text = ""
        self.feedback_time = 0.0

    def trigger_shake(self):
        """Called when a shake is detected."""
        self.active = True
        self.target_morph = 1.0
        self.last_interaction_time = time.time()

    def dismiss(self):
        """Smoothly exit controls mode back to face mode."""
        self.active = False
        self.target_morph = 0.0

    def update(self, dt: float):
        # Auto-timeout if inactive
        now = time.time()
        if self.active and (now - self.last_interaction_time > self.timeout_duration):
            self.dismiss()

        # Smooth morph animation lerp
        lerp_speed = 10.0
        self.morph_progress += (self.target_morph - self.morph_progress) * min(1.0, lerp_speed * dt)

        # Update button spring physics
        self.btn_prev.update()
        self.btn_play.update()
        self.btn_next.update()

    def layout_buttons(self, cx: float, cy: float, size: float):
        """Update button bounding boxes based on current screen size."""
        # Left Hand (Prev)
        hand_w, hand_h = size * 0.22, size * 0.22
        body_w, body_h = size * 0.32, size * 0.32
        
        # Position left hand, center belly, right hand
        offset_x = size * 0.30
        offset_y = size * 0.15
        
        self.btn_prev.rect = (cx - offset_x - hand_w / 2, cy + offset_y - hand_h / 2, hand_w, hand_h)
        self.btn_play.rect = (cx - body_w / 2, cy + offset_y - body_h / 2, body_w, body_h)
        self.btn_next.rect = (cx + offset_x - hand_w / 2, cy + offset_y - hand_h / 2, hand_w, hand_h)

    def handle_mouse_move(self, x: float, y: float):
        """Check button hovers."""
        if self.morph_progress < 0.4:
            return

        def in_rect(btn):
            rx, ry, rw, rh = btn.rect
            return rx <= x <= rx + rw and ry <= y <= ry + rh

        self.btn_prev.is_hovered = in_rect(self.btn_prev)
        self.btn_play.is_hovered = in_rect(self.btn_play)
        self.btn_next.is_hovered = in_rect(self.btn_next)

    def handle_mouse_click(self, x: float, y: float) -> Optional[str]:
        """Trigger action if clicked inside a button zone."""
        if self.morph_progress < 0.5:
            return None

        self.last_interaction_time = time.time()

        for btn in [self.btn_prev, self.btn_play, self.btn_next]:
            rx, ry, rw, rh = btn.rect
            if rx <= x <= rx + rw and ry <= y <= ry + rh:
                btn.trigger_press()
                action_name = btn.name
                self.feedback_text = f"{btn.icon} {btn.label}"
                self.feedback_time = time.time()
                if self.on_action:
                    self.on_action(action_name)
                return action_name

        # Clicked background while in control mode -> dismiss back to face
        self.dismiss()
        return None
