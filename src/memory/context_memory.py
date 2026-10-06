"""
Context & Basic Memory Engine for Physical AI Companion.
Maintains:
- Current song & playlist state
- Recent command history
- Active countdown timer state
- Conversation turn context
- User persistent preferences
"""

import json
import os
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from typing import Any, Deque, Dict, List, Optional


@dataclass
class SongState:
    title: str = "Around the World"
    artist: str = "Daft Punk"
    is_playing: bool = True
    index: int = 0


DEFAULT_PLAYLIST = [
    {"title": "Around the World", "artist": "Daft Punk"},
    {"title": "Midnight City", "artist": "M83"},
    {"title": "Starboy", "artist": "The Weeknd"},
    {"title": "Resonance", "artist": "HOME"},
    {"title": "Get Lucky", "artist": "Daft Punk ft. Pharrell"},
]


@dataclass
class TimerState:
    is_active: bool = False
    remaining_seconds: int = 0
    total_seconds: int = 0
    label: str = ""
    started_at: float = 0.0


class CompanionMemory:
    def __init__(self, storage_path: str = "/home/pranc/ai-companion/data/companion_memory.json"):
        self.storage_path = storage_path
        os.makedirs(os.path.dirname(storage_path), exist_ok=True)

        self.playlist = list(DEFAULT_PLAYLIST)
        self.song = SongState()
        self.timer = TimerState()
        self.recent_commands: Deque[Dict[str, Any]] = deque(maxlen=10)
        self.conversation_context: Dict[str, Any] = {
            "last_user_utterance": "",
            "last_reply": "",
            "turn_count": 0,
        }
        self.preferences: Dict[str, Any] = {
            "user_name": "Friend",
            "volume": 80,
            "theme": "cyan_glow",
        }

        self.load()

    def load(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r") as f:
                    data = json.load(f)
                    pref = data.get("preferences", {})
                    self.preferences.update(pref)
                    song_idx = data.get("current_song_index", 0)
                    self.set_song_by_index(song_idx)
            except Exception as e:
                print(f"[Memory] Failed to load memory file: {e}")

    def save(self):
        try:
            data = {
                "preferences": self.preferences,
                "current_song_index": self.song.index,
                "recent_commands": list(self.recent_commands),
            }
            with open(self.storage_path, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[Memory] Failed to save memory: {e}")

    def record_command(self, raw_text: str, intent: str, action_taken: str):
        record = {
            "timestamp": time.time(),
            "raw_text": raw_text,
            "intent": intent,
            "action": action_taken,
        }
        self.recent_commands.appendleft(record)
        self.save()

    def set_song_by_index(self, index: int):
        self.song.index = index % len(self.playlist)
        track = self.playlist[self.song.index]
        self.song.title = track["title"]
        self.song.artist = track["artist"]

    def next_song(self) -> SongState:
        self.set_song_by_index(self.song.index + 1)
        self.song.is_playing = True
        self.save()
        return self.song

    def prev_song(self) -> SongState:
        self.set_song_by_index(self.song.index - 1)
        self.song.is_playing = True
        self.save()
        return self.song

    def start_timer(self, seconds: int, label: str = "Timer"):
        self.timer.is_active = True
        self.timer.remaining_seconds = seconds
        self.timer.total_seconds = seconds
        self.timer.label = label
        self.timer.started_at = time.time()

    def cancel_timer(self):
        self.timer.is_active = False
        self.timer.remaining_seconds = 0
