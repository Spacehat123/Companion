"""
Dataset Generator: Builds full Structured Semantic State targets.
Each sample generates a machine-readable JSON matching the strict schema:
- primary_intent: enum
- confidence: float [0.0 - 1.0]
- intent_scores: normalized probability distribution across all 6 classes
- emotion: enum (happy, curious, annoyed, sleepy, alert, cheeky, neutral)
- attention: enum (user, screen, wandering)
- energy: float [0.0 - 1.0]
- parameters: dict (duration_sec, etc.)
"""

import json
import os
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASETS_DIR = os.path.join(SCRIPT_DIR, "../datasets")
os.makedirs(DATASETS_DIR, exist_ok=True)

INTENTS = [
    "NEXT_TRACK",
    "PREVIOUS_TRACK",
    "TAKE_PHOTO",
    "SET_TIMER",
    "CONVERSATION",
    "UNKNOWN",
]


def build_semantic_state(label: str, duration_sec: int = None, text: str = "") -> dict:
    """Builds a deterministic, normalized semantic distribution."""
    # Base distribution: primary intent gets 0.90-0.96, rest distributed
    scores = {}
    primary_score = round(random.uniform(0.92, 0.97), 3)
    remaining = round(1.0 - primary_score, 3)

    other_classes = [c for c in INTENTS if c != label]
    random_weights = [random.random() for _ in other_classes]
    total_w = sum(random_weights)

    for cls, w in zip(other_classes, random_weights):
        scores[cls] = round((w / total_w) * remaining, 3)
    scores[label] = primary_score

    # Normalize rounding
    total_sum = sum(scores.values())
    scores[label] = round(scores[label] + (1.0 - total_sum), 3)

    # Contextual emotion, attention, and energy per intent
    text_lower = text.lower()
    if label == "NEXT_TRACK":
        emotion = "annoyed"
        attention = "user"
        energy = 0.75
    elif label == "PREVIOUS_TRACK":
        emotion = "curious"
        attention = "user"
        energy = 0.70
    elif label == "TAKE_PHOTO":
        emotion = "happy"
        attention = "user"
        energy = 0.85
    elif label == "SET_TIMER":
        emotion = "alert"
        attention = "user"
        energy = 0.65
    elif label == "CONVERSATION":
        attention = "user"
        if "bored" in text_lower:
            emotion = "cheeky"
            energy = 0.40
        elif any(w in text_lower for w in ["haha", "lol", "funny", "hehe"]):
            emotion = "happy"
            energy = 0.85
        elif any(w in text_lower for w in ["good morning", "hello", "hi"]):
            emotion = "happy"
            energy = 0.75
        else:
            emotion = "curious"
            energy = 0.60
    else:  # UNKNOWN
        emotion = "confused"
        attention = "wandering"
        energy = 0.50

    return {
        "primary_intent": label,
        "confidence": primary_score,
        "intent_scores": scores,
        "emotion": emotion,
        "attention": attention,
        "energy": energy,
        "parameters": {
            "duration_sec": duration_sec,
        },
    }


def generate():
    from generate_datasets import TRAIN_DATA, EVAL_DATA

    # Process Training Data
    formatted_train = []
    for item in TRAIN_DATA:
        dur = item.get("duration_sec", None)
        sem_state = build_semantic_state(item["label"], duration_sec=dur, text=item["text"])
        formatted_train.append({
            "text": item["text"],
            "label": item["label"],
            "semantic_state": sem_state,
        })

    # Process Eval Data
    formatted_eval = []
    for item in EVAL_DATA:
        dur = item.get("duration_sec", None)
        sem_state = build_semantic_state(item["label"], duration_sec=dur, text=item["text"])
        formatted_eval.append({
            "text": item["text"],
            "label": item["label"],
            "semantic_state": sem_state,
        })

    train_path = os.path.join(DATASETS_DIR, "intent_train.jsonl")
    eval_path = os.path.join(DATASETS_DIR, "intent_eval.jsonl")

    with open(train_path, "w") as f:
        for row in formatted_train:
            f.write(json.dumps(row) + "\n")
    print(f"✅ Generated {len(formatted_train)} training records with full semantic states at {train_path}")

    with open(eval_path, "w") as f:
        for row in formatted_eval:
            f.write(json.dumps(row) + "\n")
    print(f"✅ Generated {len(formatted_eval)} eval records with full semantic states at {eval_path}")


if __name__ == "__main__":
    generate()
