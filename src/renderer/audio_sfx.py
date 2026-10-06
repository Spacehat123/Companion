"""
Procedural Audio Synthesizer: Generates Wall-E / R2-D2 style chirps,
trills, and alert beeps in real time using numpy and sounddevice.
No external audio files or internet required.
"""

import math
import threading
import numpy as np


class CompanionSFX:
    """Procedural audio effects generator for the physical companion."""

    def __init__(self, sample_rate: int = 22050):
        self.sample_rate = sample_rate
        self._has_audio = False
        try:
            import sounddevice as sd
            self._sd = sd
            self._has_audio = True
        except ImportError:
            self._sd = None

    def _play_wave(self, wave: np.ndarray):
        if not self._has_audio or self._sd is None:
            return

        def _worker():
            try:
                self._sd.play(wave, self.sample_rate)
            except Exception:
                pass

        threading.Thread(target=_worker, daemon=True).start()

    def play_happy_chirp(self):
        """Cute rising double-trill (Wall-E / R2-D2 style)."""
        sr = self.sample_rate
        dur = 0.16
        t = np.linspace(0, dur, int(sr * dur), endpoint=False)
        # Rising pitch frequency modulation
        freq = np.linspace(480, 1150, len(t))
        wave = 0.28 * np.sin(2 * np.pi * freq * t)
        
        # Envelope: quick attack, smooth decay
        envelope = np.exp(-t * 12.0)
        wave = (wave * envelope).astype(np.float32)
        self._play_wave(wave)

    def play_alert_ping(self):
        """Crisp notification chime."""
        sr = self.sample_rate
        dur = 0.22
        t = np.linspace(0, dur, int(sr * dur), endpoint=False)
        # Two harmonious frequencies: 880Hz (A5) and 1320Hz (E6)
        freq1 = 880.0
        freq2 = 1320.0
        wave = 0.25 * (np.sin(2 * np.pi * freq1 * t) + 0.6 * np.sin(2 * np.pi * freq2 * t))
        envelope = np.exp(-t * 9.0)
        wave = (wave * envelope).astype(np.float32)
        self._play_wave(wave)

    def play_click_pop(self):
        """Snappy tactile micro-click for button taps."""
        sr = self.sample_rate
        dur = 0.04
        t = np.linspace(0, dur, int(sr * dur), endpoint=False)
        freq = np.linspace(700, 200, len(t))
        wave = 0.35 * np.sin(2 * np.pi * freq * t)
        envelope = np.exp(-t * 45.0)
        wave = (wave * envelope).astype(np.float32)
        self._play_wave(wave)

    def play_worried_whimper(self):
        """Falling soft tone for low battery / sad."""
        sr = self.sample_rate
        dur = 0.3
        t = np.linspace(0, dur, int(sr * dur), endpoint=False)
        freq = np.linspace(650, 320, len(t))
        wave = 0.22 * np.sin(2 * np.pi * freq * t)
        envelope = np.exp(-t * 6.0)
        wave = (wave * envelope).astype(np.float32)
        self._play_wave(wave)

    def play_shake_woosh(self):
        """Wobbly morph sound when shaken."""
        sr = self.sample_rate
        dur = 0.2
        t = np.linspace(0, dur, int(sr * dur), endpoint=False)
        # Pitch wobble
        freq = 420.0 + 160.0 * np.sin(2 * np.pi * 18.0 * t)
        wave = 0.25 * np.sin(2 * np.pi * freq * t)
        envelope = np.sin(np.pi * t / dur)
        wave = (wave * envelope).astype(np.float32)
        self._play_wave(wave)
