#!/usr/bin/env python3
"""
Build a high-quality English ↔ Nepali (Devanagari) evaluation suite.

Sources (held-out / test only — never used for fine-tuning):
  1. FLORES-101 full eng↔npi (primary, gold parallel news/wiki-style)
  2. OPUS-100 en-ne official test split (multi-domain, disjoint from its train)
  3. Honorific probe (register / तपाईं vs तिमी — qualitative)

Quality filters:
  - Non-empty after strip
  - Nepali side must be majority Devanagari
  - Length bounds + src/tgt length ratio
  - Dedup by English + Nepali normalized text
  - Exclude any sentence that appears in the fine-tune train cache (if present)

Writes:
  benchmarks/data/ne_quality_bench.json
  benchmarks/data/ne_quality_bench_manifest.json
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

REPO = Path(__file__).resolve().parents[1]
BENCH = Path(__file__).resolve().parent
DATA = BENCH / "data"
SAMPLE = DATA / "flores_sample.json"
OUT = DATA / "ne_quality_bench.json"
MANIFEST = DATA / "ne_quality_bench_manifest.json"
TRAIN_CACHE = REPO / "training" / "data" / "train_en_ne.jsonl"

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
LATIN = re.compile(r"[A-Za-z]")


def _ensure_deps() -> None:
    try:
        import datasets  # noqa: F401
    except ImportError:
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "datasets"])


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _deva_ratio(s: str) -> float:
    letters = [c for c in s if c.isalpha() or DEVANAGARI.search(c)]
    if not letters:
        # count Devanagari vs Latin among script chars
        script = [c for c in s if DEVANAGARI.search(c) or LATIN.search(c)]
        if not script:
            return 0.0
        return sum(1 for c in script if DEVANAGARI.search(c)) / len(script)
    script = [c for c in s if DEVANAGARI.search(c) or LATIN.search(c)]
    if not script:
        return 0.0
    return sum(1 for c in script if DEVANAGARI.search(c)) / len(script)


def _ok_pair(en: str, ne: str) -> bool:
    en, ne = en.strip(), ne.strip()
    if len(en) < 8 or len(ne) < 8:
        return False
    if len(en) > 600 or len(ne) > 600:
        return False
    if _deva_ratio(ne) < 0.55:
        return False
    if sum(1 for c in en if LATIN.search(c)) < 5:
        return False
    # length ratio (chars) — avoid wild misalignments
    r = len(ne) / max(len(en), 1)
    if r < 0.35 or r > 3.0:
        return False
    return True


def _sid(*parts: str) -> str:
    h = hashlib.sha1("|".join(_norm(p) for p in parts).encode("utf-8")).hexdigest()
    return h[:16]


def load_train_blocklist() -> set[str]:
    """English norms already in train → exclude from bench when possible."""
    blocked: set[str] = set()
    if not TRAIN_CACHE.exists():
        return blocked
    with TRAIN_CACHE.open(encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            en = row.get("eng_Latn") or row.get("en") or ""
            ne = row.get("npi_Deva") or row.get("ne") or ""
            if en:
                blocked.add(_norm(en))
            if ne:
                blocked.add(_norm(ne))
    return blocked


def ensure_flores101() -> list[dict[str, str]]:
    if not SAMPLE.exists():
        # reuse download from run_mt_bench
        sys.path.insert(0, str(BENCH))
        from run_mt_bench import download_flores101_sample

        download_flores101_sample(SAMPLE)
    data = json.loads(SAMPLE.read_text(encoding="utf-8"))
    return data["pairs"]


def load_opus100_test(max_n: int = 2000) -> list[dict[str, str]]:
    from datasets import load_dataset

    print("[bench-build] Loading Helsinki-NLP/opus-100 en-ne test…", flush=True)
    ds = load_dataset("Helsinki-NLP/opus-100", "en-ne", split="test")
    rows: list[dict[str, str]] = []
    for i, row in enumerate(ds):
        tr = row.get("translation") or {}
        en = str(tr.get("en") or "").strip()
        ne = str(tr.get("ne") or "").strip()
        if not en or not ne:
            continue
        rows.append({"eng_Latn": en, "npi_Deva": ne, "id": f"opus100-{i}"})
        if len(rows) >= max_n:
            break
    print(f"[bench-build] OPUS-100 test raw={len(rows)}", flush=True)
    return rows


def load_honorific() -> list[dict[str, Any]]:
    path = BENCH / "honorific_probe.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data if isinstance(data, list) else data.get("items") or data.get("probes") or []
    out = []
    for i, it in enumerate(items):
        en = it.get("en") or it.get("english") or it.get("source") or ""
        if not en:
            continue
        out.append(
            {
                "id": it.get("id") or f"honorific-{i}",
                "eng_Latn": en.strip(),
                "formality": it.get("formality") or it.get("register") or "formal",
                "expect_markers": it.get("expected_markers")
                or it.get("expect")
                or it.get("markers")
                or [],
            }
        )
    return out


def build() -> dict[str, Any]:
    _ensure_deps()
    DATA.mkdir(parents=True, exist_ok=True)
    blocked = load_train_blocklist()
    seen: set[str] = set()

    splits: dict[str, list[dict[str, Any]]] = {
        "flores101_dev": [],
        "opus100_test": [],
    }

    # --- FLORES-101 (full) ---
    for row in ensure_flores101():
        en = str(row.get("eng_Latn") or "").strip()
        ne = str(row.get("npi_Deva") or "").strip()
        if not _ok_pair(en, ne):
            continue
        key = _sid(en, ne)
        if key in seen:
            continue
        if _norm(en) in blocked or _norm(ne) in blocked:
            continue
        seen.add(key)
        splits["flores101_dev"].append(
            {
                "id": f"flores-{row.get('id', key)}",
                "eng_Latn": en,
                "npi_Deva": ne,
                "domain": "flores",
            }
        )

    # --- OPUS-100 test ---
    try:
        for row in load_opus100_test(2000):
            en, ne = row["eng_Latn"], row["npi_Deva"]
            if not _ok_pair(en, ne):
                continue
            key = _sid(en, ne)
            if key in seen:
                continue
            if _norm(en) in blocked or _norm(ne) in blocked:
                continue
            seen.add(key)
            splits["opus100_test"].append(
                {
                    "id": row["id"],
                    "eng_Latn": en,
                    "npi_Deva": ne,
                    "domain": "opus100_test",
                }
            )
    except Exception as e:
        print(f"[bench-build] OPUS-100 skipped: {e}", flush=True)

    honorific = load_honorific()

    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "description": (
            "High-quality EN↔NE (Devanagari) eval suite. "
            "FLORES-101 = primary gold; OPUS-100 test = multi-domain held-out; "
            "honorific = register probe (not BLEU/chrF)."
        ),
        "filters": {
            "min_chars": 8,
            "max_chars": 600,
            "min_deva_ratio_ne": 0.55,
            "length_ratio_ne_en": [0.35, 3.0],
            "dedupe": "sha1(norm(en)|norm(ne))",
            "train_blocklist_applied": TRAIN_CACHE.exists(),
        },
        "counts": {k: len(v) for k, v in splits.items()},
        "honorific_n": len(honorific),
        "splits": splits,
        "honorific": honorific,
    }

    # Flat pairs for simple runners (prefer FLORES, then OPUS)
    flat = splits["flores101_dev"] + splits["opus100_test"]
    payload["pairs"] = flat
    payload["n"] = len(flat)

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    MANIFEST.write_text(
        json.dumps(
            {
                "created_at": payload["created_at"],
                "counts": payload["counts"],
                "honorific_n": payload["honorific_n"],
                "n_pairs": payload["n"],
                "path": str(OUT),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[bench-build] Wrote {OUT}", flush=True)
    print(f"[bench-build] counts={payload['counts']} total={payload['n']}", flush=True)
    return payload


if __name__ == "__main__":
    build()
