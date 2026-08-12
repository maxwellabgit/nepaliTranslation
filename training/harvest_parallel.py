#!/usr/bin/env python3
"""Pull extra NE↔EN parallel data we don't already train on.

Existing train_en_ne.jsonl is almost entirely OPUS-100 software strings
(KDE/GNOME UI). That is the wrong domain for a traveler/conversation app.

This script fetches:
  - Titung/nepali-english-parallel (Apache-2.0, ~161k, mostly formal/legal)
    and keeps short sentence-like pairs as a future FT seed.

  Notes on other corpora (not downloaded here — too large / gated):
  - ai4bharat/BPCC          mined web bitext, includes npi_Deva; best next FT mix
  - facebook/flores_plus    2009-sentence eval set, npi_Deva (use as held-out)
  - Helsinki-NLP/opus-100   already ingested (and is the noisy majority)
  - NLLB bitext             overlap with OPUS; skip unless we filter hard

Usage:
    python training/harvest_parallel.py
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent / "data" / "external"
DEVANAGARI = re.compile(r"[\u0900-\u097F]")
LATIN = re.compile(r"[A-Za-z]")
LEGAL = re.compile(
    r"दफा|उपदफा|कार्यविधि|महालेखा|विनियम|ऐन\b|प्रदेश सरकार|राजपत्र"
)

# Dataset Viewer parquet for the train split (Apache-2.0).
TITUNG_PARQUET = (
    "https://huggingface.co/datasets/Titung/nepali-english-parallel/"
    "resolve/main/data/train-00000-of-00001.parquet"
)


def word_count(s: str) -> int:
    return len(re.findall(r"\S+", s or ""))


def keep(ne: str, en: str) -> bool:
    ne, en = (ne or "").strip(), (en or "").strip()
    if not ne or not en:
        return False
    if not DEVANAGARI.search(ne) or not LATIN.search(en):
        return False
    nw, ew = word_count(ne), word_count(en)
    if nw < 3 or nw > 18 or ew < 3 or ew > 22:
        return False
    if LEGAL.search(ne):
        return False
    if "%" in en or "{" in en or "<" in en:
        return False
    return True


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / "titung_ne_en_short.jsonl"

    try:
        import pyarrow.parquet as pq
    except ImportError:
        print("installing pyarrow…")
        import subprocess, sys

        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "pyarrow"])
        import pyarrow.parquet as pq

    parquet_path = OUT / "titung_train.parquet"
    if not parquet_path.exists() or parquet_path.stat().st_size < 1000:
        print("downloading Titung train parquet…")
        urllib.request.urlretrieve(TITUNG_PARQUET, parquet_path)

    table = pq.read_table(parquet_path, columns=["ne", "en"])
    kept = 0
    seen: set[str] = set()
    with dest.open("w", encoding="utf-8") as f:
        for ne, en in zip(table.column("ne").to_pylist(), table.column("en").to_pylist()):
            if not keep(ne, en):
                continue
            key = re.sub(r"\s+", " ", (ne or "").strip().lower())
            if key in seen:
                continue
            seen.add(key)
            f.write(
                json.dumps(
                    {
                        "eng_Latn": en.strip(),
                        "npi_Deva": ne.strip(),
                        "source": "titung_ne_en",
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
            kept += 1
            if kept >= 8000:
                break

    print(f"wrote {kept} short pairs → {dest}")
    print(
        "Next FT mix (when a GPU is available): meaning_bank + this file + "
        "BPCC npi_Deva (filtered) — drop OPUS-100 software strings."
    )


if __name__ == "__main__":
    main()
