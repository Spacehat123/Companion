#!/usr/bin/env python3
"""
Physical AI Companion — End-to-End Product MVP Launcher.
Connects:
1. Procedural OLED Character Display (Living Cube)
2. Live Perception: Real-Time Webcam Face Tracking + Microphone Speech Recognition
3. Intent Engine: 6-way Intent Classifier (NEXT_TRACK, PREVIOUS_TRACK, TAKE_PHOTO, SET_TIMER, CONVERSATION, UNKNOWN)
4. Action Execution: Song skip, camera photo capture to disk, real countdown timers
5. Template Dialogue & Expressions: "Skipping that one 🙄", "Say cheese! 📸", etc.
6. Persistent Memory & Context: Tracks song, timers, command history
7. Interactive Dev Console: Instant testing of all 4 hero scenarios + custom typing
"""

import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication

from src.phone_bridge.phone_simulator import PhoneSimulatorWidget
from src.renderer.character_widget import CharacterWidget


def main():
    print("=" * 68)
    print("🤖 PHYSICAL AI COMPANION — END-TO-END PRODUCT MVP")
    print("=" * 68)
    print("Live Capabilities:")
    print("  • 🎤 Mic Speech Recognition: Speak 'Skip this song', 'Take a picture', etc.")
    print("  • 🧠 Intent Classifier: 6 classes with zero generative latency")
    print("  • ⚡ Real Actions: Skips song playlist, takes real photo to disk, ticks timer")
    print("  • 🎭 Templates & Expressions: Annoyed, camera flash, happy, perked up")
    print("  • 👁️  Camera Face Tracking: Eyes physically lock onto your face")
    print("  • 🧪 Test Console: Click hero buttons or type custom utterances")
    print("=" * 68)

    app = QApplication(sys.argv)
    app.setApplicationName("AI Companion MVP")

    # 1. Instantiate Character Widget
    cube_widget = CharacterWidget(size=380)

    # 2. Instantiate Dev Test Console
    phone_console = PhoneSimulatorWidget()

    # Wire Console to Companion
    phone_console.utterance_triggered.connect(cube_widget.process_utterance)
    phone_console.event_emitted.connect(cube_widget.process_phone_event)
    phone_console.person_toggle_triggered.connect(
        lambda: cube_widget.set_dialogue("Hey! I see you!", "perked_up", 3.0)
    )

    # Position on user screen: Cube at bottom right, Console to its left
    screen = app.primaryScreen().geometry()
    cube_x = screen.width() - cube_widget.width() - 40
    cube_y = screen.height() - cube_widget.height() - 70
    cube_widget.move(cube_x, cube_y)

    console_x = cube_x - phone_console.width() - 25
    console_y = cube_y - (phone_console.height() - cube_widget.height())
    phone_console.move(console_x, max(30, console_y))

    # Show both windows
    cube_widget.show()
    phone_console.show()

    print("[Companion System] Ready and running live.")
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
