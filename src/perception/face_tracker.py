"""
Perception Engine: Real-Time Face & Gaze Tracking using OpenCV YuNet DNN.
Runs in a background thread to keep 60 FPS rendering smooth.
Computes normalized gaze coordinates and user proximity.
"""

import os
import threading
import time
from dataclasses import dataclass
from typing import Optional


@dataclass
class FacePerception:
    face_detected: bool = False
    gaze_x: float = 0.0          # [-1.0, 1.0] normalized
    gaze_y: float = 0.0          # [-1.0, 1.0] normalized
    proximity: float = 0.0       # [0.0, 1.0] (face size relative to frame)
    last_seen_timestamp: float = 0.0


class FaceTracker(threading.Thread):
    def __init__(self, camera_index: int = 0, model_path: str = "/home/pranc/ai-companion/data/yunet.onnx"):
        super().__init__(daemon=True)
        self.camera_index = camera_index
        self.model_path = model_path
        self.running = False
        
        self.lock = threading.Lock()
        self.latest_data = FacePerception()
        self._latest_frame = None
        
        # Internal smoothing
        self._smooth_x = 0.0
        self._smooth_y = 0.0

    def get_perception(self) -> FacePerception:
        with self.lock:
            return FacePerception(
                face_detected=self.latest_data.face_detected,
                gaze_x=self.latest_data.gaze_x,
                gaze_y=self.latest_data.gaze_y,
                proximity=self.latest_data.proximity,
                last_seen_timestamp=self.latest_data.last_seen_timestamp,
            )

    def get_latest_frame(self):
        with self.lock:
            return self._latest_frame.copy() if self._latest_frame is not None else None

    def stop(self):
        self.running = False

    def run(self):
        self.running = True

        try:
            import cv2
        except ImportError:
            print("[Perception] OpenCV (cv2) not available. Face tracking disabled.")
            return

        if not os.path.exists(self.model_path):
            print(f"[Perception] YuNet model file not found at {self.model_path}.")
            return

        cam_w, cam_h = 320, 240
        try:
            detector = cv2.FaceDetectorYN.create(
                self.model_path,
                "",
                (cam_w, cam_h),
                score_threshold=0.6,
                nms_threshold=0.3,
                top_k=5000,
            )
        except Exception as e:
            print(f"[Perception] Failed to create YuNet detector: {e}")
            return

        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            print(f"[Perception] Camera {self.camera_index} could not be opened. Running in passive mode.")
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, cam_w)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cam_h)

        print("[Perception] YuNet Neural Face Tracker initialized successfully.")

        try:
            while self.running:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.05)
                    continue

                # Mirror frame horizontally so user movement is natural
                frame = cv2.flip(frame, 1)
                h, w, _ = frame.shape

                with self.lock:
                    self._latest_frame = frame

                # Ensure detector input size matches frame size
                detector.setInputSize((w, h))
                _, faces = detector.detect(frame)

                now = time.time()

                if faces is not None and len(faces) > 0:
                    # Pick the largest face (closest user)
                    # face row: [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, score]
                    largest_face = max(faces, key=lambda f: f[2] * f[3])
                    fx, fy, fw, fh = largest_face[:4]
                    cx = fx + fw / 2.0
                    cy = fy + fh / 2.0

                    # Convert to normalized [-1.0, 1.0]
                    raw_nx = (cx - (w / 2.0)) / (w / 2.0)
                    raw_ny = (cy - (h / 2.0)) / (h / 2.0)

                    # Smooth gaze tracking with exponential moving average
                    alpha = 0.35
                    self._smooth_x = self._smooth_x * (1 - alpha) + raw_nx * alpha
                    self._smooth_y = self._smooth_y * (1 - alpha) + raw_ny * alpha

                    prox = min(1.0, (fw * fh) / (w * h * 0.4))

                    with self.lock:
                        self.latest_data.face_detected = True
                        self.latest_data.gaze_x = max(-1.0, min(1.0, self._smooth_x))
                        self.latest_data.gaze_y = max(-1.0, min(1.0, self._smooth_y))
                        self.latest_data.proximity = float(prox)
                        self.latest_data.last_seen_timestamp = now
                else:
                    with self.lock:
                        if now - self.latest_data.last_seen_timestamp > 1.5:
                            self.latest_data.face_detected = False

                time.sleep(0.03)  # ~30 FPS camera loop is optimal for CPU
        finally:
            cap.release()
            print("[Perception] Face tracking camera released.")
