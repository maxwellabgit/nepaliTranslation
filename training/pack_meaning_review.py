#!/usr/bin/env python3
"""Pack training/data/meaning_bank.jsonl into mobile/assets/meaning/review_pack.json."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BANK = REPO / "training" / "data" / "meaning_bank.jsonl"
OUT_MOBILE = REPO / "mobile" / "assets" / "meaning" / "review_pack.json"
OUT_TRAINING = REPO / "training" / "data" / "meaning_review_pack.json"


def main() -> None:
    if not BANK.exists():
        raise SystemExit(f"Missing {BANK}")
    items = []
    for line in BANK.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        mid = row.get("meaning_id")
        eng = (row.get("english") or "").strip()
        if not mid or not eng:
            continue
        items.append(
            {
                "meaning_id": mid,
                "english": eng,
                "ne_formal": (row.get("ne_formal") or "").strip(),
                "ne_informal": (row.get("ne_informal") or "").strip(),
                "roman_formal": (row.get("roman_formal") or "").strip(),
                "roman_informal": (row.get("roman_informal") or "").strip(),
                "surface": row.get("surface") or "travel",
                "provenance": row.get("provenance") or "meaning_bank",
                "unit": row.get("unit") or "sentence",
            }
        )
    # Stable order: surface then meaning_id
    items.sort(key=lambda r: (r["surface"], r["meaning_id"]))
    pack = {
        "version": 1,
        "packed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "purpose": "in_app_meaning_unit_review",
        "model_family": "indictrans2-dist-200M",
        "n_items": len(items),
        "items": items,
    }
    OUT_MOBILE.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(pack, ensure_ascii=False, indent=2)
    OUT_MOBILE.write_text(text + "\n", encoding="utf-8")
    OUT_TRAINING.write_text(text + "\n", encoding="utf-8")
    print(f"Packed {len(items)} meanings -> {OUT_MOBILE}")


if __name__ == "__main__":
    main()
