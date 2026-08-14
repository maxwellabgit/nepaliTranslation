#!/usr/bin/env python3
"""Pack benchmarks/gold into a slim in-app review deck.

Writes:
  benchmarks/data/gold_review_pack.json
  mobile/assets/data/gold_review_pack.json
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
GOLD = ROOT / "gold"
OUT_BENCH = ROOT / "data" / "gold_review_pack.json"
OUT_MOBILE = REPO / "mobile" / "assets" / "data" / "gold_review_pack.json"

CLASSES = [
    {
        "id": "en_ne_formal",
        "direction": "en-ne",
        "register": "formal",
        "script": "deva",
        "source_label": "English",
        "target_label": "Nepali (formal · तपाईं)",
    },
    {
        "id": "en_ne_informal",
        "direction": "en-ne",
        "register": "informal",
        "script": "deva",
        "source_label": "English",
        "target_label": "Nepali (informal · तिमी)",
    },
    {
        "id": "ne_en_deva",
        "direction": "ne-en",
        "register": "neutral",
        "script": "deva",
        "source_label": "Nepali (Devanagari)",
        "target_label": "English",
    },
    {
        "id": "ne_en_roman",
        "direction": "ne-en",
        "register": "neutral",
        "script": "roman",
        "source_label": "Nepali (Roman)",
        "target_label": "English",
    },
]


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def main() -> int:
    items: list[dict] = []
    for meta in CLASSES:
        cid = meta["id"]
        sources = {r["id"]: r for r in load_jsonl(GOLD / cid / "sources.jsonl") if r.get("id")}
        refs = {r["id"]: r for r in load_jsonl(GOLD / cid / "references.jsonl") if r.get("id")}
        for iid, src in sources.items():
            ref = refs.get(iid) or {}
            items.append(
                {
                    "id": iid,
                    "class_id": cid,
                    "direction": meta["direction"],
                    "register": meta["register"],
                    "script": meta["script"],
                    "source_label": meta["source_label"],
                    "target_label": meta["target_label"],
                    "source": (src.get("source") or "").strip(),
                    "reference": (ref.get("reference") or "").strip(),
                    "deva": (src.get("deva") or ref.get("deva") or "") or None,
                }
            )
    pack = {
        "version": 2,
        "packed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "purpose": "in_app_gold_then_train_review",
        "n_items": len(items),
        "classes": CLASSES,
        "items": items,
    }
    text = json.dumps(pack, ensure_ascii=False, indent=2) + "\n"
    OUT_BENCH.parent.mkdir(parents=True, exist_ok=True)
    OUT_MOBILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_BENCH.write_text(text, encoding="utf-8")
    OUT_MOBILE.write_text(text, encoding="utf-8")
    print(f"Packed {len(items)} gold items -> {OUT_MOBILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
