#!/usr/bin/env python3
"""
Quality-first HYBRID overnight train set for IndicTrans2 LoRA.

~32k rows: curated core upsampled + filtered short OPUS + register OPUS.
No synthetic to_informal expand. No formality prefixes required at train time.
Gold holdout blocked.
"""
from __future__ import annotations

import hashlib
import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from training.prepare_gold_domain_data import (  # noqa: E402
    add,
    load_blocklist,
    ok_pair,
    rough_roman,
)

DATA = Path(__file__).resolve().parent / "data"
DEVANAGARI = re.compile(r"[\u0900-\u097F]")
PRIORITY_RE = re.compile(
    r"\b(please|thank|help|where|how much|doctor|hospital|hotel|airport|"
    r"taxi|bus|water|food|name|sorry|hello|visa|passport|family|"
    r"कृपया|धन्यवाद|कहाँ|कति|डाक्टर|अस्पताल|होटल|भिसा|तपाईं|तिमी)\b",
    re.I,
)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def add_w(
    rows: list[dict],
    seen: set[str],
    blocked: set[str],
    en: str,
    ne: str,
    source: str,
    formality: str,
    weight: int,
) -> int:
    n0 = len(rows)
    for _ in range(max(1, weight)):
        add(rows, seen, blocked, en, ne, source, formality)
    return len(rows) - n0


