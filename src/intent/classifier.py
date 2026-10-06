"""
Intent Classifier & Structured Semantic State Engine.
Produces a strict, predictable JSON schema containing:
- primary_intent: enum
- confidence: float [0.0 - 1.0]
- intent_scores: normalized probability distribution across all 6 classes
- emotion: enum (happy, curious, annoyed, sleepy, alert, cheeky, neutral)
- attention: enum (user, screen, wandering)
- energy: float [0.0 - 1.0]
- parameters: dict (duration_sec, etc.)
"""

import re
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

INTENTS = [
    "NEXT_TRACK",
    "PREVIOUS_TRACK",
    "TAKE_PHOTO",
    "SET_TIMER",
    "CONVERSATION",
    "UNKNOWN",
]


@dataclass
class IntentResult:
    primary_intent: str
    confidence: float
    intent_scores: Dict[str, float]
    emotion: str
    attention: str
    energy: float
    parameters: Dict[str, Any]
    raw_text: str = ""

    # Backwards compatibility alias
    @property
    def intent(self) -> str:
        return self.primary_intent

    @property
    def params(self) -> Dict[str, Any]:
        return self.parameters

    def to_dict(self) -> Dict[str, Any]:
        return {
            "primary_intent": self.primary_intent,
            "confidence": self.confidence,
            "intent_scores": self.intent_scores,
            "emotion": self.emotion,
            "attention": self.attention,
            "energy": self.energy,
            "parameters": self.parameters,
        }


class IntentClassifier:
    """Specialized semantic intent engine for physical companion commands."""

    def __init__(self):
        self.next_patterns = [
            r"\b(skip|next)\b",
            r"\b(next track|next song|change song|change the song|skip this)\b",
            r"\b(play something else|get rid of this track)\b",
        ]
        self.prev_patterns = [
            r"\b(previous|prev)\b",
            r"\b(previous track|previous song|last song|go back|back up a track)\b",
            r"\b(play the song before this|replay the previous|replay this song)\b",
        ]
        self.photo_patterns = [
            r"\b(photo|picture|pic|selfie|snapshot)\b",
            r"\b(take a photo|take a picture|snap a pic|take my picture|capture this)\b",
            r"\b(shoot a picture|cheese)\b",
        ]
        self.timer_patterns = [
            r"\b(timer|countdown|remind me in|alarm in)\b",
            r"\b(count down from|wake me in)\b",
        ]
        self.conv_patterns = [
            r"\b(bored|i am bored|i'm bored)\b",
            r"\b(hello|hey|hi|sup|yo|howdy|good morning|how are you|talk to me)\b",
            r"\b(what'?s up|whats up|you are cute|tell me something|what do you think|who are you)\b",
        ]

    def _extract_timer_seconds(self, text: str) -> int:
        text = text.lower()
        word_to_num = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "fifteen": 15, "twenty": 20, "thirty": 30, "sixty": 60,
        }

        min_match = re.search(r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty)\s*(?:minute|min)", text)
        if min_match:
            val = min_match.group(1)
            num = int(val) if val.isdigit() else word_to_num.get(val, 1)
            return num * 60

        sec_match = re.search(r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|sixty)\s*(?:second|sec)", text)
        if sec_match:
            val = sec_match.group(1)
            num = int(val) if val.isdigit() else word_to_num.get(val, 30)
            return num

        return 60

    def _build_scores(self, primary: str, primary_conf: float) -> Dict[str, float]:
        """Distributes remaining probability mass evenly across non-primary intents."""
        scores = {}
        rem = round((1.0 - primary_conf) / (len(INTENTS) - 1), 3)
        for cls in INTENTS:
            scores[cls] = rem
        scores[primary] = round(1.0 - (rem * (len(INTENTS) - 1)), 3)
        return scores

    def classify(self, utterance: str) -> IntentResult:
        text = utterance.strip().lower()
        if not text:
            scores = {c: round(1.0 / len(INTENTS), 3) for c in INTENTS}
            return IntentResult(
                primary_intent="UNKNOWN",
                confidence=0.0,
                intent_scores=scores,
                emotion="neutral",
                attention="wandering",
                energy=0.3,
                parameters={"duration_sec": None},
                raw_text=utterance,
            )

        # 1. NEXT_TRACK
        for pattern in self.next_patterns:
            if re.search(pattern, text):
                if not re.search(r"\b(what|who|yesterday)\b", text):
                    conf = 0.95
                    return IntentResult(
                        primary_intent="NEXT_TRACK",
                        confidence=conf,
                        intent_scores=self._build_scores("NEXT_TRACK", conf),
                        emotion="annoyed",
                        attention="user",
                        energy=0.75,
                        parameters={"duration_sec": None},
                        raw_text=utterance,
                    )

        # 2. PREVIOUS_TRACK
        for pattern in self.prev_patterns:
            if re.search(pattern, text):
                conf = 0.94
                return IntentResult(
                    primary_intent="PREVIOUS_TRACK",
                    confidence=conf,
                    intent_scores=self._build_scores("PREVIOUS_TRACK", conf),
                    emotion="curious",
                    attention="user",
                    energy=0.70,
                    parameters={"duration_sec": None},
                    raw_text=utterance,
                )

        # 3. TAKE_PHOTO
        for pattern in self.photo_patterns:
            if re.search(pattern, text):
                if not re.search(r"\b(where|yesterday|show me)\b", text):
                    conf = 0.96
                    return IntentResult(
                        primary_intent="TAKE_PHOTO",
                        confidence=conf,
                        intent_scores=self._build_scores("TAKE_PHOTO", conf),
                        emotion="happy",
                        attention="user",
                        energy=0.85,
                        parameters={"duration_sec": None},
                        raw_text=utterance,
                    )

        # 4. SET_TIMER
        for pattern in self.timer_patterns:
            if re.search(pattern, text):
                seconds = self._extract_timer_seconds(text)
                conf = 0.95
                return IntentResult(
                    primary_intent="SET_TIMER",
                    confidence=conf,
                    intent_scores=self._build_scores("SET_TIMER", conf),
                    emotion="alert",
                    attention="user",
                    energy=0.65,
                    parameters={"duration_sec": seconds, "label": f"{seconds // 60 or seconds}{'m' if seconds >= 60 else 's'}"},
                    raw_text=utterance,
                )

        # 5. CONVERSATION
        for pattern in self.conv_patterns:
            if re.search(pattern, text):
                conf = 0.92
                emotion = "cheeky" if "bored" in text else "happy"
                energy = 0.40 if "bored" in text else 0.75
                return IntentResult(
                    primary_intent="CONVERSATION",
                    confidence=conf,
                    intent_scores=self._build_scores("CONVERSATION", conf),
                    emotion=emotion,
                    attention="user",
                    energy=energy,
                    parameters={"duration_sec": None},
                    raw_text=utterance,
                )

        # 6. Fallback UNKNOWN
        conf = 0.85
        return IntentResult(
            primary_intent="UNKNOWN",
            confidence=conf,
            intent_scores=self._build_scores("UNKNOWN", conf),
            emotion="confused",
            attention="wandering",
            energy=0.50,
            parameters={"duration_sec": None},
            raw_text=utterance,
        )
