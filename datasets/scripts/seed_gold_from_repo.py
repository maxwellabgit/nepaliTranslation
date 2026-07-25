#!/usr/bin/env python3
"""
Seed datasets/gold from high-trust repo sources (meaning bank hand seeds + premium notes).

Does NOT copy eval holdout strings into train paths without provenance tags.
Eval gold stays in benchmarks/gold/ — this folder is for training corpus building.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BANK = REPO / "training" / "data" / "meaning_bank.jsonl"
OUT_PAR = REPO / "datasets" / "gold" / "sources" / "parallel_trusted" / "meaning_bank_hand.jsonl"
OUT_NE = REPO / "datasets" / "gold" / "sources" / "nepali_trusted" / "from_meaning_bank.jsonl"
MANIFEST = REPO / "datasets" / "gold" / "manifests" / "parallel_trusted.json"

TRUSTED_PROVENANCE = {
    "hand_priority_seed",
    "assistant_curated",
    "hand_authored_seed",
    "human_meaning_review",
}


def main() -> None:
    OUT_PAR.parent.mkdir(parents=True, exist_ok=True)
    OUT_NE.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)

    if not BANK.exists():
        raise SystemExit(f"Missing {BANK}")

    parallel: list[dict] = []
    nepali: list[dict] = []
    for line in BANK.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        prov = row.get("provenance") or ""
        if prov not in TRUSTED_PROVENANCE and not str(prov).startswith("hand"):
            continue
        eng = (row.get("english") or "").strip()
        nf = (row.get("ne_formal") or "").strip()
        ni = (row.get("ne_informal") or "").strip()
        if not eng or (not nf and not ni):
            continue
        mid = row.get("meaning_id")
        parallel.append(
            {
                "meaning_id": mid,
                "english": eng,
                "ne_formal": nf,
                "ne_informal": ni,
                "roman_formal": row.get("roman_formal") or "",
                "roman_informal": row.get("roman_informal") or "",
                "surface": row.get("surface") or "travel",
                "provenance": prov,
                "trust": "high",
            }
        )
        if nf:
            nepali.append(
                {
                    "id": f"{mid}_formal",
                    "nepali": nf,
                    "register": "formal",
                    "english_anchor": eng,
                    "provenance": prov,
                }
            )
        if ni and ni != nf:
            nepali.append(
                {
                    "id": f"{mid}_informal",
                    "nepali": ni,
                    "register": "informal",
                    "english_anchor": eng,
                    "provenance": prov,
                }
            )

    OUT_PAR.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in parallel) + "\n",
        encoding="utf-8",
    )
    OUT_NE.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in nepali) + "\n",
        encoding="utf-8",
    )
    MANIFEST.write_text(
        json.dumps(
            {
                "packed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "n_parallel": len(parallel),
                "n_nepali_rows": len(nepali),
                "trusted_provenance": sorted(TRUSTED_PROVENANCE),
                "note": "Eval holdout remains in benchmarks/gold/; do not train on holdout.",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"parallel_trusted: {len(parallel)}")
    print(f"nepali_trusted:   {len(nepali)}")


if __name__ == "__main__":
    main()
