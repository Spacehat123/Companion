"""
Tamagotchi Life State Engine: Persistent Memory & Evolution.
Tracks attachment, energy, boredom, mood, and lifetime stats across sessions.
"""

import json
import os
import time
from dataclasses import asdict, dataclass
from typing import Dict, Any


@dataclass
class LifeData:
    attachment: float = 15.0       # [0.0 - 100.0]
    energy: float = 95.0           # [0.0 - 100.0]
    boredom: float = 10.0          # [0.0 - 100.0]
    mood: str = "CURIOUS"          # HAPPY, CURIOUS, GROOVY, SLEEPY, ALERT, WORRIED
    
    total_seconds_alive: float = 0.0
    interactions_count: int = 0
    music_tracks_controlled: int = 0
    notifications_seen: int = 0
    
    last_save_time: float = 0.0


class LifeEngine:
    def __init__(self, data_path: str = "/home/pranc/ai-companion/data/life_state.json"):
        self.data_path = data_path
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        self.data = self._load()
        self.last_tick = time.time()
        self.last_save_time = time.time()

    def _load(self) -> LifeData:
        if os.path.exists(self.data_path):
            try:
                with open(self.data_path, "r") as f:
                    raw = json.load(f)
                    return LifeData(**raw)
            except Exception as e:
                print(f"[LifeEngine] Error loading state, starting fresh: {e}")
        return LifeData(last_save_time=time.time())

    def save(self):
        try:
            self.data.last_save_time = time.time()
            with open(self.data_path, "w") as f:
                json.dump(asdict(self.data), f, indent=2)
        except Exception as e:
            print(f"[LifeEngine] Error saving state: {e}")

    def record_interaction(self, action_type: str):
        """Called when user touches controls, shakes, or engages."""
        self.data.interactions_count += 1
        self.data.boredom = max(0.0, self.data.boredom - 25.0)
        # Interacting with companion builds attachment
        self.data.attachment = min(100.0, self.data.attachment + 0.5)

        if action_type in ("PREV", "NEXT", "PLAY_PAUSE"):
            self.data.music_tracks_controlled += 1

        self.save()

    def record_notification(self):
        self.data.notifications_seen += 1
        self.data.boredom = max(0.0, self.data.boredom - 15.0)
        self.save()

    def update(self, face_present: bool, music_playing: bool) -> LifeData:
        now = time.time()
        dt = min(now - self.last_tick, 5.0)
        self.last_tick = now

        self.data.total_seconds_alive += dt

        # 1. Attachment builds naturally when user is in front of the device
        if face_present:
            # +1.0 attachment per 5 minutes of presence
            self.data.attachment = min(100.0, self.data.attachment + (dt / 300.0))
            self.data.boredom = max(0.0, self.data.boredom - (dt * 0.2))
        else:
            self.data.boredom = min(100.0, self.data.boredom + (dt * 0.05))

        # 2. Energy consumption: drops slowly over hours
        self.data.energy = max(0.0, self.data.energy - (dt / 360.0))

        # 3. Dynamic Mood evaluation
        if self.data.energy < 15.0:
            self.data.mood = "SLEEPY"
        elif music_playing:
            self.data.mood = "GROOVY"
        elif self.data.boredom > 75.0:
            self.data.mood = "BORED"
        elif face_present and self.data.attachment > 40.0:
            self.data.mood = "HAPPY"
        else:
            self.data.mood = "CURIOUS"

        # Autosave every 30 seconds
        if now - self.last_save_time > 30.0:
            self.save()
            self.last_save_time = now

        return self.data

    @property
    def relationship_tier(self) -> str:
        att = self.data.attachment
        if att < 20.0:
            return "Stranger 🌱"
        elif att < 40.0:
            return "Acquaintance 🌿"
        elif att < 70.0:
            return "Companion 🍀"
        elif att < 90.0:
            return "Best Friend ⭐"
        else:
            return "Soulmate 💖"
