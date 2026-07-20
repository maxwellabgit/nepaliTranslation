#!/usr/bin/env python3
"""
Prepare English↔Nepali (Devanagari) fine-tune data from online corpora.

Train sources (NOT the eval suite):
  - Helsinki-NLP/opus-100 en-ne train
  - ai4bharat/BPCC bpcc-seed-v2 npi_Deva (if reachable)
  - Optional: sample of high-quality NLLB bitext (npi_Deva)

Writes jsonl under training/data/ with eng_Latn / npi_Deva fields.
Excludes any pair whose English or Nepali appears in the quality bench.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

REPO = Path(__file__).resolve().parents[1]
OUT_DIR = Path(__file__).resolve().parent / "data"
BENCH_QUALITY = REPO / "benchmarks" / "data" / "ne_quality_bench.json"
GOLD_BLOCK = REPO / "benchmarks" / "data" / "gold_train_blocklist.json"

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
LATIN = re.compile(r"[A-Za-z]")


def _ensure() -> None:
    try:
        import datasets  # noqa: F401
    except ImportError:
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "datasets"])


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _deva_ratio(s: str) -> float:
    script = [c for c in s if DEVANAGARI.search(c) or LATIN.search(c)]
    if not script:
        return 0.0
    return sum(1 for c in script if DEVANAGARI.search(c)) / len(script)


def _ok(en: str, ne: str) -> bool:
    en, ne = en.strip(), ne.strip()
    if len(en) < 6 or len(ne) < 6:
        return False
    if len(en) > 400 or len(ne) > 400:
        return False
    if _deva_ratio(ne) < 0.55:
        return False
    if sum(1 for c in en if LATIN.search(c)) < 4:
        return False
    r = len(ne) / max(len(en), 1)
    if r < 0.3 or r > 3.2:
        return False
    return True


def load_bench_blocklist() -> set[str]:
    blocked: set[str] = set()
    if BENCH_QUALITY.exists():
        data = json.loads(BENCH_QUALITY.read_text(encoding="utf-8"))
        for p in data.get("pairs") or []:
            if p.get("eng_Latn"):
                blocked.add(_norm(p["eng_Latn"]))
            if p.get("npi_Deva"):
                blocked.add(_norm(p["npi_Deva"]))
    # Private gold holdout — never train on these strings
    if GOLD_BLOCK.exists():
        g = json.loads(GOLD_BLOCK.read_text(encoding="utf-8"))
        for s in g.get("sources") or []:
            blocked.add(_norm(s))
        for s in g.get("references") or []:
            blocked.add(_norm(s))
    # Also scan gold jsonl directly
    gold_root = REPO / "benchmarks" / "gold"
    if gold_root.exists():
        for cls_dir in gold_root.iterdir():
            if not cls_dir.is_dir():
                continue
            for name in ("sources.jsonl", "references.jsonl"):
                path = cls_dir / name
                if not path.exists():
                    continue
                for line in path.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    row = json.loads(line)
                    for key in ("source", "reference", "deva"):
                        if row.get(key):
                            blocked.add(_norm(str(row[key])))
    return blocked


def add_pair(
    rows: list[dict[str, str]],
    seen: set[str],
    blocked: set[str],
    en: str,
    ne: str,
    source: str,
) -> None:
    if not _ok(en, ne):
        return
    if _norm(en) in blocked or _norm(ne) in blocked:
        return
    key = hashlib.sha1(f"{_norm(en)}|{_norm(ne)}".encode()).hexdigest()[:16]
    if key in seen:
        return
    seen.add(key)
    rows.append({"eng_Latn": en.strip(), "npi_Deva": ne.strip(), "source": source})


def from_opus100(max_n: int, blocked: set[str]) -> list[dict[str, str]]:
    from datasets import load_dataset

    print("[ft-data] OPUS-100 en-ne train…", flush=True)
    ds = load_dataset("Helsinki-NLP/opus-100", "en-ne", split="train")
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in ds:
        tr = row.get("translation") or {}
        add_pair(rows, seen, blocked, str(tr.get("en") or ""), str(tr.get("ne") or ""), "opus100")
        if len(rows) >= max_n:
            break
    print(f"[ft-data] opus100 kept={len(rows)}", flush=True)
    return rows


def from_bpcc_seed(max_n: int, blocked: set[str]) -> list[dict[str, str]]:
    from datasets import load_dataset

    print("[ft-data] BPCC daily + seed npi_Deva…", flush=True)
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for cfg in ("daily", "bpcc-seed-v2"):
        try:
            ds = load_dataset("ai4bharat/BPCC", cfg, split="npi_Deva")
        except Exception as e:
            print(f"[ft-data] BPCC {cfg} unavailable: {e}", flush=True)
            continue
        before = len(rows)
        for row in ds:
            en = str(
                row.get("eng_Latn")
                or row.get("en")
                or row.get("src")
                or row.get("english")
                or ""
            )
            ne = str(
                row.get("npi_Deva")
                or row.get("ne")
                or row.get("tgt")
                or row.get("indic")
                or row.get("text")
                or ""
            )
            if not en and "translation" in row:
                tr = row["translation"]
                if isinstance(tr, dict):
                    en = str(tr.get("en") or tr.get("eng_Latn") or "")
                    ne = str(tr.get("ne") or tr.get("npi_Deva") or "")
            add_pair(rows, seen, blocked, en, ne, f"bpcc_{cfg}")
            if len(rows) >= max_n:
                break
        print(f"[ft-data] BPCC {cfg} +{len(rows)-before} total={len(rows)}", flush=True)
        if len(rows) >= max_n:
            break
    return rows


def from_nllb_hq(max_n: int, blocked: set[str]) -> list[dict[str, str]]:
    """Optional high-quality NLLB English–Nepali bitext."""
    from datasets import load_dataset

    print("[ft-data] NLLB HQ npi_Deva (optional)…", flush=True)
    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    try:
        ds = load_dataset("hotchpotch/nllb-english-bitext-hq", "npi_Deva", split="train")
    except Exception as e:
        print(f"[ft-data] NLLB skipped: {e}", flush=True)
        return rows

    print(f"[ft-data] nllb cols={ds.column_names}", flush=True)
    for row in ds:
        en = str(
            row.get("english")
            or row.get("eng_Latn")
            or row.get("src_text")
            or row.get("source")
            or row.get("english")
            or row.get("src")
            or row.get("en")
            or ""
        )
        ne = str(
            row.get("translated")
            or row.get("npi_Deva")
            or row.get("tgt_text")
            or row.get("target")
            or row.get("text")
            or row.get("tgt")
            or row.get("ne")
            or ""
        )
        if DEVANAGARI.search(en) and not DEVANAGARI.search(ne):
            en, ne = ne, en
        add_pair(rows, seen, blocked, en, ne, "nllb_hq")
        if len(rows) >= max_n:
            break
    print(f"[ft-data] nllb kept={len(rows)}", flush=True)
    return rows


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--opus-max", type=int, default=80_000)
    ap.add_argument("--bpcc-max", type=int, default=50_000)
    ap.add_argument("--nllb-max", type=int, default=40_000)
    ap.add_argument("--val-ratio", type=float, default=0.02)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--skip-nllb", action="store_true")
    args = ap.parse_args()

    _ensure()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    blocked = load_bench_blocklist()
    print(f"[ft-data] bench blocklist size={len(blocked)}", flush=True)

    all_rows: list[dict[str, str]] = []
    all_rows.extend(from_opus100(args.opus_max, blocked))
    all_rows.extend(from_bpcc_seed(args.bpcc_max, blocked))
    if not args.skip_nllb:
        all_rows.extend(from_nllb_hq(args.nllb_max, blocked))

    # Final dedupe
    seen: set[str] = set()
    uniq: list[dict[str, str]] = []
    for r in all_rows:
        key = hashlib.sha1(f"{_norm(r['eng_Latn'])}|{_norm(r['npi_Deva'])}".encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(r)

    random.Random(args.seed).shuffle(uniq)
    n_val = max(200, int(len(uniq) * args.val_ratio))
    val = uniq[:n_val]
    train = uniq[n_val:]

    train_path = OUT_DIR / "train_en_ne.jsonl"
    val_path = OUT_DIR / "val_en_ne.jsonl"
    meta_path = OUT_DIR / "manifest.json"

    write_jsonl(train_path, train)
    write_jsonl(val_path, val)
    sources: dict[str, int] = {}
    for r in uniq:
        sources[r["source"]] = sources.get(r["source"], 0) + 1

    meta = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "train_n": len(train),
        "val_n": len(val),
        "sources": sources,
        "bench_blocklist": len(blocked),
        "train_path": str(train_path),
        "val_path": str(val_path),
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
