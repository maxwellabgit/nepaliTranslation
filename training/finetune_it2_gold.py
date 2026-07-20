#!/usr/bin/env python3
"""
LoRA fine-tune IndicTrans2 dist-200M (MIT, commercial-safe) for gold-domain EN↔NE.

Trains:
  EN→NE with optional <formal>/<informal> text prefixes (no vocab resize)
  NE→EN including romanized Nepali sources

Outputs merged checkpoints ready for ONNX export under training/artifacts/.
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

TRAIN = Path(__file__).resolve().parent / "data" / "train_gold_domain.jsonl"
VAL = Path(__file__).resolve().parent / "data" / "val_gold_domain.jsonl"
ROMAN = Path(__file__).resolve().parent / "data" / "train_roman_ne_en.jsonl"
EN_INDIC = REPO / "training" / "artifacts" / "it2_en_indic_merged"
INDIC_EN = REPO / "training" / "artifacts" / "it2_indic_en_merged"
OUT_EN_NE = REPO / "training" / "artifacts" / "it2_en_indic_gold_ft"
OUT_NE_EN = REPO / "training" / "artifacts" / "it2_indic_en_gold_ft"


def load_jsonl(path: Path, max_n: int | None = None) -> list[dict]:
    rows = []
    if not path.exists():
        return rows
    with path.open(encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
            if max_n and len(rows) >= max_n:
                break
    return rows


def prefix_en(en: str, formality: str) -> str:
    if formality == "formal":
        return f"<formal> {en}"
    if formality == "informal":
        return f"<informal> {en}"
    return en


def make_dataset(rows: list[dict], direction: str, ip, tokenizer, max_length: int):
    from datasets import Dataset

    src_texts: list[str] = []
    tgt_texts: list[str] = []
    if direction == "en-ne":
        src_lang, tgt_lang = "eng_Latn", "npi_Deva"
        for r in rows:
            src_texts.append(prefix_en(r["eng_Latn"], r.get("formality", "neutral")))
            tgt_texts.append(r["npi_Deva"])
    else:
        src_lang, tgt_lang = "npi_Deva", "eng_Latn"
        for r in rows:
            src_texts.append(r["npi_Deva"])
            tgt_texts.append(r["eng_Latn"])
            if r.get("npi_Roman"):
                src_texts.append(r["npi_Roman"])
                tgt_texts.append(r["eng_Latn"])

    input_ids: list[list[int]] = []
    attention_mask: list[list[int]] = []
    label_ids: list[list[int]] = []
    bs = 128
    for i in range(0, len(src_texts), bs):
        chunk_src = src_texts[i : i + bs]
        chunk_tgt = tgt_texts[i : i + bs]
        processed = ip.preprocess_batch(chunk_src, src_lang=src_lang, tgt_lang=tgt_lang)
        enc = tokenizer(processed, max_length=max_length, truncation=True, padding=False)
        try:
            lab = tokenizer(
                text_target=chunk_tgt,
                max_length=max_length,
                truncation=True,
                padding=False,
            )
        except TypeError:
            lab = tokenizer(chunk_tgt, max_length=max_length, truncation=True, padding=False)
        input_ids.extend(enc["input_ids"])
        attention_mask.extend(enc["attention_mask"])
        label_ids.extend(lab["input_ids"])

    return Dataset.from_dict(
        {"input_ids": input_ids, "attention_mask": attention_mask, "labels": label_ids}
    )


def train_one(
    direction: str,
    model_dir: Path,
    out_dir: Path,
    train_rows: list[dict],
    val_rows: list[dict],
    args: argparse.Namespace,
) -> None:
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

    print(f"[it2-gold] === {direction} {model_dir} → {out_dir} ===", flush=True)
    if not model_dir.exists():
        raise SystemExit(f"Missing base model at {model_dir}")

    ip = IndicProcessor(inference=True)
    tok = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(model_dir), trust_remote_code=True, torch_dtype=dtype
    )

    # Discover LoRA modules
    names = {n.split(".")[-1] for n, _ in model.named_modules()}
    requested = args.lora_targets.split(",")
    found = [t for t in requested if t in names]
    if not found:
        all_mod = [n for n, _ in model.named_modules()]
        for frag in ("q_proj", "v_proj", "k_proj", "out_proj", "o_proj", "fc1", "fc2"):
            if any(frag in n for n in all_mod):
                found.append(frag)
        found = found or ["q_proj", "v_proj"]
    print(f"[it2-gold] LoRA targets={found}", flush=True)

    lora = LoraConfig(
        task_type=TaskType.SEQ_2_SEQ_LM,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        target_modules=found,
        bias="none",
    )
    model = get_peft_model(model, lora)
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
        warmup_ratio=0.04,
        logging_steps=40,
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

    # Save LoRA adapters only. IndicTrans2 merge_and_unload corrupts generation.
    adapter_dir = out_dir / "adapter"
    adapter_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(adapter_dir))
    tok.save_pretrained(str(adapter_dir))

    meta = {
        "direction": direction,
        "base": str(model_dir),
        "license": "MIT (IndicTrans2)",
        "commercial_ship": True,
        "lora_r": args.lora_r,
        "epochs": args.epochs,
        "train_n": len(train_rows),
        "val_n": len(val_rows),
        "lr": args.lr,
        "adapter_dir": str(adapter_dir),
        "note": "Load with PeftModel.from_pretrained(base, adapter_dir). Do not merge_and_unload.",
    }
    (out_dir / "ft_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[it2-gold] saved adapter {adapter_dir}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--directions", default="en-ne,ne-en")
    ap.add_argument("--max-train", type=int, default=20_000)
    ap.add_argument("--max-val", type=int, default=600)
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--batch-size", type=int, default=6)
    ap.add_argument("--grad-accum", type=int, default=4)
    ap.add_argument("--lr", type=float, default=8e-5)
    ap.add_argument("--lora-r", type=int, default=16)
    ap.add_argument("--lora-alpha", type=int, default=32)
    ap.add_argument("--lora-targets", default="q_proj,v_proj,k_proj,o_proj,fc1,fc2")
    ap.add_argument("--max-length", type=int, default=96)
    ap.add_argument("--eval-steps", type=int, default=300)
    args = ap.parse_args()

    import subprocess

    for mod, pip in [
        ("peft", "peft"),
        ("accelerate", "accelerate"),
        ("datasets", "datasets"),
        ("transformers", "transformers"),
        ("IndicTransToolkit", "IndicTransToolkit"),
    ]:
        try:
            __import__(mod)
        except ImportError:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pip])

    from benchmarks.hf_login import load_hf_token
    from huggingface_hub import login

    login(token=load_hf_token(), add_to_git_credential=False)

    if not TRAIN.exists():
        print("Run prepare_gold_domain_data.py first", flush=True)
        return 1

    train_rows = load_jsonl(TRAIN, args.max_train)
    val_rows = load_jsonl(VAL, args.max_val)
    # Attach roman views into ne-en training by merging roman file fields
    roman = load_jsonl(ROMAN, 4000)
    roman_by_ne = {r["npi_Deva"]: r.get("npi_Roman") for r in roman if r.get("npi_Roman")}
    for r in train_rows:
        if r["npi_Deva"] in roman_by_ne:
            r["npi_Roman"] = roman_by_ne[r["npi_Deva"]]

    print(f"[it2-gold] train={len(train_rows)} val={len(val_rows)}", flush=True)

    for d in [x.strip() for x in args.directions.split(",") if x.strip()]:
        if d == "en-ne":
            train_one(d, EN_INDIC, OUT_EN_NE, train_rows, val_rows, args)
        elif d == "ne-en":
            train_one(d, INDIC_EN, OUT_NE_EN, train_rows, val_rows, args)
        else:
            print("skip", d, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
