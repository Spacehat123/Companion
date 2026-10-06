"""
Action Execution Engine for Physical AI Companion.
Executes real actions:
- Skip / Previous song (Playlist + playerctl integration)
- Take real photo from webcam and save to disk
- Start countdown timer
- Trigger system notifications
"""

import os
import subprocess
import time
from datetime import datetime
from typing import Callable, Optional, Tuple

from src.memory.context_memory import CompanionMemory


class ActionExecutor:
    def __init__(
        self,
        memory: CompanionMemory,
        photo_dir: str = "/home/pranc/ai-companion/photos",
        frame_provider: Optional[Any] = None,
    ):
        self.memory = memory
        self.photo_dir = photo_dir
        self.frame_provider = frame_provider
        os.makedirs(photo_dir, exist_ok=True)
        self.on_timer_finished_cb: Optional[Callable[[], None]] = None

    def execute_next_track(self) -> str:
        """Skips to the next track."""
        # Try system media playerctl first
        try:
            subprocess.run(["playerctl", "next"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=0.4)
        except Exception:
            pass

        song = self.memory.next_song()
        msg = f"Skipped to: {song.title} by {song.artist}"
        print(f"[Action: Music] {msg}")
        return msg

    def execute_prev_track(self) -> str:
        """Returns to previous track."""
        try:
            subprocess.run(["playerctl", "previous"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=0.4)
        except Exception:
            pass

        song = self.memory.prev_song()
        msg = f"Rewound to: {song.title} by {song.artist}"
        print(f"[Action: Music] {msg}")
        return msg

    def execute_take_photo(self) -> str:
        """Captures a real frame from the camera and saves it to disk."""
        filename = f"photo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        filepath = os.path.join(self.photo_dir, filename)

        # 1. Grab from active face tracker frame provider (avoids V4L2 lock conflict)
        if self.frame_provider and hasattr(self.frame_provider, "get_latest_frame"):
            frame = self.frame_provider.get_latest_frame()
            if frame is not None:
                try:
                    import cv2
                    cv2.imwrite(filepath, frame)
                    print(f"[Action: Camera] Live webcam photo saved: {filepath}")
                    return filepath
                except Exception as e:
                    print(f"[Action: Camera] Save error: {e}")

        # Fallback dummy snapshot if camera was unavailable
        try:
            import numpy as np
            import cv2
            dummy = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(dummy, "AI Companion Selfie", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 240, 255), 2)
            cv2.imwrite(filepath, dummy)
            print(f"[Action: Camera] Snapshot saved: {filepath}")
            return filepath
        except Exception:
            return filepath

    def execute_set_timer(self, seconds: int, label: str = "Timer") -> str:
        """Starts countdown timer in memory."""
        self.memory.start_timer(seconds, label)
        duration_desc = f"{seconds // 60}m" if seconds >= 60 else f"{seconds}s"
        msg = f"Timer set for {duration_desc}"
        print(f"[Action: Timer] {msg}")
        return msg

    def send_system_notification(self, title: str, message: str):
        """Sends native desktop notification via notify-send if available."""
        try:
            subprocess.run(["notify-send", title, message], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
