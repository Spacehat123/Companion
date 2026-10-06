"""
Perception Engine: Real-Time Audio Energy & Beat Detection.
Listens to ambient microphone input or music loopback.
Detects rhythmic beats (head-bobbing) and human speech volume.
"""

import threading
import time
from dataclasses import dataclass
from typing import Optional
import numpy as np


@dataclass
class AudioPerception:
    energy: float = 0.0          # Current RMS volume [0.0, 1.0]
    is_beat: bool = False        # Triggered on rhythmic kick/pulse
    is_speaking: bool = False    # Continuous speech detected
    beat_intensity: float = 0.0  # Normalized beat strength
    last_beat_time: float = 0.0


class AudioDetector(threading.Thread):
    def __init__(self, sample_rate: int = 22050, block_size: int = 1024):
        super().__init__(daemon=True)
        self.sample_rate = sample_rate
        self.block_size = block_size
        self.running = False
        
        self.lock = threading.Lock()
        self.latest_data = AudioPerception()
        
        # Beat tracking state
        self._energy_history = []
        self._history_len = 30
        self._last_beat_ts = 0.0

    def get_perception(self) -> AudioPerception:
        with self.lock:
            # Beat flag is consumed once read
            data = AudioPerception(
                energy=self.latest_data.energy,
                is_beat=self.latest_data.is_beat,
                is_speaking=self.latest_data.is_speaking,
                beat_intensity=self.latest_data.beat_intensity,
                last_beat_time=self.latest_data.last_beat_time,
            )
            self.latest_data.is_beat = False
            return data

    def stop(self):
        self.running = False

    def _audio_callback(self, indata, frames, time_info, status):
        if not self.running:
            return

        # Compute RMS energy
        raw_audio = indata[:, 0] if indata.ndim > 1 else indata
        rms = float(np.sqrt(np.mean(raw_audio**2)))
        normalized_energy = min(1.0, rms * 15.0)

        now = time.time()
        is_beat = False
        beat_intensity = 0.0

        # Beat detection: look for energy spike above moving average
        self._energy_history.append(normalized_energy)
        if len(self._energy_history) > self._history_len:
            self._energy_history.pop(0)

        if len(self._energy_history) >= 10:
            avg_energy = float(np.mean(self._energy_history))
            std_energy = float(np.std(self._energy_history))

            # Beat threshold: current energy exceeds average + 1.4 * std, with min refractory period (180ms = max ~330 BPM)
            if (
                normalized_energy > 0.08
                and normalized_energy > (avg_energy + 1.35 * std_energy)
                and (now - self._last_beat_ts > 0.18)
            ):
                is_beat = True
                self._last_beat_ts = now
                beat_intensity = min(1.0, (normalized_energy - avg_energy) * 3.0)

        is_speaking = normalized_energy > 0.12

        with self.lock:
            self.latest_data.energy = normalized_energy
            if is_beat:
                self.latest_data.is_beat = True
                self.latest_data.beat_intensity = beat_intensity
                self.latest_data.last_beat_time = now
            self.latest_data.is_speaking = is_speaking

    def run(self):
        self.running = True

        try:
            import sounddevice as sd
        except ImportError:
            print("[Perception] sounddevice not available. Audio detector disabled.")
            return

        try:
            with sd.InputStream(
                channels=1,
                samplerate=self.sample_rate,
                blocksize=self.block_size,
                callback=self._audio_callback,
            ):
                print("[Perception] Real-time audio beat listener initialized.")
                while self.running:
                    time.sleep(0.05)
        except Exception as e:
            print(f"[Perception] Audio stream error: {e}. Running in passive mode.")
            while self.running:
                time.sleep(0.1)