def main() -> int:
    blocked = load_blocklist()
    rows: list[dict] = []
    seen: set[str] = set()

    # --- Tier A: curated upsample ---
    bank = DATA / "meaning_bank.jsonl"
    if bank.exists():
        for line in bank.open(encoding="utf-8"):
            m = json.loads(line)
            en, nf, ni = m.get("english", ""), m.get("ne_formal", ""), m.get("ne_informal", "")
            if en and nf:
                add_w(rows, seen, blocked, en, nf, "meaning_formal", "formal", 4)
            if en and ni and ni != nf:
                add_w(rows, seen, blocked, en, ni, "meaning_informal", "informal", 4)
            elif en and nf:
                add_w(rows, seen, blocked, en, nf, "meaning_same", "neutral", 1)
    print(f"after meaning={len(rows)}", flush=True)

    for name, tag, w in (
        ("train_user_conversation_seeds.jsonl", "user_conv", 5),
        ("train_law_gov_en_ne.jsonl", "law_gov", 3),
        ("train_global_voices_en_ne.jsonl", "global_voices", 2),
    ):
        path = DATA / name
        if not path.exists():
            continue
        for line in path.open(encoding="utf-8"):
            r = json.loads(line)
            en, ne = r.get("eng_Latn", ""), r.get("npi_Deva", "")
            if tag == "global_voices" and (len(en) > 100 or len(ne) > 120):
                continue
            formality = r.get("formality") or "neutral"
            if formality not in ("formal", "informal", "neutral"):
                formality = "neutral"
            add_w(rows, seen, blocked, en, ne, tag, formality, w)
        print(f"after {tag}={len(rows)}", flush=True)

    for slim, tag, w in (
        (ROOT / "benchmarks" / "data" / "in22_conv_npi_slim.jsonl", "in22", 3),
        (ROOT / "benchmarks" / "data" / "bpcc_daily_npi_sample.jsonl", "bpcc", 3),
    ):
        if not slim.exists():
            continue
        for line in slim.open(encoding="utf-8"):
            r = json.loads(line)
            en = str(r.get("en") or r.get("src") or r.get("eng_Latn") or "")
            ne = str(r.get("ne") or r.get("tgt") or r.get("npi_Deva") or "")
            add_w(rows, seen, blocked, en, ne, tag, "neutral", w)
        print(f"after {tag}={len(rows)}", flush=True)

    # --- Tier B: register OPUS (no synthetic expand) ---
    opus = DATA / "train_en_ne.jsonl"
    reg_added = 0
    if opus.exists():
        for line in opus.open(encoding="utf-8"):
            if reg_added >= 4000:
                break
            r = json.loads(line)
            en, ne = r.get("eng_Latn", ""), r.get("npi_Deva", "")
            if not ok_pair(en, ne, blocked):
                continue
            if "तपाईं" in ne or "तपाईँ" in ne:
                formality = "formal"
            elif "तिमी" in ne:
                formality = "informal"
            else:
                continue
            if not PRIORITY_RE.search(f"{en} {ne}") and reg_added > 2000:
                continue
            before = len(seen)
            add(rows, seen, blocked, en, ne, "opus_register", formality)
            if len(seen) > before:
                reg_added += 1
    print(f"after register opus={len(rows)} (+{reg_added})", flush=True)

    # --- Tier C: filtered short OPUS scale ---
    scale_added = 0
    target_total = 32_000
    if opus.exists():
        for line in opus.open(encoding="utf-8"):
            if len(rows) >= target_total + 2000:
                break
            r = json.loads(line)
            en, ne = r.get("eng_Latn", ""), r.get("npi_Deva", "")
            if len(en) > 80 or len(ne) > 100:
                continue
            if not ok_pair(en, ne, blocked):
                continue
            # Skip already-heavy honorific rows for this tier
            if "तपाईं" in ne or "तपाईँ" in ne or "तिमी" in ne:
                continue
            before = len(seen)
            add(rows, seen, blocked, en, ne, "opus_short", "neutral")
            if len(seen) > before:
                scale_added += 1
    print(f"after scale opus={len(rows)} (+{scale_added})", flush=True)

    # Cap if oversized (keep curated first by sorting)
    random.Random(42).shuffle(rows)
    # Prefer curated: re-order so meaning/user/law/in22/bpcc/gv come first when truncating
    rank = {
        "meaning_formal": 0,
        "meaning_informal": 0,
        "meaning_same": 1,
        "user_conv": 0,
        "law_gov": 1,
        "in22": 1,
        "bpcc": 1,
        "global_voices": 2,
        "opus_register": 3,
        "opus_short": 4,
    }
    rows.sort(key=lambda r: rank.get(r["source"], 9))
    rows = rows[:34_000]
    random.Random(42).shuffle(rows)

    n_val = max(800, int(len(rows) * 0.025))
    val, train = rows[:n_val], rows[n_val:]

    roman_rows: list[dict] = []
    roman_seen: set[str] = set()
    for r in train:
        if len(roman_rows) >= 6000:
            break
        if len(r["npi_Deva"]) >= 90:
            continue
        rom = rough_roman(r["npi_Deva"])
        if len(rom) < 6 or DEVANAGARI.search(rom):
            continue
        k = hashlib.sha1(f"roman|{norm(rom)}|{norm(r['eng_Latn'])}".encode()).hexdigest()[:16]
        if k in roman_seen or norm(rom) in blocked:
            continue
        roman_seen.add(k)
        roman_rows.append(
            {
                "eng_Latn": r["eng_Latn"],
                "npi_Deva": r["npi_Deva"],
                "npi_Roman": rom,
                "source": "romanize_" + r["source"],
                "formality": r["formality"],
            }
        )

    def write(path: Path, data: list[dict]) -> None:
        path.write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in data) + "\n",
            encoding="utf-8",
        )

    write(DATA / "train_overnight_hybrid.jsonl", train)
    write(DATA / "val_overnight_hybrid.jsonl", val)
    write(DATA / "train_overnight_roman.jsonl", roman_rows)

    sources: dict[str, int] = {}
    for r in train + val:
        sources[r["source"]] = sources.get(r["source"], 0) + 1
    opus_n = sum(v for k, v in sources.items() if k.startswith("opus"))
    meta = {
        "train_n": len(train),
        "val_n": len(val),
        "roman_n": len(roman_rows),
        "opus_share": round(opus_n / max(1, len(train) + len(val)), 3),
        "sources": dict(sorted(sources.items(), key=lambda x: -x[1])),
        "blocklist": len(blocked),
        "policy": "quality_first_hybrid_no_synthetic_informal",
        "formality_prefixes": False,
    }
    (DATA / "overnight_hybrid_manifest.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(meta, indent=2, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
