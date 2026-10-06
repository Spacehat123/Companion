"""
Fine-Tuning Script supporting IBM Granite 4.0 / SmolLM2 via Unsloth / Hugging Face.
Trained to map user natural language utterances to 6 core intents:
NEXT_TRACK, PREVIOUS_TRACK, TAKE_PHOTO, SET_TIMER, CONVERSATION, UNKNOWN.
Uses native tokenizer.apply_chat_template for model-agnostic chat token formatting.
"""

import json
import os
import torch
from datasets import Dataset
from trl import SFTTrainer
from transformers import TrainingArguments

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "../datasets/intent_train.jsonl")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "../models/granite_intent_lora")

SYSTEM_PROMPT = (
    "You are the semantic intent engine for a physical AI companion. "
    "Analyze the user's utterance and output a strict JSON object with: "
    "primary_intent (NEXT_TRACK, PREVIOUS_TRACK, TAKE_PHOTO, SET_TIMER, CONVERSATION, UNKNOWN), "
    "confidence (0.0-1.0), intent_scores (distribution across all 6 classes summing to 1.0), "
    "emotion (happy, curious, annoyed, sleepy, alert, cheeky, neutral), "
    "attention (user, screen, wandering), energy (0.0-1.0), and parameters (duration_sec). "
    "Output ONLY the JSON object."
)


def load_dataset(tokenizer):
    records = []
    with open(DATA_PATH, "r") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))

    formatted = []
    for item in records:
        target_json = json.dumps(item["semantic_state"], separators=(",", ":"))
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": item["text"]},
            {"role": "assistant", "content": target_json},
        ]
        
        # Use native chat template of the model (Granite or SmolLM)
        try:
            text = tokenizer.apply_chat_template(messages, tokenize=False)
        except Exception:
            text = (
                f"<|im_start|>system\n{SYSTEM_PROMPT}<|im_end|>\n"
                f"<|im_start|>user\n{item['text']}<|im_end|>\n"
                f"<|im_start|>assistant\n{target_json}<|im_end|>"
            )
        formatted.append({"text": text})

    return Dataset.from_list(formatted)


def train(model_name: str = "ibm-granite/granite-4.0-micro-instruct"):
    print("=" * 65)
    print(f"🚀 Training {model_name} for Intent Classification")
    print("=" * 65)

    from unsloth import FastLanguageModel

    max_seq_length = 128
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )

    # Configure QLoRA
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    dataset = load_dataset(tokenizer)
    print(f"Loaded {len(dataset)} training examples from {DATA_PATH}.")

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=4,
            gradient_accumulation_steps=2,
            warmup_steps=5,
            max_steps=50,
            learning_rate=2e-4,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=5,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=3407,
            output_dir="outputs",
        ),
    )

    print("Starting training...")
    trainer.train()

    print(f"Saving fine-tuned adapter to {OUTPUT_DIR}...")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("✅ Training complete!")


if __name__ == "__main__":
    import sys
    target_model = sys.argv[1] if len(sys.argv) > 1 else "unsloth/SmolLM2-135M-Instruct"
    train(target_model)
