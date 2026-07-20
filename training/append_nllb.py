#!/usr/bin/env python3
"""Append hotchpotch/nllb-english-bitext-hq npi_Deva into train_en_ne.jsonl."""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

ROOT = Path(__file__).resolve().parents[1]
TRAIN = ROOT / "training" / "data" / "train_en_ne.jsonl"
VAL = ROOT / "training" / "data" / "val_en_ne.jsonl"
MAX_ADD = 30_000

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
LATIN = re.compile(r"[A-Za-z]")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def ok(en: str, ne: str) -> bool:
    en, ne = en.strip(), ne.strip()
    if len(en) < 6 or len(ne) < 6 or len(en) > 400 or len(ne) > 400:
        return False
    script = [c for c in ne if DEVANAGARI.search(c) or LATIN.search(c)]
    if not script:
        return False
    if sum(1 for c in script if DEVANAGARI.search(c)) / len(script) < 0.55:
        return False
    r = len(ne) / max(len(en), 1)
    return 0.3 <= r <= 3.2


def main() -> None:
    from datasets import load_dataset

    seen: set[str] = set()
    for p in (TRAIN, VAL):
        if not p.exists():
            continue
        for line in p.open(encoding="utf-8"):
            r = json.loads(line)
            seen.add(
                hashlib.sha1(
                    f"{norm(r['eng_Latn'])}|{norm(r['npi_Deva'])}".encode()
                ).hexdigest()
            )
    print(f"[nllb] existing keys={len(seen)}", flush=True)

    ds = load_dataset("hotchpotch/nllb-english-bitext-hq", "npi_Deva", split="train")
    print(f"[nllb] dataset n={len(ds)} cols={ds.column_names}", flush=True)

    added: list[dict[str, str]] = []
    printed = False
    for row in ds:
        if not printed:
            print(f"[nllb] sample={dict(row)}", flush=True)
            printed = True
        en = str(
            row.get("english")
            or row.get("eng_Latn")
            or row.get("src_text")
            or row.get("source")
            or row.get("en")
            or row.get("src")
            or ""
        )
        ne = str(
            row.get("translated")
            or row.get("npi_Deva")
            or row.get("tgt_text")
            or row.get("target")
            or row.get("ne")
            or row.get("tgt")
            or ""
        )
        if not en or not ne:
            # dual text fields
            for a, b in (
                ("sentence1", "sentence2"),
                ("en", "ne"),
                ("src_sentence", "tgt_sentence"),
            ):
                if a in row and b in row:
                    en, ne = str(row[a]), str(row[b])
                    break
        if DEVANAGARI.search(en) and not DEVANAGARI.search(ne):
            en, ne = ne, en
        if not ok(en, ne):
            continue
        key = hashlib.sha1(f"{norm(en)}|{norm(ne)}".encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        added.append(
            {"eng_Latn": en.strip(), "npi_Deva": ne.strip(), "source": "nllb_hq"}
        )
        if len(added) >= MAX_ADD:
            break

    with TRAIN.open("a", encoding="utf-8") as f:
        for r in added:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"[nllb] appended={len(added)} → {TRAIN}", flush=True)


if __name__ == "__main__":
    main()
