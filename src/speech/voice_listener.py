"""
Microphone Speech Recognition Engine.
Continuously listens for user speech in a background thread using SpeechRecognition.
Emits recognized text strings to the intent pipeline.
"""

import threading
import time
from typing import Callable, Optional


class VoiceListener(threading.Thread):
    def __init__(self, on_text_callback: Callable[[str], None]):
        super().__init__(daemon=True)
        self.on_text_callback = on_text_callback
        self.running = False
        self._recognizer = None
        self._microphone = None

    def stop(self):
        self.running = False

    def run(self):
        self.running = True

        try:
            import speech_recognition as sr
        except ImportError:
            print("[VoiceListener] SpeechRecognition not installed. Voice input disabled.")
            return

        recognizer = sr.Recognizer()
        recognizer.energy_threshold = 280
        recognizer.dynamic_energy_threshold = True
        recognizer.pause_threshold = 0.8

        try:
            mic = sr.Microphone()
            with mic as source:
                print("[VoiceListener] Calibrating microphone for ambient room noise (1 sec)...")
                recognizer.adjust_for_ambient_noise(source, duration=1.0)
            print("[VoiceListener] 🎤 Live voice listener active. Say 'Skip this song', 'Take a picture', etc.")
        except Exception as e:
            print(f"[VoiceListener] Microphone initialization error: {e}. Running in passive mode.")
            return

        while self.running:
            try:
                with mic as source:
                    # Non-blocking listen with timeout
                    audio = recognizer.listen(source, timeout=3.0, phrase_time_limit=6.0)
                
                if not self.running:
                    break

                # Transcribe using fast free speech engine
                try:
                    text = recognizer.recognize_google(audio)
                    if text and text.strip():
                        print(f"[VoiceListener] 🗣️ Recognized Speech: \"{text}\"")
                        self.on_text_callback(text.strip())
                except sr.UnknownValueError:
                    pass  # Inaudible / murmur
                except sr.RequestError as e:
                    print(f"[VoiceListener] Speech API error: {e}")
            except sr.WaitTimeoutError:
                pass
            except Exception as e:
                time.sleep(0.5)
