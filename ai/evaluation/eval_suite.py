"""
Automated Quantitative Evaluation Suite for Intent Classification.
Calculates:
- Overall Accuracy
- Per-Class Precision, Recall, and F1-Score
- 6x6 Confusion Matrix
- Critical False Positive Analysis
"""

import json
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__)) + "/../.."
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.intent.classifier import IntentClassifier

INTENT_CLASSES = [
    "NEXT_TRACK",
    "PREVIOUS_TRACK",
    "TAKE_PHOTO",
    "SET_TIMER",
    "CONVERSATION",
    "UNKNOWN",
]


def run_evaluation(eval_path: str = None):
    if eval_path is None:
        eval_path = os.path.join(os.path.dirname(__file__), "../datasets/intent_eval.jsonl")

    classifier = IntentClassifier()

    records = []
    with open(eval_path, "r") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    y_true = []
    y_pred = []
    errors = []

    for item in records:
        text = item["text"]
        true_label = item["label"]
        res = classifier.classify(text)
        pred_label = res.intent

        y_true.append(true_label)
        y_pred.append(pred_label)

        if true_label != pred_label:
            errors.append({
                "text": text,
                "true": true_label,
                "pred": pred_label,
                "conf": res.confidence,
            })

    total = len(y_true)
    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    accuracy = correct / total if total > 0 else 0.0

    print("=" * 65)
    print(f"📊 INTENT CLASSIFIER EVALUATION REPORT ({total} held-out samples)")
    print("=" * 65)
    print(f"Overall Accuracy: {accuracy * 100:.1f}% ({correct}/{total})\n")

    # Per-class metrics
    class_stats = {}
    for cls in INTENT_CLASSES:
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == cls and p == cls)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t != cls and p == cls)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == cls and p != cls)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
        count = sum(1 for t in y_true if t == cls)

        class_stats[cls] = {"prec": prec, "rec": rec, "f1": f1, "count": count}

    print(f"{'Class':<18} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'Count'}")
    print("-" * 65)
    for cls, m in class_stats.items():
        print(f"{cls:<18} | {m['prec']:<10.2f} | {m['rec']:<10.2f} | {m['f1']:<10.2f} | {m['count']}")

    macro_f1 = sum(m["f1"] for m in class_stats.values()) / len(INTENT_CLASSES)
    print("-" * 65)
    print(f"Macro F1-Score: {macro_f1:.2f}\n")

    # 6x6 Confusion Matrix
    print("Confusion Matrix:")
    header = f"{'True \\ Pred':<16} " + " ".join(f"{c[:5]:>7}" for c in INTENT_CLASSES)
    print(header)
    print("-" * len(header))
    for t_cls in INTENT_CLASSES:
        row = f"{t_cls:<16} "
        for p_cls in INTENT_CLASSES:
            count = sum(1 for t, p in zip(y_true, y_pred) if t == t_cls and p == p_cls)
            row += f"{count:>7} "
        print(row)

    # Error analysis
    if errors:
        print("\n" + "=" * 65)
        print(f"⚠️  Misclassifications ({len(errors)} items):")
        print("=" * 65)
        for err in errors:
            print(f"  • \"{err['text']}\" -> Predicted: {err['pred']} (Expected: {err['true']})")
    else:
        print("\n✅ Zero misclassifications on held-out evaluation set!")

    return accuracy, macro_f1, errors


if __name__ == "__main__":
    run_evaluation()
