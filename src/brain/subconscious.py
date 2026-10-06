"""
AI Subconscious Brain: The 5–10% Reasoning Engine.
Runs asynchronously in the background. Does NOT block 60 FPS rendering.
Takes environmental context (attachment, presence, music, notifications)
and produces structured semantic guidance:
- Internal thought
- Emotion
- Attention target
- Spontaneous micro-action
"""

import json
import random
import threading
import time
from dataclasses import dataclass
from typing import Callable, Optional, Dict, Any
import urllib.request
import urllib.error


@dataclass
class SubconsciousState:
    thought: str = "Waking up to ambient room..."
    emotion: str = "curious"     # curious, happy, sleepy, groovy, alert, mischievous
    attention: str = "user"      # user, wandering, screen, resting
    energy: float = 0.8
    action: Optional[str] = None # e.g., 'happy_perk', 'curious_tilt', 'soft_yawn', 'head_bob'
    timestamp: float = 0.0


SYSTEM_PROMPT = """You are the subconscious mind of a tiny, cute physical AI companion device living on the user's desk or keychain (like Wall-E or Tamagotchi).
Your personality is warm, playful, and observant.
Given the current sensory context, generate your internal thought and immediate emotional reaction.
Output ONLY valid JSON matching this exact schema:
{
  "thought": "brief 1-sentence inner thought",
  "emotion": "curious|happy|sleepy|groovy|alert|mischievous",
  "attention": "user|wandering|resting",
  "action": "happy_perk|curious_tilt|soft_yawn|head_bob|null"
}"""


class SubconsciousEngine(threading.Thread):
    def __init__(self, on_thought_updated: Optional[Callable[[SubconsciousState], None]] = None):
        super().__init__(daemon=True)
        self.running = False
        self.on_thought_updated = on_thought_updated
        
        self.lock = threading.Lock()
        self.latest_state = SubconsciousState()
        
        # Latest sensory snapshot
        self._current_context: Dict[str, Any] = {
            "attachment": 20.0,
            "face_present": True,
            "music_playing": False,
            "energy": 90.0,
            "last_event": "None",
        }
        self._trigger_event = threading.Event()
        self._last_run_time = 0.0
        self._interval = 18.0  # Run every 18 seconds asynchronously

    def get_state(self) -> SubconsciousState:
        with self.lock:
            return SubconsciousState(
                thought=self.latest_state.thought,
                emotion=self.latest_state.emotion,
                attention=self.latest_state.attention,
                energy=self.latest_state.energy,
                action=self.latest_state.action,
                timestamp=self.latest_state.timestamp,
            )

    def trigger_immediate_evaluation(self, context_update: Dict[str, Any]):
        """Called when a major phone event or interaction occurs."""
        with self.lock:
            self._current_context.update(context_update)
        self._trigger_event.set()

    def update_context(self, context_update: Dict[str, Any]):
        with self.lock:
            self._current_context.update(context_update)

    def stop(self):
        self.running = False
        self._trigger_event.set()

    def _query_local_slm(self, user_content: str) -> Optional[Dict[str, Any]]:
        """Attempts to query local LM Studio or local OpenAI-compatible endpoint for SmolLM2."""
        endpoint = "http://127.0.0.1:1234/v1/chat/completions"
        payload = {
            "model": "SmolLM2-360M-Instruct",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.6,
            "max_tokens": 80,
        }
        try:
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=1.8) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    content = data["choices"][0]["message"]["content"]
                    # Extract JSON
                    start = content.find("{")
                    end = content.rfind("}") + 1
                    if start != -1 and end > start:
                        return json.loads(content[start:end])
        except Exception:
            pass
        return None

    def _generate_deterministic_subconscious(self, ctx: Dict[str, Any]) -> Dict[str, Any]:
        """High-speed deterministic fallback reasoning when SLM is offline."""
        face = ctx.get("face_present", False)
        music = ctx.get("music_playing", False)
        event = ctx.get("last_event", "None")
        energy = ctx.get("energy", 90.0)
        attachment = ctx.get("attachment", 20.0)

        if "MESSAGE" in event:
            return {
                "thought": "A new notification popped up! I should let them know.",
                "emotion": "alert",
                "attention": "user",
                "action": "curious_tilt",
            }
        elif "CALL" in event:
            return {
                "thought": "Someone is calling! Alert, alert!",
                "emotion": "alert",
                "attention": "user",
                "action": "happy_perk",
            }
        elif music:
            return {
                "thought": "This beat is rhythmic. Grooving along to the sound.",
                "emotion": "groovy",
                "attention": "wandering",
                "action": "head_bob",
            }
        elif energy < 20.0:
            return {
                "thought": "Feeling cozy and a little drowsy...",
                "emotion": "sleepy",
                "attention": "resting",
                "action": "soft_yawn",
            }
        elif face:
            if attachment > 50.0:
                thoughts = [
                    "My favorite human is right here working with me.",
                    "Watching you create things is fascinating.",
                    "Glad to be on your desk keeping you company.",
                ]
                return {
                    "thought": random.choice(thoughts),
                    "emotion": "happy",
                    "attention": "user",
                    "action": "happy_perk",
                }
            else:
                return {
                    "thought": "Noticing the user in front of me.",
                    "emotion": "curious",
                    "attention": "user",
                    "action": "curious_tilt",
                }
        else:
            return {
                "thought": "Room is quiet. Looking around curiously.",
                "emotion": "curious",
                "attention": "wandering",
                "action": None,
            }

    def run(self):
        self.running = True
        print("[Subconscious Engine] Background AI reasoning worker started.")

        while self.running:
            # Wait for periodic timer or immediate trigger
            triggered = self._trigger_event.wait(timeout=self._interval)
            if not self.running:
                break
            self._trigger_event.clear()

            with self.lock:
                ctx_copy = dict(self._current_context)

            # Format contextual query
            prompt = (
                f"Sensory Context:\n"
                f"- Face detected: {ctx_copy.get('face_present', False)}\n"
                f"- Music playing: {ctx_copy.get('music_playing', False)}\n"
                f"- Energy level: {ctx_copy.get('energy', 90.0):.1f}%\n"
                f"- User attachment: {ctx_copy.get('attachment', 20.0):.1f}/100\n"
                f"- Last device event: {ctx_copy.get('last_event', 'None')}\n"
            )

            # 1. Try local SLM first
            result = self._query_local_slm(prompt)

            # 2. Fall back to deterministic subconscious if SLM is offline
            if not result:
                result = self._generate_deterministic_subconscious(ctx_copy)

            now = time.time()
            new_state = SubconsciousState(
                thought=result.get("thought", "Watching the world..."),
                emotion=result.get("emotion", "curious"),
                attention=result.get("attention", "user"),
                energy=float(result.get("energy", 0.8)),
                action=result.get("action"),
                timestamp=now,
            )

            with self.lock:
                self.latest_state = new_state

            if self.on_thought_updated:
                self.on_thought_updated(new_state)
