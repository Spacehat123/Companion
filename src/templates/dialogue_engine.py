"""
Dialogue & Expression Template Engine.
Provides deterministic, personality-rich template responses and facial expressions
without requiring slow generative LLM generation.
"""

import random
from dataclasses import dataclass
from typing import Optional


@dataclass
class TemplateResponse:
    text: str
    expression: str  # annoyed, happy, camera_flash, attentive, cheeky, perked_up, confused
    duration: float = 3.5


class DialogueEngine:
    def get_response(self, intent: str, raw_text: str = "", params: Optional[dict] = None) -> TemplateResponse:
        params = params or {}
        text_lower = raw_text.lower()

        if intent == "NEXT_TRACK":
            return TemplateResponse(
                text="Skipping that one...",
                expression="annoyed",
                duration=3.0,
            )

        elif intent == "PREVIOUS_TRACK":
            return TemplateResponse(
                text="Backing up one track!",
                expression="curious",
                duration=3.0,
            )

        elif intent == "TAKE_PHOTO":
            return TemplateResponse(
                text="Say cheese! *click*",
                expression="camera_flash",
                duration=3.0,
            )

        elif intent == "SET_TIMER":
            dur = params.get("label", "1m")
            return TemplateResponse(
                text=f"Timer set for {dur}!",
                expression="attentive",
                duration=3.2,
            )

        elif intent == "CONVERSATION":
            if "bored" in text_lower:
                replies = [
                    "Entertain yourself, mortal! Or tap my belly.",
                    "I'm a tiny cube and even I'm not bored! Let's play music.",
                ]
                return TemplateResponse(text=random.choice(replies), expression="cheeky", duration=3.5)
            elif any(g in text_lower for g in ["hello", "hey", "hi"]):
                return TemplateResponse(text="Hey there! Good to see you!", expression="happy", duration=3.0)
            elif "cute" in text_lower:
                return TemplateResponse(text="I know, it's a blessing and a curse!", expression="happy", duration=3.2)
            else:
                return TemplateResponse(text="I'm listening! What's on your mind?", expression="curious", duration=3.0)

        elif intent == "PERSON_DETECTED":
            return TemplateResponse(
                text="I see you!",
                expression="perked_up",
                duration=2.5,
            )

        else:  # Unhandled queries -> Route to playful character persona
            playful_fallbacks = [
                ("Hmm, big questions for a tiny cube!", "confused"),
                ("Not sure about that, but I'm looking cute today!", "happy"),
                ("Sounds deep... want me to play some music instead?", "cheeky"),
                ("My tiny brain is processing that... beep boop!", "curious"),
                ("Tell me more, or shake me for music controls!", "happy"),
            ]
            reply, expr = random.choice(playful_fallbacks)
            return TemplateResponse(
                text=reply,
                expression=expr,
                duration=3.5,
            )
