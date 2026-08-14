#!/usr/bin/env python3
"""Build a small high-quality EN↔NE mix that fits CPU LoRA on this machine.

Drops OPUS-100 UI / Global Voices / mechanical Roman. Keeps curated meanings,
traveler conversation seeds, and short government labels. Upsamples product
surfaces so LoRA actually sees them.

Writes:
  training/data/meaning_bank.jsonl          (filtered + seed merge)
  mobile/assets/data/meaning_bank.jsonl
  training/data/train_clean_{en-ne,ne-en}.jsonl
  training/data/val_clean_{en-ne,ne-en}.jsonl
  training/data/cpu_mix_manifest.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from training.build_meaning_bank import (  # noqa: E402
    SURFACES,
    everyday_roman,
    guess_surface,
    to_informal,
)
from training.pack_meaning_review import main as pack_review  # noqa: E402

DATA = Path(__file__).resolve().parent / "data"
MOBILE_BANK = REPO / "mobile" / "assets" / "data" / "meaning_bank.jsonl"
GOLD_BLOCK = REPO / "benchmarks" / "data" / "gold_train_blocklist.json"
DEVANAGARI = re.compile(r"[\u0900-\u097F]")

KEEP_PROVENANCE = {
    "hand_priority_seed",
    "assistant_curated",
    "recovered_site_labels_and_manual_normalization",
    "law_gov",
    "user_conv_seed",
    "human_meaning_review",
    "human_app_review",
}

PRIORITY_SURFACES = {
    "travel",
    "health",
    "questions_requests",
    "pronouns_honorifics",
}
DEFAULT_UPSAMPLE = 4
PRIORITY_UPSAMPLE = 8


def norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[?.!,;:।]+$", "", s)
    return re.sub(r"\s+", " ", s)


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + ("\n" if rows else ""),
        encoding="utf-8",
    )


def load_blocklist() -> set[str]:
    blocked: set[str] = set()
    if not GOLD_BLOCK.exists():
        return blocked
    g = json.loads(GOLD_BLOCK.read_text(encoding="utf-8"))
    for s in (g.get("sources") or []) + (g.get("references") or []):
        n = norm(s)
        if n:
            blocked.add(n)
    return blocked


def blocked_text(blocked: set[str], *texts: str) -> bool:
    return any(norm(t) in blocked for t in texts if t)


def meaning_key(english: str, ne_formal: str) -> str:
    return hashlib.sha1(f"{norm(english)}|{norm(ne_formal)}".encode()).hexdigest()[:12]


def pair_to_meaning(
    english: str,
    nepali: str,
    provenance: str,
    formality: str,
    surface: str,
    idx: int,
) -> dict:
    ne = nepali.strip()
    if formality == "informal" or "तिमी" in ne:
        ni = ne
        nf = ne
        for a, b in [
            ("तिमीहरू", "तपाईंहरू"),
            ("तिम्रो", "तपाईंको"),
            ("तिमीलाई", "तपाईंलाई"),
            ("तिमीले", "तपाईंले"),
            ("तिमी", "तपाईं"),
        ]:
            nf = nf.replace(a, b)
    else:
        nf = ne
        ni = to_informal(ne)
    return {
        "meaning_id": f"{surface}_{idx:05d}",
        "english": english.strip(),
        "ne_formal": nf,
        "ne_informal": ni,
        "roman_formal": everyday_roman(nf),
        "roman_informal": everyday_roman(ni),
        "surface": surface,
        "provenance": provenance,
        "unit": "sentence",
    }


def ingest_pairs(bank: dict[str, dict], path: Path, provenance: str, blocked: set[str]) -> int:
    added = 0
    if not path.exists():
        return 0
    for row in load_jsonl(path):
        en = (row.get("eng_Latn") or row.get("english") or "").strip()
        ne = (row.get("npi_Deva") or row.get("ne_formal") or "").strip()
        if not en or not ne or not DEVANAGARI.search(ne):
            continue
        if blocked_text(blocked, en, ne):
            continue
        key = meaning_key(en, ne)
        if key in bank:
            continue
        formality = (row.get("formality") or "neutral").strip()
        surface = "government" if provenance == "law_gov" else guess_surface(en, ne)
        n = sum(1 for m in bank.values() if m.get("surface") == surface) + 1
        bank[key] = pair_to_meaning(en, ne, provenance, formality, surface, n)
        added += 1
    return added


def clean_bank(blocked: set[str]) -> list[dict]:
    bank: dict[str, dict] = {}
    dropped = Counter()
    for row in load_jsonl(DATA / "meaning_bank.jsonl"):
        prov = row.get("provenance") or ""
        if prov not in KEEP_PROVENANCE:
            dropped[prov or "unknown"] += 1
            continue
        en = (row.get("english") or "").strip()
        nf = (row.get("ne_formal") or "").strip()
        if not en or not nf or not DEVANAGARI.search(nf):
            dropped["malformed"] += 1
            continue
        if blocked_text(
            blocked,
            en,
            nf,
            row.get("ne_informal") or "",
            row.get("roman_formal") or "",
            row.get("roman_informal") or "",
        ):
            dropped["gold_blocklist"] += 1
            continue
        key = meaning_key(en, nf)
        if key in bank:
            continue
        bank[key] = row

    seed_n = ingest_pairs(
        bank, DATA / "train_user_conversation_seeds.jsonl", "user_conv_seed", blocked
    )
    law_n = ingest_pairs(bank, DATA / "train_law_gov_en_ne.jsonl", "law_gov", blocked)
    meanings = list(bank.values())
    surface_rank = {s: i for i, s in enumerate(SURFACES)}
    meanings.sort(key=lambda m: (surface_rank.get(m.get("surface", ""), 99), m.get("meaning_id", "")))
    print(
        f"[cpu-mix] bank kept={len(meanings)} dropped={dict(dropped)} "
        f"+seeds={seed_n} +law={law_n}",
        flush=True,
    )
    return meanings


def expand_train(meanings: list[dict]) -> list[dict]:
    examples: list[dict] = []

    def add_ex(src: str, tgt: str, direction: str, m: dict, register: str, product_prefix: str):
        if not src.strip() or not tgt.strip():
            return
        examples.append(
            {
                "src": src,
                "tgt": tgt,
                "direction": direction,
                "meaning_id": m["meaning_id"],
                "surface": m.get("surface") or "core_grammar",
                "register": register,
                "product_prefix": product_prefix,
                "provenance": m.get("provenance") or "",
            }
        )

    for m in meanings:
        en, nf, ni = m["english"], m["ne_formal"], m["ne_informal"]
        rf = m.get("roman_formal") or ""
        surface = m.get("surface") or "core_grammar"
        add_ex(f"<formal> {en}", nf, "en-ne", m, "formal", "<en><ne><formal>")
        add_ex(f"<informal> {en}", ni, "en-ne", m, "informal", "<en><ne><informal>")
        add_ex(nf, en, "ne-en", m, "formal", "<ne><en>")
        if ni != nf:
            add_ex(ni, en, "ne-en", m, "informal", "<ne><en>")
        if surface in PRIORITY_SURFACES and rf and not DEVANAGARI.search(rf):
            add_ex(rf, en, "ne-en", m, "roman_formal", "<ne><en>")
    return examples


def upsample(examples: list[dict]) -> list[dict]:
    out: list[dict] = []
    for ex in examples:
        n = PRIORITY_UPSAMPLE if ex.get("surface") in PRIORITY_SURFACES else DEFAULT_UPSAMPLE
        out.extend([ex] * n)
    return out


def split_by_meaning(examples: list[dict], val_ratio: float, seed: int) -> tuple[list[dict], list[dict]]:
    ids = sorted({ex["meaning_id"] for ex in examples})
    rng = random.Random(seed)
    rng.shuffle(ids)
    n_val = max(1, int(len(ids) * val_ratio))
    val_ids = set(ids[:n_val])
    train, val = [], []
    for ex in examples:
        (val if ex["meaning_id"] in val_ids else train).append(ex)
    rng.shuffle(train)
    rng.shuffle(val)
    return train, val


def main() -> int:
    ap = argparse.ArgumentParser(description="Clean meaning bank and write CPU FT jsonl")
    ap.add_argument("--val-ratio", type=float, default=0.10)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    blocked = load_blocklist()
    meanings = clean_bank(blocked)
    if len(meanings) < 40:
        raise SystemExit(f"cleaned bank too small ({len(meanings)}); aborting")

    write_jsonl(DATA / "meaning_bank.jsonl", meanings)
    MOBILE_BANK.parent.mkdir(parents=True, exist_ok=True)
    MOBILE_BANK.write_text((DATA / "meaning_bank.jsonl").read_text(encoding="utf-8"), encoding="utf-8")
    pack_review()

    expanded = expand_train(meanings)
    expanded = [
        ex
        for ex in expanded
        if not blocked_text(blocked, ex["src"], ex["tgt"])
    ]
    train, val = split_by_meaning(expanded, args.val_ratio, args.seed)
    train = upsample(train)

    by_dir_train = {"en-ne": [], "ne-en": []}
    by_dir_val = {"en-ne": [], "ne-en": []}
    for ex in train:
        by_dir_train[ex["direction"]].append(ex)
    for ex in val:
        by_dir_val[ex["direction"]].append(ex)

    for direction in ("en-ne", "ne-en"):
        write_jsonl(DATA / f"train_clean_{direction}.jsonl", by_dir_train[direction])
        write_jsonl(DATA / f"val_clean_{direction}.jsonl", by_dir_val[direction])

    by_surface = Counter(m.get("surface") or "core_grammar" for m in meanings)
    by_prov = Counter(m.get("provenance") or "?" for m in meanings)
    meta = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "meanings_n": len(meanings),
        "by_provenance": dict(by_prov),
        "by_surface": dict(by_surface),
        "gold_blocklist_n": len(blocked),
        "upsample": {"default": DEFAULT_UPSAMPLE, "priority": PRIORITY_UPSAMPLE},
        "priority_surfaces": sorted(PRIORITY_SURFACES),
        "unique_examples_before_upsample": len(expanded),
        "train_n": {d: len(by_dir_train[d]) for d in ("en-ne", "ne-en")},
        "val_n": {d: len(by_dir_val[d]) for d in ("en-ne", "ne-en")},
        "note": "Quality >> quantity. Do not mix OPUS-100, Global Voices, or Titung into this job.",
        "run": "python training/finetune_it2_cpu.py --directions en-ne,ne-en",
    }
    (DATA / "cpu_mix_manifest.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (DATA / "meaning_bank_manifest.json").write_text(
        json.dumps(
            {
                "meanings_n": len(meanings),
                "by_surface": dict(by_surface),
                "by_provenance": dict(by_prov),
                "schema": [
                    "meaning_id",
                    "english",
                    "ne_formal",
                    "ne_informal",
                    "roman_formal",
                    "roman_informal",
                ],
                "control_tokens": {
                    "product": ["<en><ne><formal>", "<en><ne><informal>", "<ne><en>"],
                    "model": [
                        "<formal>",
                        "<informal>",
                        "(direction via en-indic / indic-en checkpoint)",
                    ],
                },
                "architecture": "one_mt_devanagari_canonical_plus_roman_layers",
                "bank_path": str(DATA / "meaning_bank.jsonl"),
                "cpu_mix": "training/data/cpu_mix_manifest.json",
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps(meta, indent=2, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
