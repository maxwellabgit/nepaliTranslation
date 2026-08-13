#!/usr/bin/env python3
"""CPU LoRA fine-tune IndicTrans2 dist-200M on the cleaned meaning mix.

Defaults are for a 4-core / ~15 GB RAM machine with no CUDA:
  batch 1, grad_accum 8, fp16 off, pin_memory off, max_length 64, LoRA r=16.

Saves adapters only. Do not merge_and_unload — it corrupts IndicTrans2.
On-device ship stays base INT8 ONNX until a verified fuse/export path exists.
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
OUT_EN_NE = REPO / "training" / "artifacts" / "it2_cpu_en_ne_lora"
OUT_NE_EN = REPO / "training" / "artifacts" / "it2_cpu_ne_en_lora"


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
    print(
        f"[it2-cpu] === {direction} n_train={len(train_rows)} n_val={len(val_rows)} → {out_dir} ===",
        flush=True,
    )
    if not train_rows:
        raise SystemExit(f"No train rows for {direction}. Run: python training/prepare_cpu_mix.py")

    if args.dry_run:
        print(
            f"[it2-cpu] dry-run  base_exists={model_dir.exists()}  base={model_dir}  "
            f"sample src={train_rows[0].get('src')!r} tgt={train_rows[0].get('tgt')!r}",
            flush=True,
        )
        return

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

    if not model_dir.exists():
        raise FileNotFoundError(
            f"Missing base {model_dir}. Run: python training/download_it2.py"
        )

    ip = IndicProcessor(inference=False)
    tok = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(model_dir),
        trust_remote_code=True,
        torch_dtype=torch.float32,
    )

    names = {n.split(".")[-1] for n, _ in model.named_modules()}
    requested = args.lora_targets.split(",")
    found = [t for t in requested if t in names] or ["q_proj", "v_proj"]
    print(f"[it2-cpu] LoRA targets={found} cuda={torch.cuda.is_available()}", flush=True)

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
    val_ds = make_dataset(val_rows, direction, ip, tok, args.max_length) if val_rows else None
    collator = DataCollatorForSeq2Seq(tok, model=model, padding=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    targs_kw = dict(
        output_dir=str(out_dir / "runs"),
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        num_train_epochs=args.epochs,
        warmup_ratio=0.05,
        logging_steps=10,
        eval_strategy="steps" if val_ds is not None else "no",
        eval_steps=args.eval_steps,
        save_steps=args.eval_steps,
        save_total_limit=2,
        fp16=False,
        bf16=False,
        use_cpu=True,
        dataloader_pin_memory=False,
        gradient_checkpointing=False,
        report_to=[],
        remove_unused_columns=False,
        dataloader_num_workers=0,
        predict_with_generate=False,
    )
    try:
        targs = Seq2SeqTrainingArguments(**targs_kw)
    except TypeError:
        targs_kw.pop("use_cpu", None)
        targs = Seq2SeqTrainingArguments(**targs_kw)
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
        "architecture": "cpu_clean_meaning_mix",
        "control_tokens": ["<en><ne><formal>", "<en><ne><informal>", "<ne><en>"],
        "lora_r": args.lora_r,
        "epochs": args.epochs,
        "train_n": len(train_rows),
        "val_n": len(val_rows),
        "lr": args.lr,
        "max_length": args.max_length,
        "batch_size": args.batch_size,
        "grad_accum": args.grad_accum,
        "adapter_dir": str(adapter_dir),
        "note": "Load with PeftModel.from_pretrained(base, adapter). Do not merge_and_unload.",
    }
    (out_dir / "ft_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[it2-cpu] saved {adapter_dir}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--directions", default="en-ne,ne-en")
    ap.add_argument("--epochs", type=float, default=3.0)
    ap.add_argument("--batch-size", type=int, default=1)
    ap.add_argument("--grad-accum", type=int, default=8)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--lora-r", type=int, default=16)
    ap.add_argument("--lora-alpha", type=int, default=32)
    ap.add_argument("--lora-targets", default="q_proj,v_proj")
    ap.add_argument("--max-length", type=int, default=64)
    ap.add_argument("--eval-steps", type=int, default=50)
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Check mix + base checkpoint exist; do not load weights or train.",
    )
    args = ap.parse_args()

    from benchmarks.hf_login import try_hf_login

    try_hf_login()

    for d in [x.strip() for x in args.directions.split(",") if x.strip()]:
        train_rows = load_jsonl(DATA / f"train_clean_{d}.jsonl")
        val_rows = load_jsonl(DATA / f"val_clean_{d}.jsonl")
        if d == "en-ne":
            train_one(d, EN_INDIC, OUT_EN_NE, train_rows, val_rows, args)
        elif d == "ne-en":
            train_one(d, INDIC_EN, OUT_NE_EN, train_rows, val_rows, args)
        else:
            print("skip", d)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
