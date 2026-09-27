#!/usr/bin/env python3
"""Suggest fills for blank Nepali cells. Does not edit the sheet, the bank, or gold.

Uses the local IndicTrans2 dist-200M English→Devanagari base (the phone model
family). Informal is the app's तिमी rewrite of that Devanagari, not a second
network. Roman is applied later by the app romanizer.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

SHEET = Path(r"c:\Users\maxwe\Downloads\TRAINING - nepali_training_benchmark_review (1).csv")
OUT = REPO / "training" / "data" / "model_fill_suggestions"
BASE = REPO / "training" / "artifacts" / "it2_en_indic_merged"
FIELDS = ("devanagari", "devanagari_informal", "roman", "roman_informal")


def unique_english() -> list[str]:
    with SHEET.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    needed = []
    seen = set()
    for row in rows:
        english = (row.get("english") or "").strip()
        if not english or english in seen:
            continue
        if any(not (row.get(field) or "").strip() for field in FIELDS):
            seen.add(english)
            needed.append(english)
    return needed


def main() -> int:
    import torch
    from IndicTransToolkit import IndicProcessor
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    if not torch.cuda.is_available():
        raise SystemExit("CUDA is required for this fill. Refusing a CPU fallback.")
    texts = unique_english()
    print(f"[fill] unique_english={len(texts)} device={torch.cuda.get_device_name(0)}", flush=True)
    ip = IndicProcessor(inference=True)
    tok = AutoTokenizer.from_pretrained(str(BASE), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(BASE), trust_remote_code=True, torch_dtype=torch.bfloat16
    ).to("cuda").eval()

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "en_formal_deva.jsonl"
    batch_size = 8
    written = 0
    with path.open("w", encoding="utf-8") as handle:
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            processed = ip.preprocess_batch(batch, src_lang="eng_Latn", tgt_lang="npi_Deva")
            inputs = tok(
                processed, return_tensors="pt", padding=True, truncation=True, max_length=128
            ).to("cuda")
            with torch.no_grad():
                generated = model.generate(
                    **inputs, max_new_tokens=96, num_beams=1, do_sample=False
                )
            decoded = tok.batch_decode(
                generated, skip_special_tokens=True, clean_up_tokenization_spaces=True
            )
            try:
                cleaned = ip.postprocess_batch(decoded, lang="npi_Deva")
            except Exception:
                cleaned = decoded
            for english, deva in zip(batch, cleaned):
                text = (deva or "").strip()
                handle.write(
                    json.dumps({"english": english, "devanagari": text}, ensure_ascii=False) + "\n"
                )
                written += 1
            if written % 80 == 0 or start + batch_size >= len(texts):
                print(f"[fill] {written}/{len(texts)}", flush=True)
    print(f"[fill] wrote {path}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
