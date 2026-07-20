#!/usr/bin/env python3
"""Scrub gold strings from train/val and append BPCC daily sample."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def main() -> None:
    blocked: set[str] = set()
    gpath = ROOT / "benchmarks" / "data" / "gold_train_blocklist.json"
    g = json.loads(gpath.read_text(encoding="utf-8"))
    for s in (g.get("sources") or []) + (g.get("references") or []):
        blocked.add(norm(s))

    data = ROOT / "training" / "data"
    for name in ("train_en_ne.jsonl", "val_en_ne.jsonl"):
        p = data / name
        kept = []
        drop = 0
        for line in p.open(encoding="utf-8"):
            r = json.loads(line)
            if norm(r["eng_Latn"]) in blocked or norm(r["npi_Deva"]) in blocked:
                drop += 1
                continue
            kept.append(r)
        p.write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in kept) + "\n",
            encoding="utf-8",
        )
        print(name, "kept", len(kept), "dropped", drop)

    bp = ROOT / "benchmarks" / "data" / "bpcc_daily_npi_sample.jsonl"
    if not bp.exists():
        return
    train = data / "train_en_ne.jsonl"
    rows = [json.loads(l) for l in train.open(encoding="utf-8")]
    seen = {
        hashlib.sha1(f"{norm(r['eng_Latn'])}|{norm(r['npi_Deva'])}".encode()).hexdigest()
        for r in rows
    }
    add = 0
    for line in bp.open(encoding="utf-8"):
        r = json.loads(line)
        en = str(r.get("src") or r.get("eng_Latn") or "")
        ne = str(r.get("tgt") or r.get("npi_Deva") or "")
        if norm(en) in blocked or norm(ne) in blocked:
            continue
        if len(en) < 6 or len(ne) < 6:
            continue
        key = hashlib.sha1(f"{norm(en)}|{norm(ne)}".encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        rows.append({"eng_Latn": en.strip(), "npi_Deva": ne.strip(), "source": "bpcc_daily"})
        add += 1
    train.write_text(
        "\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n",
        encoding="utf-8",
    )
    print("bpcc added", add, "train now", len(rows))


if __name__ == "__main__":
    main()
