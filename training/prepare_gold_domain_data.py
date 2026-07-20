#!/usr/bin/env python3
"""
Build a conversational EN↔NE fine-tune set optimized for the private gold bench.

Never includes gold holdout strings. Prefers short travel/health/daily pairs,
adds formal/informal variants, and romanized Nepali → English views.
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
from training.sentence_split import expand_pair_to_sentences  # noqa: E402

TRAIN_IN = Path(__file__).resolve().parent / "data" / "train_en_ne.jsonl"
OUT_DIR = Path(__file__).resolve().parent / "data"
GOLD_BLOCK = ROOT / "benchmarks" / "data" / "gold_train_blocklist.json"
IN22 = ROOT / "benchmarks" / "data" / "in22_conv_npi_slim.jsonl"
BPCC = ROOT / "benchmarks" / "data" / "bpcc_daily_npi_sample.jsonl"

DEVANAGARI = re.compile(r"[\u0900-\u097F]")

# Minimal chat romanization for NE→EN roman training views (not ISO).
_ROMAN_MAP = [
    ("क्ष", "chhya"),
    ("त्र", "tra"),
    ("ज्ञ", "gya"),
    ("श्र", "shra"),
    ("ख", "kha"),
    ("घ", "gha"),
    ("च", "cha"),
    ("छ", "chha"),
    ("ज", "ja"),
    ("झ", "jha"),
    ("ट", "ta"),
    ("ठ", "tha"),
    ("ड", "da"),
    ("ढ", "dha"),
    ("ण", "na"),
    ("त", "ta"),
    ("थ", "tha"),
    ("द", "da"),
    ("ध", "dha"),
    ("न", "na"),
    ("प", "pa"),
    ("फ", "pha"),
    ("ब", "ba"),
    ("भ", "bha"),
    ("म", "ma"),
    ("य", "ya"),
    ("र", "ra"),
    ("ल", "la"),
    ("व", "wa"),
    ("श", "sha"),
    ("ष", "sha"),
    ("स", "sa"),
    ("ह", "ha"),
    ("क", "ka"),
    ("ग", "ga"),
    ("ङ", "nga"),
    ("आ", "aa"),
    ("अ", "a"),
    ("इ", "i"),
    ("ई", "i"),
    ("उ", "u"),
    ("ऊ", "u"),
    ("ए", "e"),
    ("ऐ", "ai"),
    ("ओ", "o"),
    ("औ", "au"),
    ("ा", "a"),
    ("ि", "i"),
    ("ी", "i"),
    ("ु", "u"),
    ("ू", "u"),
    ("े", "e"),
    ("ै", "ai"),
    ("ो", "o"),
    ("ौ", "au"),
    ("ं", "n"),
    ("ँ", "n"),
    ("ः", ""),
    ("्", ""),
    ("।", ""),
]


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def load_blocklist() -> set[str]:
    blocked: set[str] = set()
    if GOLD_BLOCK.exists():
        g = json.loads(GOLD_BLOCK.read_text(encoding="utf-8"))
        for s in (g.get("sources") or []) + (g.get("references") or []):
            blocked.add(norm(s))
    gold = ROOT / "benchmarks" / "gold"
    for cls in gold.iterdir() if gold.exists() else []:
        if not cls.is_dir():
            continue
        for name in ("sources.jsonl", "references.jsonl"):
            p = cls / name
            if not p.exists():
                continue
            for line in p.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                for k in ("source", "reference", "deva"):
                    if row.get(k):
                        blocked.add(norm(str(row[k])))
    return blocked


def rough_roman(ne: str) -> str:
    s = ne
    for a, b in _ROMAN_MAP:
        s = s.replace(a, b)
    s = re.sub(r"[^\w\s?]", "", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def to_informal(ne: str) -> str:
    out = ne
    reps = [
        ("तपाईंहरू", "तिमीहरू"),
        ("तपाईँहरू", "तिमीहरू"),
        ("तपाईंको", "तिम्रो"),
        ("तपाईँको", "तिम्रो"),
        ("तपाईंलाई", "तिमीलाई"),
        ("तपाईँलाई", "तिमीलाई"),
        ("तपाईंले", "तिमीले"),
        ("तपाईँले", "तिमीले"),
        ("तपाईं", "तिमी"),
        ("तपाईँ", "तिमी"),
        ("गर्नुहोस्", "गर"),
        ("दिनुहोस्", "देऊ"),
        ("बस्नुहोस्", "बस"),
        ("पर्खनुहोस्", "पर्ख"),
        ("आउनुहोस्", "आउ"),
        ("जानुहोस्", "जा"),
        ("खानुहोस्", "खा"),
        ("बोल्नुहोस्", "बोल"),
        ("गर्नुहुन्छ", "गर्छौ"),
        ("सक्नुहुन्छ", "सक्छौ"),
        ("छन्", "छौ"),
    ]
    for a, b in reps:
        out = out.replace(a, b)
    return out


def ok_pair(en: str, ne: str, blocked: set[str]) -> bool:
    en, ne = en.strip(), ne.strip()
    if len(en) < 6 or len(ne) < 6:
        return False
    # Sentence-level FT: keep short (IT2 FT truncates ~96 tokens; model max 256).
    if len(en) > 160 or len(ne) > 180:
        return False
    if norm(en) in blocked or norm(ne) in blocked:
        return False
    if not DEVANAGARI.search(ne):
        return False
    if sum(c.isalpha() for c in en) < 4:
        return False
    return True


def add(
    rows: list[dict],
    seen: set[str],
    blocked: set[str],
    en: str,
    ne: str,
    source: str,
    formality: str = "neutral",
) -> None:
    for e, n in expand_pair_to_sentences(en, ne):
        if not ok_pair(e, n, blocked):
            continue
        key = hashlib.sha1(f"{norm(e)}|{norm(n)}|{formality}".encode()).hexdigest()[:16]
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "eng_Latn": e.strip(),
                "npi_Deva": n.strip(),
                "source": source,
                "formality": formality,
                "unit": "sentence",
            }
        )


def main() -> None:
    blocked = load_blocklist()
    print(f"blocklist={len(blocked)}", flush=True)
    rows: list[dict] = []
    seen: set[str] = set()

    # 1) Short slice of existing train
    if TRAIN_IN.exists():
        for line in TRAIN_IN.open(encoding="utf-8"):
            r = json.loads(line)
            en, ne = r.get("eng_Latn", ""), r.get("npi_Deva", "")
            formality = "formal" if ("तपाईं" in ne or "तपाईँ" in ne) else (
                "informal" if "तिमी" in ne else "neutral"
            )
            add(rows, seen, blocked, en, ne, r.get("source", "opus"), formality)
            if len(rows) >= 40_000:
                break
    print(f"after opus-short={len(rows)}", flush=True)

    # 2) IN22 conversational (rewrites allowed as train if not in gold blocklist)
    if IN22.exists():
        for line in IN22.open(encoding="utf-8"):
            r = json.loads(line)
            add(rows, seen, blocked, r["en"], r["ne"], "in22_conv", "neutral")
            # formal/informal views when honorifics present or invent informal twin
            ne = r["ne"]
            if "तपाईं" in ne or "तपाईँ" in ne:
                add(rows, seen, blocked, r["en"], ne, "in22_formal", "formal")
                add(rows, seen, blocked, r["en"], to_informal(ne), "in22_informal", "informal")
            elif "तिमी" not in ne and len(ne) < 80:
                # light formalize tip: leave as neutral; informal twin only if safe
                pass
        print(f"after in22={len(rows)}", flush=True)

    # 3) BPCC daily sample
    if BPCC.exists():
        for line in BPCC.open(encoding="utf-8"):
            r = json.loads(line)
            en = str(r.get("src") or r.get("eng_Latn") or "")
            ne = str(r.get("tgt") or r.get("npi_Deva") or "")
            add(rows, seen, blocked, en, ne, "bpcc_daily", "neutral")
        print(f"after bpcc={len(rows)}", flush=True)

    # 3b) Global Voices journalism (doc-aligned) + law/gov UI seeds if present
    for extra_name, src_tag in (
        ("train_global_voices_en_ne.jsonl", "global_voices"),
        ("train_law_gov_en_ne.jsonl", "law_gov_ui"),
        ("train_user_conversation_seeds.jsonl", "user_conv_seed"),
    ):
        extra_path = OUT_DIR / extra_name
        if not extra_path.exists():
            continue
        n0 = len(rows)
        for line in extra_path.open(encoding="utf-8"):
            r = json.loads(line)
            formality = r.get("formality") or "neutral"
            add(
                rows,
                seen,
                blocked,
                r.get("eng_Latn", ""),
                r.get("npi_Deva", ""),
                src_tag,
                formality if formality in ("formal", "informal", "neutral") else "neutral",
            )
        print(f"after {src_tag}={len(rows)} (+{len(rows)-n0})", flush=True)

    # 4) Formal/informal expansion for short formal rows
    extra: list[dict] = []
    for r in list(rows):
        if r["formality"] == "formal" and len(r["npi_Deva"]) < 100:
            add(
                extra,
                seen,
                blocked,
                r["eng_Latn"],
                to_informal(r["npi_Deva"]),
                "register_expand",
                "informal",
            )
    rows.extend(extra)
    print(f"after register expand={len(rows)}", flush=True)

    # 5) Roman NE→EN auxiliary pairs (for roman gold class)
    roman_rows: list[dict] = []
    for r in rows:
        if r["formality"] in ("neutral", "formal") and len(r["npi_Deva"]) < 90:
            rom = rough_roman(r["npi_Deva"])
            if len(rom) >= 6 and not DEVANAGARI.search(rom):
                key = hashlib.sha1(f"roman|{norm(rom)}|{norm(r['eng_Latn'])}".encode()).hexdigest()[:16]
                if key in seen:
                    continue
                if norm(rom) in blocked or norm(r["eng_Latn"]) in blocked:
                    continue
                seen.add(key)
                roman_rows.append(
                    {
                        "eng_Latn": r["eng_Latn"],
                        "npi_Deva": r["npi_Deva"],
                        "npi_Roman": rom,
                        "source": "romanize_" + r["source"],
                        "formality": r["formality"],
                        "direction_extra": "roman-en",
                    }
                )
            if len(roman_rows) >= 8_000:
                break

    random.Random(42).shuffle(rows)
    n_val = max(400, int(len(rows) * 0.03))
    val, train = rows[:n_val], rows[n_val:]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    train_path = OUT_DIR / "train_gold_domain.jsonl"
    val_path = OUT_DIR / "val_gold_domain.jsonl"
    roman_path = OUT_DIR / "train_roman_ne_en.jsonl"

    def write(path: Path, data: list[dict]) -> None:
        path.write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in data) + "\n",
            encoding="utf-8",
        )

    write(train_path, train)
    write(val_path, val)
    write(roman_path, roman_rows)
    sources: dict[str, int] = {}
    for r in train + val:
        sources[r["source"]] = sources.get(r["source"], 0) + 1
    meta = {
        "train_n": len(train),
        "val_n": len(val),
        "roman_n": len(roman_rows),
        "sources": sources,
        "blocklist": len(blocked),
        "train_path": str(train_path),
        "val_path": str(val_path),
        "roman_path": str(roman_path),
    }
    (OUT_DIR / "gold_domain_manifest.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2), flush=True)


if __name__ == "__main__":
    main()
