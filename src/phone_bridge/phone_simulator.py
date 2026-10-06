"""
Interactive Dev Console & Utterance Simulator.
Allows instantaneous triggering of the MVP test commands, custom speech inputs,
and simulated phone events.
"""

from dataclasses import dataclass
from typing import Callable, Optional
from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QVBoxLayout,
    QWidget,
)


@dataclass
class PhoneEvent:
    event_type: str  # MESSAGE, CALL, TIMER, BATTERY, MUSIC
    sender: str
    body: str
    icon: str


class PhoneSimulatorWidget(QWidget):
    # Signals
    utterance_triggered = Signal(str)
    event_emitted = Signal(PhoneEvent)
    person_toggle_triggered = Signal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Companion MVP Test Console")
        self.setFixedSize(340, 520)
        self.setStyleSheet("""
            QWidget {
                background-color: #f8fafc;
                color: #0f172a;
                font-family: 'Inter', sans-serif;
            }
            QGroupBox {
                background-color: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                margin-top: 10px;
                padding-top: 14px;
                font-weight: bold;
                color: #0284c7;
            }
            QPushButton {
                background-color: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 7px 10px;
                font-size: 11px;
                font-weight: 500;
                color: #1e293b;
                text-align: left;
            }
            QPushButton:hover {
                background-color: #f0f9ff;
                border-color: #0284c7;
                color: #0369a1;
            }
            QPushButton:pressed {
                background-color: #0284c7;
                color: #ffffff;
            }
            QLineEdit {
                background-color: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 6px 10px;
                color: #0f172a;
                font-size: 12px;
            }
            QLineEdit:focus {
                border-color: #0284c7;
            }
        """)

        layout = QVBoxLayout(self)

        header = QLabel("🧪 MVP Interactive Test Console")
        header.setStyleSheet("font-size: 13px; font-weight: bold; color: #0284c7; margin-bottom: 2px;")
        layout.addWidget(header)

        # 1. Custom Utterance Input Bar
        input_label = QLabel("Say or Type Utterance:")
        input_label.setStyleSheet("font-size: 10px; color: #64748b; font-weight: 600;")
        layout.addWidget(input_label)

        input_box_layout = QHBoxLayout()
        self.input_field = QLineEdit()
        self.input_field.setPlaceholderText("e.g. 'Skip this song' or 'Take a photo'...")
        self.input_field.returnPressed.connect(self._send_text_input)
        input_box_layout.addWidget(self.input_field)

        btn_send = QPushButton("Send")
        btn_send.setFixedWidth(55)
        btn_send.setStyleSheet("text-align: center;")
        btn_send.clicked.connect(self._send_text_input)
        input_box_layout.addWidget(btn_send)
        layout.addLayout(input_box_layout)

        # 2. The 4 Hero MVP Test Scenarios
        hero_group = QGroupBox("Core MVP Voice Commands")
        hero_layout = QVBoxLayout(hero_group)

        btn_skip = QPushButton("🗣️ \"Skip this song.\"")
        btn_skip.clicked.connect(lambda: self.utterance_triggered.emit("skip this song"))
        hero_layout.addWidget(btn_skip)

        btn_photo = QPushButton("📸 \"Take a picture of me.\"")
        btn_photo.clicked.connect(lambda: self.utterance_triggered.emit("take a picture of me"))
        hero_layout.addWidget(btn_photo)

        btn_timer = QPushButton("⏱️ \"Set a timer for 1 minute.\"")
        btn_timer.clicked.connect(lambda: self.utterance_triggered.emit("set a timer for 1 minute"))
        hero_layout.addWidget(btn_timer)

        btn_bored = QPushButton("💬 \"I'm bored.\"")
        btn_bored.clicked.connect(lambda: self.utterance_triggered.emit("i'm bored"))
        hero_layout.addWidget(btn_bored)

        layout.addWidget(hero_group)

        # 3. Perception / Camera Triggers
        percep_group = QGroupBox("Perception Triggers")
        percep_layout = QVBoxLayout(percep_group)

        btn_person = QPushButton("👤 Walk Into Camera (PERSON_DETECTED)")
        btn_person.clicked.connect(self.person_toggle_triggered.emit)
        percep_layout.addWidget(btn_person)

        layout.addWidget(percep_group)

        # 4. Simulated Phone Alerts
        phone_group = QGroupBox("Simulated Phone Events")
        phone_layout = QVBoxLayout(phone_group)

        btn_msg = QPushButton("💬 WhatsApp: 'Hey, are you free?'")
        btn_msg.clicked.connect(lambda: self.emit_event("MESSAGE", "WhatsApp", "Hey, are you free?", "💬"))
        phone_layout.addWidget(btn_msg)

        btn_call = QPushButton("📞 Incoming Call: 'Mom'")
        btn_call.clicked.connect(lambda: self.emit_event("CALL", "Mom", "Incoming Call...", "📞"))
        phone_layout.addWidget(btn_call)

        layout.addWidget(phone_group)
        layout.addStretch()

    def _send_text_input(self):
        text = self.input_field.text().strip()
        if text:
            self.utterance_triggered.emit(text)
            self.input_field.clear()

    def emit_event(self, event_type: str, sender: str, body: str, icon: str):
        ev = PhoneEvent(event_type=event_type, sender=sender, body=body, icon=icon)
        self.event_emitted.emit(ev)
