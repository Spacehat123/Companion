"""
Body, Mouth, Hands & Legs Procedural Geometry and Animation State.
Handles:
- Rounded chibi robot body chassis with glowing chest core
- Expressive animated mouth (speaking flaps, smiles, gasps, smirks, annoyed lines)
- Hands with waving animation, idle floating, and music groove
- Feet with rhythmic tapping and bouncy idle steps
"""

import math
import time
from dataclasses import dataclass
from typing import Tuple


@dataclass
class BodyState:
    # Body tilt & bounce
    tilt_angle: float = 0.0       # Degrees tilt towards gaze
    bounce_y: float = 0.0         # Vertical music / walking bounce
    
    # Mouth state
    mouth_open: float = 0.0       # [0.0 = closed, 1.0 = wide open]
    mouth_curve: float = 0.4      # [-1.0 = frown, 0.0 = flat, 1.0 = big smile]
    mouth_width: float = 24.0
    mouth_style: str = "smile"    # smile, talking, annoyed, gasp, cheeky, flat
    
    # Left & Right Hands
    left_hand_x: float = 0.0
    left_hand_y: float = 0.0
    right_hand_x: float = 0.0
    right_hand_y: float = 0.0
    is_waving: bool = False
    
    # Left & Right Feet
    left_foot_y: float = 0.0
    right_foot_y: float = 0.0
    
    # Chest Core Glow
    core_pulse: float = 1.0
    
    # Cheek Blush Glow
    blush_intensity: float = 0.65


class BodyAnimator:
    """Calculates procedural physics for body, mouth, hands, and legs."""

    def __init__(self):
        self.state = BodyState()
        self.last_update = time.time()
        self.wave_until = 0.0

    def trigger_wave(self, duration: float = 2.5):
        """Make the right hand wave happily."""
        self.wave_until = time.time() + duration

    def update(
        self,
        gaze_x: float,
        gaze_y: float,
        expression: str,
        is_talking: bool,
        is_beat: bool,
        music_playing: bool,
    ) -> BodyState:
        now = time.time()
        dt = min(now - self.last_update, 0.1)
        self.last_update = now

        # 1. Subtle Body Tilt towards gaze (gives realistic weight and parallax)
        target_tilt = gaze_x * 4.5  # Max 4.5 degrees
        self.state.tilt_angle += (target_tilt - self.state.tilt_angle) * min(1.0, 8.0 * dt)

        # 2. Chest Core Glow Pulse & Blush
        self.state.core_pulse = 0.8 + 0.2 * math.sin(now * 3.5)
        if expression in ("happy", "perked_up"):
            self.state.blush_intensity = 0.95 + 0.05 * math.sin(now * 5.0)
        elif expression == "annoyed":
            self.state.blush_intensity = 0.2
        else:
            self.state.blush_intensity = 0.65 + 0.15 * math.sin(now * 2.0)

        # 3. Dynamic Mouth Animation
        if is_talking:
            # Flap mouth naturally while speaking
            self.state.mouth_style = "talking"
            self.state.mouth_open = 0.25 + 0.45 * abs(math.sin(now * 14.0))
            self.state.mouth_curve = 0.4
            self.state.mouth_width = 24.0 + 6.0 * math.sin(now * 8.0)
        elif expression == "annoyed":
            self.state.mouth_style = "annoyed"
            self.state.mouth_open = 0.05
            self.state.mouth_curve = -0.3
            self.state.mouth_width = 26.0
        elif expression == "camera_flash":
            # Excited open gasp
            self.state.mouth_style = "gasp"
            self.state.mouth_open = 0.75
            self.state.mouth_curve = 0.2
            self.state.mouth_width = 18.0
        elif expression in ("happy", "perked_up"):
            self.state.mouth_style = "smile"
            self.state.mouth_open = 0.35
            self.state.mouth_curve = 0.85
            self.state.mouth_width = 28.0
        elif expression == "cheeky":
            self.state.mouth_style = "cheeky"
            self.state.mouth_open = 0.2
            self.state.mouth_curve = 0.6
            self.state.mouth_width = 24.0
        else:
            # Neutral cute closed smile
            self.state.mouth_style = "smile"
            self.state.mouth_open = 0.08
            self.state.mouth_curve = 0.45
            self.state.mouth_width = 22.0

        # 4. Hands Animation (Idle float, music beat bounce, and waving)
        idle_hand_bob = math.sin(now * 2.5) * 3.5
        self.state.left_hand_x = 0.0
        self.state.left_hand_y = idle_hand_bob

        is_waving = now < self.wave_until or expression in ("happy", "perked_up")
        self.state.is_waving = is_waving

        if is_waving:
            # Right hand raised up to upper chest/shoulder level waving happily
            wave_angle = math.sin(now * 12.0)
            self.state.right_hand_x = 6.0 + wave_angle * 8.0
            self.state.right_hand_y = -44.0 + math.cos(now * 12.0) * 3.0
        else:
            # Resting beside hip with gentle idle bob
            self.state.right_hand_x = 0.0
            self.state.right_hand_y = math.sin(now * 2.5 + 0.8) * 3.5

        # 5. Feet / Legs Tapping (Music Beat & Idle Steps)
        if music_playing:
            # Alternating rhythmic feet tapping
            tap_freq = 6.0
            self.state.left_foot_y = max(0.0, math.sin(now * tap_freq) * 7.0)
            self.state.right_foot_y = max(0.0, math.sin(now * tap_freq + math.pi) * 7.0)
        else:
            # Subtle gentle breathing settle
            self.state.left_foot_y = math.sin(now * 1.8) * 1.5
            self.state.right_foot_y = math.sin(now * 1.8 + 0.4) * 1.5

        return self.state
