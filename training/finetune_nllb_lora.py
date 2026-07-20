#!/usr/bin/env python3
"""
LoRA fine-tune facebook/nllb-200-distilled-600M for English ↔ Nepali.

Selected as the strongest ungated Nepali MT base available without AI4Bharat
gate acceptance. License: CC-BY-NC-4.0 — research / eval / internal quality
ceiling. Commercial iOS ship remains IndicTrans2 (MIT) once HF access is granted,
or mT5 (Apache-2.0) as fallback.
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
OUT = REPO / "training" / "artifacts" / "nllb600m_en_ne_lora"
BASE = "facebook/nllb-200-distilled-600M"


def load_jsonl(path: Path, max_n: int | None = None) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
            if max_n and len(rows) >= max_n:
                break
    return rows


def expand_bidirectional(rows: list[dict], formality_tag: bool) -> list[dict]:
    out = []
    for r in rows:
        en = (r.get("eng_Latn") or "").strip()
        ne = (r.get("npi_Deva") or "").strip()
        if not en or not ne:
            continue
        prefix = ""
        if formality_tag:
            if "तपाईं" in ne or "तपाईँ" in ne:
                prefix = "<formal> "
            elif "तिमी" in ne or "तिम्रो" in ne:
                prefix = "<informal> "
        out.append({"src": prefix + en, "tgt": ne, "direction": "en-ne"})
        out.append({"src": ne, "tgt": en, "direction": "ne-en"})
    return out


def tokenize_examples(examples, tok, max_length: int):
    input_ids = []
    attention_mask = []
    labels = []
    for src, tgt, direction in zip(examples["src"], examples["tgt"], examples["direction"]):
        if direction == "en-ne":
            tok.src_lang = "eng_Latn"
            tok.tgt_lang = "npi_Deva"
        else:
            tok.src_lang = "npi_Deva"
            tok.tgt_lang = "eng_Latn"
        enc = tok(src, max_length=max_length, truncation=True)
        with tok.as_target_tokenizer():
            lab = tok(tgt, max_length=max_length, truncation=True)
        input_ids.append(enc["input_ids"])
        attention_mask.append(enc["attention_mask"])
        labels.append(lab["input_ids"])
    return {
        "input_ids": input_ids,
        "attention_mask": attention_mask,
        "labels": labels,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-train", type=int, default=25_000)
    ap.add_argument("--max-val", type=int, default=800)
    ap.add_argument("--epochs", type=float, default=1.0)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--grad-accum", type=int, default=2)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--lora-r", type=int, default=16)
    ap.add_argument("--lora-alpha", type=int, default=32)
    ap.add_argument("--max-length", type=int, default=96)
    ap.add_argument("--eval-steps", type=int, default=400)
    ap.add_argument("--formality-tag", action="store_true", default=True)
    ap.add_argument("--no-formality-tag", action="store_false", dest="formality_tag")
    args = ap.parse_args()

    import subprocess

    for mod, pip in [
        ("peft", "peft"),
        ("accelerate", "accelerate"),
        ("datasets", "datasets"),
        ("transformers", "transformers"),
    ]:
        try:
            __import__(mod)
        except ImportError:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pip])

    from benchmarks.hf_login import load_hf_token
    from huggingface_hub import login

    login(token=load_hf_token(), add_to_git_credential=False)

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

    if not TRAIN.exists():
        print("Missing train data — run prepare_ft_data.py", flush=True)
        return 1

    raw_train = load_jsonl(TRAIN, args.max_train // 2)
    raw_val = load_jsonl(VAL, args.max_val // 2)
    train_ex = expand_bidirectional(raw_train, args.formality_tag)
    val_ex = expand_bidirectional(raw_val, args.formality_tag)
    print(f"train_ex={len(train_ex)} val_ex={len(val_ex)} base={BASE}", flush=True)

    tok = AutoTokenizer.from_pretrained(BASE)
    tok.add_special_tokens({"additional_special_tokens": ["<formal>", "<informal>"]})
    tok.src_lang = "eng_Latn"
    tok.tgt_lang = "npi_Deva"

    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForSeq2SeqLM.from_pretrained(BASE, torch_dtype=dtype)
    model.resize_token_embeddings(len(tok))

    lora = LoraConfig(
        task_type=TaskType.SEQ_2_SEQ_LM,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        target_modules=["q_proj", "v_proj", "k_proj", "out_proj", "fc1", "fc2"],
        bias="none",
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    train_ds = Dataset.from_list(train_ex).map(
        lambda batch: tokenize_examples(batch, tok, args.max_length),
        batched=True,
        batch_size=64,
        remove_columns=["src", "tgt", "direction"],
    )
    val_ds = Dataset.from_list(val_ex).map(
        lambda batch: tokenize_examples(batch, tok, args.max_length),
        batched=True,
        batch_size=64,
        remove_columns=["src", "tgt", "direction"],
    )

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
        predict_with_generate=False,
    )
    kw = dict(
        model=model,
        args=targs,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        data_collator=collator,
    )
    try:
        trainer = Seq2SeqTrainer(**kw, processing_class=tok)
    except TypeError:
        trainer = Seq2SeqTrainer(**kw, tokenizer=tok)
    trainer.train()
    model.save_pretrained(str(OUT / "adapter"))
    tok.save_pretrained(str(OUT / "adapter"))
    meta = {
        "base": BASE,
        "license": "cc-by-nc-4.0",
        "commercial_ship": False,
        "ship_note": "Use IndicTrans2 MIT or mT5 Apache for commercial iOS; NLLB is quality ceiling / research",
        "lora_r": args.lora_r,
        "epochs": args.epochs,
        "train_ex": len(train_ex),
        "val_ex": len(val_ex),
        "formality_tag": args.formality_tag,
        "max_train_pairs": args.max_train // 2,
    }
    (OUT / "ft_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("saved", OUT / "adapter", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
