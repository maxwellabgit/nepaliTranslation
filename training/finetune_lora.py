#!/usr/bin/env python3
"""
LoRA fine-tune IndicTrans2 for English ↔ Nepali (Devanagari).

Trains two adapters (or full LoRA on each merged checkpoint):
  - EN→NE: training/artifacts/it2_en_indic_merged
  - NE→EN: training/artifacts/it2_indic_en_merged

Uses training/data/train_en_ne.jsonl from prepare_ft_data.py.
Saves to training/artifacts/it2_*_ne_ft/
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

TRAIN = Path(__file__).resolve().parent / "data" / "train_en_ne.jsonl"
VAL = Path(__file__).resolve().parent / "data" / "val_en_ne.jsonl"
EN_INDIC = REPO / "training" / "artifacts" / "it2_en_indic_merged"
INDIC_EN = REPO / "training" / "artifacts" / "it2_indic_en_merged"
OUT_EN_NE = REPO / "training" / "artifacts" / "it2_en_indic_ne_ft"
OUT_NE_EN = REPO / "training" / "artifacts" / "it2_indic_en_ne_ft"


def _ensure() -> None:
    import subprocess

    need = []
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
            need.append(pip)
    if need:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *need])


def load_jsonl(path: Path, max_n: int | None = None) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
            if max_n and len(rows) >= max_n:
                break
    return rows


def make_dataset(rows: list[dict], direction: str, ip, tokenizer, max_length: int = 128):
    """direction: en-ne | ne-en"""
    from datasets import Dataset

    src_lang = "eng_Latn" if direction == "en-ne" else "npi_Deva"
    tgt_lang = "npi_Deva" if direction == "en-ne" else "eng_Latn"
    src_key = "eng_Latn" if direction == "en-ne" else "npi_Deva"
    tgt_key = "npi_Deva" if direction == "en-ne" else "eng_Latn"

    src_texts = [r[src_key] for r in rows]
    tgt_texts = [r[tgt_key] for r in rows]

    input_ids: list[list[int]] = []
    attention_mask: list[list[int]] = []
    label_ids: list[list[int]] = []
    bs = 256
    for i in range(0, len(src_texts), bs):
        chunk_src = src_texts[i : i + bs]
        chunk_tgt = tgt_texts[i : i + bs]
        processed = ip.preprocess_batch(chunk_src, src_lang=src_lang, tgt_lang=tgt_lang)
        enc = tokenizer(
            processed,
            max_length=max_length,
            truncation=True,
            padding=False,
        )
        # Decoder labels: tokenize target text (IndicTrans2 training style)
        try:
            lab = tokenizer(
                text_target=chunk_tgt,
                max_length=max_length,
                truncation=True,
                padding=False,
            )
        except TypeError:
            lab = tokenizer(
                chunk_tgt,
                max_length=max_length,
                truncation=True,
                padding=False,
            )
        input_ids.extend(enc["input_ids"])
        attention_mask.extend(enc["attention_mask"])
        label_ids.extend(lab["input_ids"])

    return Dataset.from_dict(
        {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
            "labels": label_ids,
        }
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
    from peft import LoraConfig, get_peft_model, TaskType
    from transformers import (
        AutoModelForSeq2SeqLM,
        AutoTokenizer,
        DataCollatorForSeq2Seq,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
    )

    print(f"[ft] === {direction} base={model_dir} → {out_dir} ===", flush=True)
    ip = IndicProcessor(inference=True)
    tok = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(model_dir),
        trust_remote_code=True,
        torch_dtype=dtype,
    )

    lora = LoraConfig(
        task_type=TaskType.SEQ_2_SEQ_LM,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        target_modules=args.lora_targets.split(","),
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
        warmup_ratio=0.03,
        logging_steps=50,
        eval_strategy="steps",
        eval_steps=args.eval_steps,
        save_steps=args.eval_steps,
        save_total_limit=2,
        fp16=torch.cuda.is_available(),
        predict_with_generate=False,
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
        tokenizer=tok,
    )
    trainer.train()
    # Merge LoRA into base for easy TranslationManager loading
    merged = model.merge_and_unload()
    merged.save_pretrained(str(out_dir))
    tok.save_pretrained(str(out_dir))
    # Copy custom modeling files from base
    for name in (
        "configuration_indictrans.py",
        "modeling_indictrans.py",
        "tokenization_indictrans.py",
        "dict.SRC.json",
        "dict.TGT.json",
        "model.SRC",
        "model.TGT",
        "generation_config.json",
        "special_tokens_map.json",
        "tokenizer_config.json",
        "config.json",
    ):
        src = model_dir / name
        if src.exists():
            dst = out_dir / name
            if not dst.exists() or name.endswith(".py"):
                dst.write_bytes(src.read_bytes())
    meta = {
        "direction": direction,
        "base": str(model_dir),
        "lora_r": args.lora_r,
        "epochs": args.epochs,
        "train_n": len(train_rows),
        "val_n": len(val_rows),
    }
    (out_dir / "ft_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[ft] Saved merged model → {out_dir}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--directions", default="en-ne,ne-en")
    ap.add_argument("--max-train", type=int, default=30_000, help="Cap train rows per direction")
    ap.add_argument("--max-val", type=int, default=500)
    ap.add_argument("--epochs", type=float, default=1.0)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--grad-accum", type=int, default=4)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--lora-r", type=int, default=16)
    ap.add_argument("--lora-alpha", type=int, default=32)
    ap.add_argument(
        "--lora-targets",
        default="q_proj,v_proj,k_proj,o_proj,fc1,fc2",
        help="Comma-separated module name fragments; adjusted if missing",
    )
    ap.add_argument("--max-length", type=int, default=128)
    ap.add_argument("--eval-steps", type=int, default=400)
    args = ap.parse_args()

    _ensure()
    if not TRAIN.exists():
        print("[ft] Missing train data — run prepare_ft_data.py first", flush=True)
        return 1

    train_rows = load_jsonl(TRAIN, args.max_train)
    val_rows = load_jsonl(VAL, args.max_val)
    print(f"[ft] train={len(train_rows)} val={len(val_rows)}", flush=True)

    # Probe LoRA target modules on first model
    import torch
    from transformers import AutoModelForSeq2SeqLM

    probe = AutoModelForSeq2SeqLM.from_pretrained(
        str(EN_INDIC), trust_remote_code=True, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
    )
    names = {n.split(".")[-1] for n, _ in probe.named_modules()}
    requested = args.lora_targets.split(",")
    found = [t for t in requested if t in names]
    if not found:
        # IndicTrans often uses q_proj style inside encoder layers — search substrings
        all_mod = [n for n, _ in probe.named_modules()]
        cand = []
        for frag in ("q_proj", "v_proj", "k_proj", "out_proj", "fc1", "fc2", "linear1", "linear2"):
            if any(frag in n for n in all_mod):
                cand.append(frag)
        found = cand or ["q_proj", "v_proj"]
        print(f"[ft] Adjusted LoRA targets → {found}", flush=True)
    args.lora_targets = ",".join(found)
    del probe
    torch.cuda.empty_cache()

    for d in [x.strip() for x in args.directions.split(",") if x.strip()]:
        if d == "en-ne":
            train_one(d, EN_INDIC, OUT_EN_NE, train_rows, val_rows, args)
        elif d == "ne-en":
            train_one(d, INDIC_EN, OUT_NE_EN, train_rows, val_rows, args)
        else:
            print(f"[ft] skip unknown direction {d}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
