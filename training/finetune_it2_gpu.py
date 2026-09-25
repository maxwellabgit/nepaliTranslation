#!/usr/bin/env python3
"""E1 baseline: GPU LoRA on the existing curated mix.

Fails closed if CUDA is missing, if any train row matches the gold blocklist,
or if a row has a provenance outside the approved set. Saves adapters only.
Does not merge weights and does not rewrite the meaning bank.
"""
from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import sys

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
DATA = Path(__file__).resolve().parent / "data"
EN_INDIC = REPO / "training" / "artifacts" / "it2_en_indic_merged"
INDIC_EN = REPO / "training" / "artifacts" / "it2_indic_en_merged"

import training.prepare_cpu_mix as mix  # noqa: E402
from training.finetune_it2_cpu import load_jsonl, make_dataset  # noqa: E402


def dataset_manifest(rows: list[dict]) -> dict:
    blocked = mix.load_blocklist()
    overlap = 0
    unapproved = 0
    for row in rows:
        if mix.blocked_text(blocked, row.get("src") or "", row.get("tgt") or ""):
            overlap += 1
        if (row.get("provenance") or "") not in mix.KEEP_PROVENANCE:
            unapproved += 1
    return {
        "rows": len(rows),
        "meanings": len({row.get("meaning_id") for row in rows}),
        "gold_overlap": overlap,
        "unapproved_rows": unapproved,
    }


def train_direction(direction: str, model_dir: Path, out_dir: Path, train_rows: list[dict], val_rows: list[dict]) -> None:
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

    assert torch.cuda.is_available(), "GPU run must not fall back to CPU"
    manifest = dataset_manifest(train_rows + val_rows)
    assert manifest["gold_overlap"] == 0
    assert manifest["unapproved_rows"] == 0

    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    print(
        f"[it2-gpu] {direction} device={torch.cuda.get_device_name(0)} dtype={dtype} "
        f"train={len(train_rows)} val={len(val_rows)} meanings={manifest['meanings']}",
        flush=True,
    )
    ip = IndicProcessor(inference=False)
    tok = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(model_dir), trust_remote_code=True, torch_dtype=dtype
    ).to("cuda")
    names = {n.split(".")[-1] for n, _ in model.named_modules()}
    targets = [name for name in ("q_proj", "v_proj") if name in names]
    if targets != ["q_proj", "v_proj"]:
        raise SystemExit(f"missing LoRA targets, found {sorted(names)}")
    model = get_peft_model(
        model,
        LoraConfig(
            task_type=TaskType.SEQ_2_SEQ_LM,
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            target_modules=targets,
            bias="none",
        ),
    )
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    if trainable <= 0:
        raise SystemExit("LoRA attached no trainable parameters")
    print(f"[it2-gpu] trainable_params={trainable}", flush=True)

    train_ds = make_dataset(train_rows, direction, ip, tok, 96)
    val_ds = make_dataset(val_rows, direction, ip, tok, 96) if val_rows else None
    collator = DataCollatorForSeq2Seq(tok, model=model, padding=True)
    out_dir.mkdir(parents=True, exist_ok=False)
    started = time.time()
    args = Seq2SeqTrainingArguments(
        output_dir=str(out_dir / "runs"),
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        gradient_accumulation_steps=4,
        learning_rate=1e-4,
        weight_decay=0.01,
        num_train_epochs=2,
        warmup_ratio=0.05,
        logging_steps=10,
        eval_strategy="epoch" if val_ds is not None else "no",
        save_strategy="epoch",
        save_total_limit=2,
        bf16=dtype == torch.bfloat16,
        fp16=dtype == torch.float16,
        use_cpu=False,
        dataloader_pin_memory=True,
        dataloader_num_workers=2,
        report_to=[],
        remove_unused_columns=False,
        predict_with_generate=False,
        seed=42,
    )
    kw = dict(model=model, args=args, train_dataset=train_ds, eval_dataset=val_ds, data_collator=collator)
    try:
        trainer = Seq2SeqTrainer(**kw, processing_class=tok)
    except TypeError:
        trainer = Seq2SeqTrainer(**kw, tokenizer=tok)
    trainer.train()
    adapter_dir = out_dir / "adapter"
    model.save_pretrained(str(adapter_dir))
    tok.save_pretrained(str(adapter_dir))
    peak = torch.cuda.max_memory_allocated() / (1024 ** 2)
    run_manifest = {
        "experiment": "E1",
        "direction": direction,
        "base": str(model_dir),
        "dtype": str(dtype).replace("torch.", ""),
        "device": torch.cuda.get_device_name(0),
        "lora": {"r": 16, "alpha": 32, "dropout": 0.05, "targets": targets},
        "epochs": 2,
        "microbatch": 8,
        "grad_accum": 4,
        "lr": 1e-4,
        "max_length": 96,
        "trainable_params": trainable,
        "dataset": manifest,
        "wall_seconds": round(time.time() - started, 1),
        "peak_vram_mib": round(peak, 1),
        "adapter_dir": str(adapter_dir),
        "note": "Load with PeftModel.from_pretrained. Do not merge_and_unload.",
    }
    (out_dir / "run_manifest.json").write_text(
        json.dumps(run_manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"[it2-gpu] saved {adapter_dir} peak_vram_mib={peak:.0f}", flush=True)


def main() -> int:
    assert __import__("torch").cuda.is_available(), "GPU run must not fall back to CPU"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    root = REPO / "training" / "artifacts" / f"e1_gpu_baseline_{stamp}"
    for direction, model_dir in (("en-ne", EN_INDIC), ("ne-en", INDIC_EN)):
        train_rows = load_jsonl(DATA / f"train_clean_{direction}.jsonl")
        val_rows = load_jsonl(DATA / f"val_clean_{direction}.jsonl")
        if not train_rows:
            raise SystemExit(f"missing train rows for {direction}")
        train_direction(direction, model_dir, root / direction, train_rows, val_rows)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
