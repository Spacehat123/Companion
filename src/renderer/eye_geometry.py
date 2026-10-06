"""
Procedural Eye & Face geometry and animation state.
Handles eye positions, pupil gaze tracking with spring damping,
blinking, saccades, squinting, and breathing.
"""

import math
import random
import time
from dataclasses import dataclass
from typing import Tuple


@dataclass
class EyeState:
    # Normalized positions [-1.0, 1.0]
    gaze_x: float = 0.0
    gaze_y: float = 0.0
    target_gaze_x: float = 0.0
    target_gaze_y: float = 0.0
    
    # Eye openness [0.0 = fully closed, 1.0 = fully open]
    openness_left: float = 1.0
    openness_right: float = 1.0
    
    # Eye shape mods
    squint: float = 0.0      # [0.0, 1.0]
    happy_curve: float = 0.0 # [0.0, 1.0] (crescent happy eyes)
    surprise: float = 0.0    # [0.0, 1.0] (dilated, wide open)
    
    # Saccade / micro-jitter
    jitter_x: float = 0.0
    jitter_y: float = 0.0
    
    # Breathing offset
    breath_offset: float = 0.0


class EyeAnimator:
    """Manages procedural physics and micro-behaviors for character eyes."""

    def __init__(self):
        # Physics damping
        self.gaze_speed = 12.0  # Spring lerp speed
        
        # Blink state
        self.is_blinking = False
        self.blink_start = 0.0
        self.blink_duration = 0.15
        self.next_blink_time = time.time() + random.uniform(2.5, 5.0)
        
        # Saccade state
        self.next_saccade_time = time.time() + random.uniform(1.0, 3.0)
        
        # Autonomous idle wandering (when not tracking target)
        self.autonomous_look = True
        self.next_wander_time = time.time() + 2.0
        
        self.state = EyeState()
        self.last_update = time.time()

    def set_target_gaze(self, x: float, y: float, user_directed: bool = True):
        """Set target gaze in normalized [-1.0, 1.0] space."""
        # Clamp to circle
        dist = math.hypot(x, y)
        if dist > 1.0:
            x /= dist
            y /= dist
            
        self.state.target_gaze_x = x
        self.state.target_gaze_y = y
        if user_directed:
            self.autonomous_look = False
            self.next_wander_time = time.time() + 4.0  # Resume wandering after 4s idle

    def update(self) -> EyeState:
        """Advance animation by dt and return updated EyeState."""
        now = time.time()
        dt = min(now - self.last_update, 0.1)
        self.last_update = now

        # 1. Autonomous gaze wandering if user isn't interacting
        if not self.autonomous_look and now > self.next_wander_time:
            self.autonomous_look = True

        if self.autonomous_look and now > self.next_wander_time:
            # Pick a natural glance
            angle = random.uniform(0, 2 * math.pi)
            magnitude = random.choice([0.0, 0.2, 0.45, 0.7])
            self.state.target_gaze_x = math.cos(angle) * magnitude
            self.state.target_gaze_y = math.sin(angle) * magnitude * 0.7  # Less vertical range
            self.next_wander_time = now + random.uniform(1.5, 4.5)

        # 2. Saccades (tiny micro-movements human/animal eyes do)
        if now > self.next_saccade_time:
            self.state.jitter_x = random.uniform(-0.04, 0.04)
            self.state.jitter_y = random.uniform(-0.03, 0.03)
            self.next_saccade_time = now + random.uniform(0.4, 1.8)

        # 3. Smooth Damped Spring Lerp towards target gaze
        lerp_factor = 1.0 - math.exp(-self.gaze_speed * dt)
        target_x = self.state.target_gaze_x + self.state.jitter_x
        target_y = self.state.target_gaze_y + self.state.jitter_y
        self.state.gaze_x += (target_x - self.state.gaze_x) * lerp_factor
        self.state.gaze_y += (target_y - self.state.gaze_y) * lerp_factor

        # 4. Realistic Blinking
        if not self.is_blinking and now > self.next_blink_time:
            self.is_blinking = True
            self.blink_start = now
            # Double blink chance (20%)
            if random.random() < 0.2:
                self.next_blink_time = now + random.uniform(0.25, 0.4)
            else:
                self.next_blink_time = now + random.uniform(3.0, 6.0)

        if self.is_blinking:
            progress = (now - self.blink_start) / self.blink_duration
            if progress >= 1.0:
                self.is_blinking = False
                self.state.openness_left = 1.0
                self.state.openness_right = 1.0
            else:
                # Sine curve for natural blink: fast close, smooth open
                blink_val = math.sin(progress * math.pi)
                openness = max(0.02, 1.0 - blink_val)
                self.state.openness_left = openness
                self.state.openness_right = openness
        else:
            self.state.openness_left = 1.0
            self.state.openness_right = 1.0

        # 5. Breathing oscillation
        self.state.breath_offset = math.sin(now * 1.8) * 2.5

        return self.state
