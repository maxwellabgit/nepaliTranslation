#!/usr/bin/env python3
"""Export a training mix only from reviewer-approved meaning-bank IDs.

Fails closed. An empty decision, missing rights approval, gold overlap, or
benchmark overlap aborts the export. Does not read or edit benchmarks/gold
references except to reject matching strings. Does not rewrite meaning_bank.jsonl.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from training.prepare_cpu_mix import blocked_text, load_blocklist, norm  # noqa: E402

BANK = REPO / "training" / "data" / "meaning_bank.jsonl"
APPROVED_DECISION = "approved"
APPROVED_RIGHTS = {"approved", "cleared"}


def load_bank() -> dict[str, dict]:
    rows = {}
    for line in BANK.read_text(encoding="utf-8").splitlines():
        if line.strip():
            row = json.loads(line)
            rows[row["meaning_id"]] = row
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a reviewed EN↔NE mix")
    parser.add_argument("--review", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if not args.review.is_file():
        raise SystemExit(f"review table not found: {args.review}")

    with args.review.open(encoding="utf-8", newline="") as handle:
        review_rows = list(csv.DictReader(handle))
    if not review_rows:
        raise SystemExit("review table is empty")

    approved = [
        row
        for row in review_rows
        if (row.get("reviewer_decision") or "").strip().lower() == APPROVED_DECISION
        and (row.get("source_rights") or "").strip().lower() in APPROVED_RIGHTS
        and not (row.get("exclusion_reason") or "").strip()
    ]
    if not approved:
        raise SystemExit(
            "no meaning is approved with cleared rights; refusing to write a training mix"
        )
    pending = len(review_rows) - len(approved)
    if pending:
        raise SystemExit(
            f"{pending} review rows are not approved; export the approved subset only after they are removed or marked excluded"
        )

    bank = load_bank()
    blocked = load_blocklist()
    train_en = []
    train_ne = []
    for row in approved:
        meaning_id = (row.get("meaning_id") or "").strip()
        source = bank.get(meaning_id)
        if source is None:
            raise SystemExit(f"approved id is not in the meaning bank: {meaning_id}")
        english = source["english"]
        formal = (row.get("reviewer_correction_ne_formal") or "").strip() or source["ne_formal"]
        informal = (row.get("reviewer_correction_ne_informal") or "").strip() or source["ne_informal"]
        for text in (english, formal, informal):
            if blocked_text(blocked, text) or norm(text) in blocked:
                raise SystemExit(f"gold or blocklist overlap for {meaning_id}")
        train_en.append(
            {
                "meaning_id": meaning_id,
                "src": f"<formal> {english}",
                "tgt": formal,
                "direction": "en-ne",
                "register": "formal",
            }
        )
        train_en.append(
            {
                "meaning_id": meaning_id,
                "src": f"<informal> {english}",
                "tgt": informal,
                "direction": "en-ne",
                "register": "informal",
            }
        )
        seen_ne = {formal}
        train_ne.append(
            {
                "meaning_id": meaning_id,
                "src": formal,
                "tgt": english,
                "direction": "ne-en",
                "register": "formal",
            }
        )
        if informal not in seen_ne:
            train_ne.append(
                {
                    "meaning_id": meaning_id,
                    "src": informal,
                    "tgt": english,
                    "direction": "ne-en",
                    "register": "informal",
                }
            )

    args.out.mkdir(parents=True, exist_ok=True)
    for name, rows in (("train_en-ne.jsonl", train_en), ("train_ne-en.jsonl", train_ne)):
        path = args.out / name
        path.write_text(
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
            encoding="utf-8",
        )
    manifest = {
        "approved_meanings": len(approved),
        "en_ne_pairs": len(train_en),
        "ne_en_pairs": len(train_ne),
        "weighting": "none; one exposure before any later cap of two",
        "roman_training": "not included; Roman is not labeled npi_Deva",
        "note": "Diagnostic only until a bilingual reviewer signs every approved row.",
    }
    (args.out / "reviewed_mix_manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"[reviewed-mix] meanings={len(approved)} en-ne={len(train_en)} ne-en={len(train_ne)}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
