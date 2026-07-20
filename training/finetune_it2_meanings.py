#!/usr/bin/env python3
"""
LoRA fine-tune IndicTrans2 on meaning-bank controlled examples (≤10k).

Control tokens at the start of the source (canonical architecture):
  <en><ne><formal> …   → Devanagari formal
  <en><ne><informal> … → Devanagari informal (तिमी)
  <ne><en> …           → English

Roman is NOT a separate MT model — trained lightly for noisy input only;
inference uses roman→Devanagari normalize then this model.
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
sys.path.insert(0, str(REPO))

DATA = Path(__file__).resolve().parent / "data"
EN_INDIC = REPO / "training" / "artifacts" / "it2_en_indic_merged"
INDIC_EN = REPO / "training" / "artifacts" / "it2_indic_en_merged"
OUT_EN_NE = REPO / "training" / "artifacts" / "it2_meanings_en_ne_lora"
OUT_NE_EN = REPO / "training" / "artifacts" / "it2_meanings_ne_en_lora"


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def make_dataset(rows: list[dict], direction: str, ip, tokenizer, max_length: int):
    from datasets import Dataset

    if direction == "en-ne":
        src_lang, tgt_lang = "eng_Latn", "npi_Deva"
    else:
        src_lang, tgt_lang = "npi_Deva", "eng_Latn"

    src_texts = [r["src"] for r in rows]
    tgt_texts = [r["tgt"] for r in rows]

    # IndicProcessor adds language tags; keep <formal>/<informal> on the
    # plain English string (same pattern as finetune_it2_gold.py).
    processed = ip.preprocess_batch(src_texts, src_lang=src_lang, tgt_lang=tgt_lang)
    enc = tokenizer(processed, max_length=max_length, truncation=True, padding=False)
    try:
        lab = tokenizer(text_target=tgt_texts, max_length=max_length, truncation=True, padding=False)
    except TypeError:
        lab = tokenizer(tgt_texts, max_length=max_length, truncation=True, padding=False)

    return Dataset.from_dict(
        {
            "input_ids": enc["input_ids"],
            "attention_mask": enc["attention_mask"],
            "labels": lab["input_ids"],
        }
    )


def train_one(direction: str, model_dir: Path, out_dir: Path, train_rows: list[dict], val_rows: list[dict], args):
    import torch
    from IndicTransToolkit import IndicProcessor
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import (
        AutoModelForSeq2SeqLM,
        AutoTokenizer,
        DataCollatorForSeq2Seq,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
    )

    print(f"[it2-meanings] === {direction} n_train={len(train_rows)} → {out_dir} ===", flush=True)
    if not model_dir.exists():
        raise FileNotFoundError(model_dir)

    ip = IndicProcessor(inference=False)
    tok = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(model_dir),
        trust_remote_code=True,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    )

    names = {n.split(".")[-1] for n, _ in model.named_modules()}
    requested = args.lora_targets.split(",")
    found = [t for t in requested if t in names] or ["q_proj", "v_proj"]
    print(f"[it2-meanings] LoRA targets={found}", flush=True)

    model = get_peft_model(
        model,
        LoraConfig(
            task_type=TaskType.SEQ_2_SEQ_LM,
            r=args.lora_r,
            lora_alpha=args.lora_alpha,
            lora_dropout=0.05,
            target_modules=found,
            bias="none",
        ),
    )
    model.print_trainable_parameters()

    train_ds = make_dataset(train_rows, direction, ip, tok, args.max_length)
    val_ds = make_dataset(val_rows, direction, ip, tok, args.max_length)
    collator = DataCollatorForSeq2Seq(tok, model=model, padding=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    targs = Seq2SeqTrainingArguments(
        output_dir=str(out_dir / "runs"),
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        num_train_epochs=args.epochs,
        warmup_ratio=0.05,
        logging_steps=25,
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

    adapter_dir = out_dir / "adapter"
    adapter_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(adapter_dir))
    tok.save_pretrained(str(adapter_dir))
    meta = {
        "direction": direction,
        "base": str(model_dir),
        "license": "MIT (IndicTrans2)",
        "commercial_ship": True,
        "architecture": "meaning_bank_controlled_devanagari",
        "control_tokens": ["<en><ne><formal>", "<en><ne><informal>", "<ne><en>"],
        "lora_r": args.lora_r,
        "epochs": args.epochs,
        "train_n": len(train_rows),
        "val_n": len(val_rows),
        "lr": args.lr,
        "max_length": args.max_length,
        "adapter_dir": str(adapter_dir),
        "note": "Load with PeftModel.from_pretrained(base, adapter). Do not merge_and_unload.",
    }
    (out_dir / "ft_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[it2-meanings] saved {adapter_dir}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--directions", default="en-ne,ne-en")
    ap.add_argument("--epochs", type=float, default=3.0)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--grad-accum", type=int, default=2)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--lora-r", type=int, default=16)
    ap.add_argument("--lora-alpha", type=int, default=32)
    ap.add_argument("--lora-targets", default="q_proj,v_proj,k_proj,o_proj,fc1,fc2")
    ap.add_argument("--max-length", type=int, default=96)
    ap.add_argument("--eval-steps", type=int, default=150)
    args = ap.parse_args()

    from benchmarks.hf_login import load_hf_token
    from huggingface_hub import login

    login(token=load_hf_token(), add_to_git_credential=False)

    for d in [x.strip() for x in args.directions.split(",") if x.strip()]:
        if d == "en-ne":
            train_rows = load_jsonl(DATA / "train_meanings_en_ne.jsonl")
            val_rows = load_jsonl(DATA / "val_meanings_en_ne.jsonl")
            train_one(d, EN_INDIC, OUT_EN_NE, train_rows, val_rows, args)
        elif d == "ne-en":
            train_rows = load_jsonl(DATA / "train_meanings_ne_en.jsonl")
            val_rows = load_jsonl(DATA / "val_meanings_ne_en.jsonl")
            train_one(d, INDIC_EN, OUT_NE_EN, train_rows, val_rows, args)
        else:
            print("skip", d)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
