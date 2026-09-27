#!/usr/bin/env python3
"""Sheet-50 mix and two-checkpoint LoRA.

One row is one meaning: English plus formal Devanagari, informal Devanagari,
formal roman, and informal roman. Rows longer than 50 words are removed.
Gold and public-benchmark English is removed. The kept rows are the training set.

Two adapters, one per existing checkpoint:

  en-indic   English + a target tag  -> one of the four Nepali surfaces
  indic-en   a Nepali surface + its tag -> English

Tags are <formal>/<informal> and <deva>/<roman>. Every non-empty surface of a
kept row is one example. All four surfaces of a meaning stay in the same split.

Default run only writes the set and prints the plan. Pass --train to fit both
adapters on CUDA. Adapters only. Do not merge_and_unload.

  python training/finetune_sheet50.py
  python training/finetune_sheet50.py --train
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from training.prepare_cpu_mix import blocked_text, load_blocklist  # noqa: E402

SHEET = Path(r"C:\Users\maxwe\Downloads\model_fill_suggestions.csv")
REVIEW = Path(r"C:\Users\maxwe\Downloads\TRAINING - nepali_training_benchmark_review (1).csv")
OUT = REPO / "training" / "data" / "sheet50"
DOWNLOAD_CSV = Path(r"C:\Users\maxwe\Downloads\model_fill_suggestions_le50.csv")
EN_INDIC = REPO / "training" / "artifacts" / "it2_en_indic_merged"
INDIC_EN = REPO / "training" / "artifacts" / "it2_indic_en_merged"

FIELDS = ("english", "devanagari", "devanagari_informal", "roman", "roman_informal")
SURFACES = (
    ("formal", "deva", "devanagari"),
    ("informal", "deva", "devanagari_informal"),
    ("formal", "roman", "roman"),
    ("informal", "roman", "roman_informal"),
)
BENCHMARKS = {
    "opus100_test",
    "flores_plus_dev",
    "flores101_dev",
    "in22_conv",
    "bpcc_daily",
}
WORD_CAP = 50
VAL_MOD = 10


def words(text: str) -> int:
    return len([part for part in (text or "").split() if part])


def tag(formality: str, script: str) -> str:
    return f"<{formality}> <{script}>"


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def forbidden_english() -> dict[str, set[str]]:
    """English string -> set names that must not be trained on."""
    found: dict[str, set[str]] = {}
    for row in read_csv(REVIEW):
        name = (row.get("set_name") or "").strip()
        english = (row.get("english") or "").strip()
        if not english or not name:
            continue
        if name.startswith("gold_") or name in BENCHMARKS:
            found.setdefault(english, set()).add(name)
    return found


def keep_row(row: dict, banned: dict[str, set[str]], blocked: set[str]) -> str:
    english = (row.get("english") or "").strip()
    if not english:
        return "empty_english"
    texts = [(row.get(field) or "").strip() for field in FIELDS]
    if any(words(text) > WORD_CAP for text in texts):
        return "over_50_words"
    if "तँ" in " ".join(texts):
        return "tan_pronoun"
    if english in banned:
        return "gold_or_benchmark"
    if blocked_text(blocked, *texts):
        return "gold_blocklist"
    if not any((row.get(field) or "").strip() for _, _, field in SURFACES):
        return "no_nepali"
    return ""


def examples_for(row: dict) -> tuple[list[dict], list[dict]]:
    english = row["english"].strip()
    en_ne: list[dict] = []
    ne_en: list[dict] = []
    for formality, script, field in SURFACES:
        nepali = (row.get(field) or "").strip()
        if not nepali:
            continue
        prefix = tag(formality, script)
        en_ne.append(
            {
                "src": f"{prefix} {english}",
                "tgt": nepali,
                "english": english,
                "formality": formality,
                "script": script,
                "direction": "en-ne",
            }
        )
        ne_en.append(
            {
                "src": f"{prefix} {nepali}",
                "tgt": english,
                "english": english,
                "formality": formality,
                "script": script,
                "direction": "ne-en",
            }
        )
    return en_ne, ne_en


def split_key(english: str) -> str:
    return hashlib.sha1(english.encode("utf-8")).hexdigest()


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )


def write_sheet(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(FIELDS))
        writer.writeheader()
        for row in rows:
            writer.writerow({field: (row.get(field) or "").strip() for field in FIELDS})


def prepare(sheet: Path) -> dict:
    banned = forbidden_english()
    blocked = load_blocklist()
    raw = read_csv(sheet)
    reasons: Counter[str] = Counter()
    kept: list[dict] = []
    for row in raw:
        reason = keep_row(row, banned, blocked)
        if reason:
            reasons[reason] += 1
            continue
        kept.append({field: (row.get(field) or "").strip() for field in FIELDS})

    train_en: list[dict] = []
    val_en: list[dict] = []
    train_ne: list[dict] = []
    val_ne: list[dict] = []
    for row in kept:
        en_ne, ne_en = examples_for(row)
        val = int(split_key(row["english"]), 16) % VAL_MOD == 0
        (val_en if val else train_en).extend(en_ne)
        (val_ne if val else train_ne).extend(ne_en)

    OUT.mkdir(parents=True, exist_ok=True)
    write_sheet(OUT / "training_set.csv", kept)
    write_sheet(DOWNLOAD_CSV, kept)
    write_jsonl(OUT / "train_en-ne.jsonl", train_en)
    write_jsonl(OUT / "val_en-ne.jsonl", val_en)
    write_jsonl(OUT / "train_ne-en.jsonl", train_ne)
    write_jsonl(OUT / "val_ne-en.jsonl", val_ne)

    def tally(rows: list[dict]) -> dict:
        counts = Counter((row["formality"], row["script"]) for row in rows)
        return {
            "rows": len(rows),
            "meanings": len({row["english"] for row in rows}),
            "by_surface": {f"{formality}_{script}": count for (formality, script), count in sorted(counts.items())},
        }

    manifest = {
        "source_sheet": str(sheet),
        "word_cap": WORD_CAP,
        "input_rows": len(raw),
        "kept_rows": len(kept),
        "dropped": dict(reasons),
        "en_ne": {"train": tally(train_en), "val": tally(val_en)},
        "ne_en": {"train": tally(train_ne), "val": tally(val_ne)},
        "bases": {"en-ne": str(EN_INDIC), "ne-en": str(INDIC_EN)},
        "note": "Adapters only. Gold and public benchmarks excluded. Model suggestions are not human-approved.",
    }
    (OUT / "prepare_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2, ensure_ascii=False), flush=True)
    return manifest


def make_dataset(rows: list[dict], direction: str, ip, tokenizer, max_length: int):
    from datasets import Dataset

    if direction == "en-ne":
        src_lang, tgt_lang = "eng_Latn", "npi_Deva"
    else:
        src_lang, tgt_lang = "npi_Deva", "eng_Latn"
    processed = ip.preprocess_batch([row["src"] for row in rows], src_lang=src_lang, tgt_lang=tgt_lang)
    encoded = tokenizer(processed, max_length=max_length, truncation=True, padding=False)
    try:
        labels = tokenizer(
            text_target=[row["tgt"] for row in rows],
            max_length=max_length,
            truncation=True,
            padding=False,
        )
    except TypeError:
        labels = tokenizer(
            [row["tgt"] for row in rows],
            max_length=max_length,
            truncation=True,
            padding=False,
        )
    truncated = sum(1 for ids in labels["input_ids"] if len(ids) >= max_length)
    print(f"[sheet50] {direction} label_rows_at_cap={truncated}/{len(rows)}", flush=True)
    return Dataset.from_dict(
        {
            "input_ids": encoded["input_ids"],
            "attention_mask": encoded["attention_mask"],
            "labels": labels["input_ids"],
        }
    )


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

    if not torch.cuda.is_available():
        raise SystemExit("CUDA is required. Refusing a CPU fallback.")
    if not model_dir.exists():
        raise SystemExit(f"Missing base checkpoint: {model_dir}")
    if out_dir.exists():
        raise SystemExit(f"Refusing to overwrite {out_dir}")

    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    print(
        f"[sheet50] {direction} device={torch.cuda.get_device_name(0)} dtype={dtype} "
        f"train={len(train_rows)} val={len(val_rows)}",
        flush=True,
    )
    processor = IndicProcessor(inference=False)
    tokenizer = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(model_dir), trust_remote_code=True, torch_dtype=dtype
    ).to("cuda")
    names = {name.split(".")[-1] for name, _ in model.named_modules()}
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
    trainable = sum(param.numel() for param in model.parameters() if param.requires_grad)
    if trainable <= 0:
        raise SystemExit("LoRA attached no trainable parameters")
    print(f"[sheet50] trainable_params={trainable}", flush=True)

    train_ds = make_dataset(train_rows, direction, processor, tokenizer, 128)
    val_ds = make_dataset(val_rows, direction, processor, tokenizer, 128) if val_rows else None
    collator = DataCollatorForSeq2Seq(tokenizer, model=model, padding=True)
    out_dir.mkdir(parents=True, exist_ok=False)
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
    kwargs = dict(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        data_collator=collator,
    )
    try:
        trainer = Seq2SeqTrainer(**kwargs, processing_class=tokenizer)
    except TypeError:
        trainer = Seq2SeqTrainer(**kwargs, tokenizer=tokenizer)
    trainer.train()
    adapter_dir = out_dir / "adapter"
    model.save_pretrained(str(adapter_dir))
    tokenizer.save_pretrained(str(adapter_dir))
    note = {
        "direction": direction,
        "base": str(model_dir),
        "trainable_params": trainable,
        "train_rows": len(train_rows),
        "val_rows": len(val_rows),
        "adapter_dir": str(adapter_dir),
        "note": "Load with PeftModel.from_pretrained. Do not merge_and_unload.",
    }
    (out_dir / "run_manifest.json").write_text(json.dumps(note, indent=2) + "\n", encoding="utf-8")
    print(f"[sheet50] saved {adapter_dir}", flush=True)


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def train_both() -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    root = REPO / "training" / "artifacts" / f"sheet50_{stamp}"
    for direction, model_dir, train_name, val_name in (
        ("en-ne", EN_INDIC, "train_en-ne.jsonl", "val_en-ne.jsonl"),
        ("ne-en", INDIC_EN, "train_ne-en.jsonl", "val_ne-en.jsonl"),
    ):
        train_rows = load_jsonl(OUT / train_name)
        val_rows = load_jsonl(OUT / val_name)
        if not train_rows:
            raise SystemExit(f"No training rows for {direction}. Run prepare first.")
        train_direction(direction, model_dir, root / direction, train_rows, val_rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare the 50-word sheet and optionally train both checkpoints.")
    parser.add_argument("--sheet", type=Path, default=SHEET)
    parser.add_argument("--train", action="store_true", help="Fit both LoRA adapters on CUDA after preparing the set.")
    args = parser.parse_args()
    random.seed(42)
    prepare(args.sheet)
    if args.train:
        train_both()
    else:
        print("[sheet50] prepared only. Re-run with --train to fit both adapters.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
