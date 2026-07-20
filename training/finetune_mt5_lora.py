#!/usr/bin/env python3
"""
LoRA fine-tune google/mt5-base for commercial-safe EN↔NE (Apache-2.0).

Use when IndicTrans2 (MIT) gate is not yet accepted. Smaller quality than NLLB
but redistributable in a commercial iOS app.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

REPO = Path(__file__).resolve().parents[1]
TRAIN = Path(__file__).resolve().parent / "data" / "train_en_ne.jsonl"
VAL = Path(__file__).resolve().parent / "data" / "val_en_ne.jsonl"
OUT = REPO / "training" / "artifacts" / "mt5_base_en_ne_lora"
BASE = "google/mt5-base"


def load_jsonl(path: Path, max_n: int | None = None) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
            if max_n and len(rows) >= max_n:
                break
    return rows


def expand(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        en = (r.get("eng_Latn") or "").strip()
        ne = (r.get("npi_Deva") or "").strip()
        if not en or not ne:
            continue
        tag = ""
        if "तपाईं" in ne or "तपाईँ" in ne:
            tag = "formal "
        elif "तिमी" in ne:
            tag = "informal "
        out.append({"src": f"translate English to Nepali: {tag}{en}", "tgt": ne})
        out.append({"src": f"translate Nepali to English: {ne}", "tgt": en})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-train", type=int, default=20_000)
    ap.add_argument("--max-val", type=int, default=600)
    ap.add_argument("--epochs", type=float, default=1.0)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--grad-accum", type=int, default=4)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--lora-r", type=int, default=16)
    ap.add_argument("--max-length", type=int, default=96)
    ap.add_argument("--eval-steps", type=int, default=400)
    args = ap.parse_args()

    import torch
    from datasets import Dataset
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import (
        AutoModelForSeq2SeqLM,
        AutoTokenizer,
        DataCollatorForSeq2Seq,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
    )

    train_ex = expand(load_jsonl(TRAIN, args.max_train // 2))
    val_ex = expand(load_jsonl(VAL, args.max_val // 2))
    print(f"mt5 train_ex={len(train_ex)} val_ex={len(val_ex)}", flush=True)

    tok = AutoTokenizer.from_pretrained(BASE)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        BASE, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
    )
    lora = LoraConfig(
        task_type=TaskType.SEQ_2_SEQ_LM,
        r=args.lora_r,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q", "v", "k", "o", "wi_0", "wi_1", "wo"],
        bias="none",
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    def tok_fn(examples):
        inputs = tok(examples["src"], max_length=args.max_length, truncation=True)
        labels = tok(text_target=examples["tgt"], max_length=args.max_length, truncation=True)
        inputs["labels"] = labels["input_ids"]
        return inputs

    train_ds = Dataset.from_list(train_ex).map(tok_fn, batched=True, remove_columns=["src", "tgt"])
    val_ds = Dataset.from_list(val_ex).map(tok_fn, batched=True, remove_columns=["src", "tgt"])
    collator = DataCollatorForSeq2Seq(tok, model=model, padding=True)
    OUT.mkdir(parents=True, exist_ok=True)
    targs = Seq2SeqTrainingArguments(
        output_dir=str(OUT / "runs"),
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        num_train_epochs=args.epochs,
        warmup_ratio=0.03,
        logging_steps=50,
        eval_strategy="steps",
        eval_steps=args.eval_steps,
        save_steps=args.eval_steps,
        save_total_limit=2,
        fp16=torch.cuda.is_available(),
        report_to=[],
        remove_unused_columns=False,
        dataloader_num_workers=0,
    )
    trainer = Seq2SeqTrainer(
        model=model,
        args=targs,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        data_collator=collator,
        processing_class=tok,
    )
    trainer.train()
    model.save_pretrained(str(OUT / "adapter"))
    tok.save_pretrained(str(OUT / "adapter"))
    (OUT / "ft_meta.json").write_text(
        json.dumps(
            {
                "base": BASE,
                "license": "apache-2.0",
                "commercial_ship": True,
                "train_ex": len(train_ex),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("saved", OUT / "adapter", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
