#!/usr/bin/env python3
"""Pack benchmarks/gold into a single JSON for the mobile Gold Review UI."""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GOLD = ROOT / "gold"
OUT_BENCH = ROOT / "data" / "gold_review_pack.json"
OUT_MOBILE = ROOT.parent / "mobile" / "assets" / "gold" / "review_pack.json"

sys.path.insert(0, str(ROOT.parent))
from training.sentence_split import is_multi_sentence as _is_multi  # noqa: E402

CLASSES = [
    {
        "id": "en_ne_formal",
        "direction": "en-ne",
        "register": "formal",
        "script": "deva",
        "source_lang": "en",
        "target_lang": "ne",
        "source_label": "English",
        "target_label": "Nepali (formal)",
    },
    {
        "id": "en_ne_informal",
        "direction": "en-ne",
        "register": "informal",
        "script": "deva",
        "source_lang": "en",
        "target_lang": "ne",
        "source_label": "English",
        "target_label": "Nepali (informal)",
    },
    {
        "id": "ne_en_deva",
        "direction": "ne-en",
        "register": "neutral",
        "script": "deva",
        "source_lang": "ne",
        "target_lang": "en",
        "source_label": "Nepali (Devanagari)",
        "target_label": "English",
    },
    {
        "id": "ne_en_roman",
        "direction": "ne-en",
        "register": "neutral",
        "script": "roman",
        "source_lang": "ne",
        "target_lang": "en",
        "source_label": "Nepali (Roman)",
        "target_label": "English",
    },
]

# Catalog used when pulling later training data — accuracy trust order.
DATASET_CATALOG = [
    {
        "id": "human_app_review",
        "trust": "gold",
        "license": "NepTranslate work-for-hire / reviewer corrections",
        "use": "Human-completed rows from in-app Gold Review. Highest trust.",
    },
    {
        "id": "hand_authored_seed",
        "trust": "high",
        "license": "NepTranslate proprietary / work-for-hire",
        "use": "Base conversational seeds before premium expand.",
    },
    {
        "id": "premium_word_choice",
        "trust": "high",
        "license": "Rewritten for NepTranslate; do not treat as verbatim third-party",
        "use": "Adversarially curated hard word-choice / honorific items.",
        "seed_parents": ["in22_conv", "flores_plus_prompt", "hand_authored"],
    },
    {
        "id": "in22_conv",
        "trust": "medium_high",
        "license": "CC-BY-4.0",
        "use": "Conversational train seed after gold-blocklist scrub; rewrite register.",
    },
    {
        "id": "bpcc_daily_npi",
        "trust": "medium_high",
        "license": "CC-BY-4.0",
        "use": "Bulk HQ train after dedupe vs gold holdout.",
    },
    {
        "id": "flores_plus_npi",
        "trust": "eval_only",
        "license": "CC-BY-SA + FLORES eval integrity",
        "use": "Never train. Prompt seed only if fully rewritten.",
    },
    {
        "id": "opus_mined",
        "trust": "low",
        "license": "mixed",
        "use": "Avoid for gold; optional noisy pretrain only.",
    },
]


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def infer_provenance(src: dict) -> dict:
    tier = src.get("tier")
    status = src.get("status", "")
    if tier == "premium_word_choice" or status.startswith("premium"):
        return {
            "dataset_id": "premium_word_choice",
            "trust": "high",
            "tier": "premium_word_choice",
            "note": src.get("note"),
            "seed_parents": ["in22_conv", "flores_plus_prompt", "hand_authored"],
        }
    return {
        "dataset_id": "hand_authored_seed",
        "trust": "high",
        "tier": "base",
        "note": src.get("note"),
        "seed_parents": [],
    }


def _norm_pair_key(source: str, reference: str) -> str:
    """Normalize for within-class dedupe (punctuation / whitespace)."""

    def one(s: str) -> str:
        s = s.strip().lower()
        s = re.sub(r"[?.!,;:।]+$", "", s)
        return re.sub(r"\s+", " ", s)

    return f"{one(source)}|||{one(reference)}"


def pack() -> dict:
    items: list[dict] = []
    dropped_dups = 0
    for meta in CLASSES:
        cid = meta["id"]
        folder = GOLD / cid
        sources = {r["id"]: r for r in load_jsonl(folder / "sources.jsonl")}
        refs = {r["id"]: r for r in load_jsonl(folder / "references.jsonl")}
        seen_keys: set[str] = set()
        for sid, src in sources.items():
            ref = refs.get(sid, {})
            source_text = src.get("source", "")
            reference_text = ref.get("reference", "")
            key = _norm_pair_key(source_text, reference_text)
            if key in seen_keys:
                dropped_dups += 1
                continue
            seen_keys.add(key)
            prov = infer_provenance(src)
            items.append(
                {
                    "id": sid,
                    "class_id": cid,
                    "direction": meta["direction"],
                    "register": meta["register"],
                    "script": meta["script"],
                    "source_lang": meta["source_lang"],
                    "target_lang": meta["target_lang"],
                    "source_label": meta["source_label"],
                    "target_label": meta["target_label"],
                    "source": source_text,
                    "reference": reference_text,
                    "deva": src.get("deva"),
                    "pack_status": src.get("status", "unknown"),
                    "provenance": prov,
                    "multi_sentence": _is_multi(source_text) or _is_multi(reference_text),
                }
            )

    if dropped_dups:
        print(f"deduped {dropped_dups} within-class duplicate pair(s)")

    return {
        "version": 1,
        "packed_at": datetime.now(timezone.utc).isoformat(),
        "model_family": "indictrans2-dist-200M",
        "purpose": "in_app_human_gold_review",
        "classes": CLASSES,
        "dataset_catalog": DATASET_CATALOG,
        "n_items": len(items),
        "items": items,
    }


def main() -> int:
    data = pack()
    OUT_BENCH.parent.mkdir(parents=True, exist_ok=True)
    OUT_MOBILE.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=2)
    OUT_BENCH.write_text(text + "\n", encoding="utf-8")
    OUT_MOBILE.write_text(text + "\n", encoding="utf-8")
    print(f"packed {data['n_items']} items → {OUT_BENCH}")
    print(f"copied → {OUT_MOBILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
