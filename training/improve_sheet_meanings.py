#!/usr/bin/env python3
"""Map a five-column sheet into the meaning schema and keep it unapproved.

Columns: english, devanagari, devanagari_informal, roman, roman_informal.
Schema: english, ne_formal, ne_informal, roman_formal, roman_informal.

Reviewer decision and source rights are copied only when the sheet already
has them. They are never defaulted to approved or cleared.

Benchmark matches, gold-blocklist strings, and public-review exposures
(including the retired 40-row blind split, which now lives in that pool)
are excluded. Nothing is written into benchmarks/gold/.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from training.prepare_cpu_mix import blocked_text, load_blocklist, norm  # noqa: E402

SHEET = Path(r"C:\Users\maxwe\Downloads\TRAINING - nepali_training_benchmark_review (1).csv")
OUT = REPO / "training" / "data" / "improved"
GOLD_DIR = REPO / "benchmarks" / "gold"

FIELD_MAP = {
    "english": "english",
    "devanagari": "ne_formal",
    "devanagari_informal": "ne_informal",
    "roman": "roman_formal",
    "roman_informal": "roman_informal",
}
BENCHMARKS = {
    "opus100_test",
    "flores_plus_dev",
    "flores101_dev",
    "in22_conv",
    "bpcc_daily",
}
REVIEW_COLUMNS = [
    "meaning_id",
    "english",
    "ne_formal",
    "ne_informal",
    "roman_formal",
    "roman_informal",
    "provenance",
    "source_file",
    "source_rights",
    "register_applicability",
    "reviewer_correction_ne_formal",
    "reviewer_correction_ne_informal",
    "reviewer_correction_roman_formal",
    "reviewer_correction_roman_informal",
    "reviewer_decision",
    "reviewer",
    "reviewer_date",
    "exclusion_reason",
    "correction_note",
]
APPROVED_DECISION = "approved"
APPROVED_RIGHTS = {"approved", "cleared", "cleared_public_display"}
FORMAL = re.compile(r"तपाईं|तपाईँ|नुहुन्छ|नुहोस्")
INFORMAL = re.compile(r"तिमी|तिम्रो|देऊ|जाऊ|आऊ")
DEVA = re.compile(r"[\u0900-\u097F]")


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def load_jsonl(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def exposure_norms() -> set[str]:
    """Public-review text, including the retired blind prompts now in that pool."""
    found: set[str] = set()
    paths = [
        REPO / "balance_data" / "review_pool" / "for_review.jsonl",
        REPO / "balance_data" / "prompts.jsonl",
        REPO / "balance_data" / "candidates.jsonl",
    ]
    for path in paths:
        for row in load_jsonl(path):
            for key in ("source_text", "proposed_target", "candidate", "src", "tgt", "mix_reference"):
                text = row.get(key)
                if isinstance(text, str) and text.strip():
                    found.add(norm(text))
    for row in load_jsonl(REPO / "balance_data" / "base_vs_e1_val.jsonl"):
        for key in ("src", "mix_reference", "base", "e1"):
            text = row.get(key)
            if isinstance(text, str) and text.strip():
                found.add(norm(text))
    return found


def classify(text: str) -> str:
    if not text:
        return "empty"
    if "तँ" in text:
        return "prohibited"
    formal = bool(FORMAL.search(text))
    informal = bool(INFORMAL.search(text))
    if formal and informal:
        return "mixed"
    if formal:
        return "formal"
    if informal:
        return "informal"
    return "neutral"


def map_row(raw: dict) -> dict:
    mapped = {schema: (raw.get(sheet) or "").strip() for sheet, schema in FIELD_MAP.items()}
    mapped["meaning_id"] = (raw.get("id") or raw.get("meaning_id") or "").strip()
    mapped["set_name"] = (raw.get("set_name") or raw.get("section") or "").strip()
    mapped["provenance"] = (raw.get("provenance") or "").strip()
    mapped["source_file"] = (raw.get("source_file") or "").strip()
    mapped["source_rights"] = (raw.get("source_rights") or "").strip()
    mapped["reviewer_decision"] = (raw.get("reviewer_decision") or "").strip()
    mapped["reviewer"] = (raw.get("reviewer") or "").strip()
    mapped["reviewer_date"] = (raw.get("reviewer_date") or "").strip()
    mapped["exclusion_reason"] = (raw.get("exclusion_reason") or "").strip()
    mapped["correction_note"] = ""
    mapped["register_applicability"] = ""
    for key in (
        "reviewer_correction_ne_formal",
        "reviewer_correction_ne_informal",
        "reviewer_correction_roman_formal",
        "reviewer_correction_roman_informal",
    ):
        mapped[key] = (raw.get(key) or "").strip()
    return mapped


def benchmark_reason(row: dict, blocked: set[str]) -> str:
    name = row["set_name"]
    if name.startswith("gold_") or name in BENCHMARKS:
        return "benchmark_match"
    texts = [row["english"], row["ne_formal"], row["ne_informal"], row["roman_formal"], row["roman_informal"]]
    if blocked_text(blocked, *texts):
        return "benchmark_match"
    return ""


def exposure_reason(row: dict, exposed: set[str]) -> str:
    for text in (row["english"], row["ne_formal"], row["ne_informal"]):
        if text and norm(text) in exposed:
            return "public_review_exposure"
    return ""


def align_registers(rows: list[dict]) -> None:
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        if row["english"]:
            groups[norm(row["english"])].append(row)

    for group in groups.values():
        for row in group:
            formal_kind = classify(row["ne_formal"])
            informal_kind = classify(row["ne_informal"])
            if formal_kind == "informal" and informal_kind == "formal":
                row["ne_formal"], row["ne_informal"] = row["ne_informal"], row["ne_formal"]
                row["roman_formal"], row["roman_informal"] = row["roman_informal"], row["roman_formal"]
                row["correction_note"] = "swapped formal and informal columns"

        formal_donors = [row for row in group if classify(row["ne_formal"]) == "formal"]
        informal_donors = [row for row in group if classify(row["ne_informal"]) == "informal"]
        formal_text = {row["ne_formal"] for row in formal_donors}
        informal_text = {row["ne_informal"] for row in informal_donors}

        for row in group:
            if classify(row["ne_formal"]) == "informal" and len(formal_text) == 1:
                donor = formal_donors[0]
                row["ne_formal"] = donor["ne_formal"]
                row["roman_formal"] = donor["roman_formal"]
                row["correction_note"] = (row["correction_note"] + "; " if row["correction_note"] else "") + (
                    f"ne_formal taken from {donor['meaning_id'] or 'sibling'}"
                )
            if row["ne_formal"] == row["ne_informal"] and classify(row["ne_formal"]) == "formal" and len(informal_text) == 1:
                donor = informal_donors[0]
                row["ne_informal"] = donor["ne_informal"]
                row["roman_informal"] = donor["roman_informal"]
                note = f"ne_informal taken from {donor['meaning_id'] or 'sibling'}"
                row["correction_note"] = (row["correction_note"] + "; " if row["correction_note"] else "") + note
            if row["ne_formal"] == row["ne_informal"] and classify(row["ne_formal"]) == "informal" and len(formal_text) == 1:
                donor = formal_donors[0]
                row["ne_formal"] = donor["ne_formal"]
                row["roman_formal"] = donor["roman_formal"]
                note = f"ne_formal taken from {donor['meaning_id'] or 'sibling'}"
                row["correction_note"] = (row["correction_note"] + "; " if row["correction_note"] else "") + note

    owners: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        if row["ne_formal"] and row["english"]:
            owners[norm(row["ne_formal"])].add(norm(row["english"]))
    for row in rows:
        if row["ne_formal"] and len(owners[norm(row["ne_formal"])]) > 1 and not row["exclusion_reason"]:
            row["exclusion_reason"] = "misaligned_pair"


def mark_remaining(row: dict) -> None:
    if row["exclusion_reason"]:
        return
    if not row["english"] or not row["ne_formal"]:
        row["exclusion_reason"] = "incomplete_pair"
        return
    if classify(row["ne_formal"]) == "prohibited" or classify(row["ne_informal"]) == "prohibited":
        row["exclusion_reason"] = "register_prohibited"
        return
    if classify(row["ne_formal"]) == "mixed" or classify(row["ne_informal"]) == "mixed":
        row["exclusion_reason"] = "register_mixed"
        return
    if classify(row["ne_formal"]) == "informal":
        row["exclusion_reason"] = "register_mismatch"
        return
    if row["ne_informal"] and classify(row["ne_informal"]) == "formal":
        row["exclusion_reason"] = "register_mismatch"
        return
    if (row["roman_formal"] and DEVA.search(row["roman_formal"])) or (
        row["roman_informal"] and DEVA.search(row["roman_informal"])
    ):
        row["exclusion_reason"] = "misaligned_pair"
        return
    if row["ne_formal"] == row["ne_informal"] or not row["ne_informal"]:
        row["register_applicability"] = "neutral_until_reviewed"
    else:
        row["register_applicability"] = "distinct_until_reviewed"


def real_review(row: dict) -> bool:
    return (
        row["reviewer_decision"].lower() == APPROVED_DECISION
        and row["source_rights"].lower() in APPROVED_RIGHTS
        and bool(row["reviewer"])
        and bool(row["reviewer_date"])
        and not row["exclusion_reason"]
        and bool(row["english"])
        and bool(row["ne_formal"])
    )


def to_review_row(row: dict) -> dict:
    return {key: row.get(key, "") for key in REVIEW_COLUMNS}


def improve(sheet: Path, out_dir: Path) -> dict:
    if GOLD_DIR in out_dir.resolve().parents or out_dir.resolve() == GOLD_DIR.resolve():
        raise SystemExit("refusing to write into benchmarks/gold")
    blocked = load_blocklist()
    exposed = exposure_norms()
    mapped = [map_row(raw) for raw in read_csv(sheet)]
    excluded: list[dict] = []
    kept: list[dict] = []
    for row in mapped:
        reason = benchmark_reason(row, blocked) or exposure_reason(row, exposed)
        if reason:
            row["exclusion_reason"] = reason
            excluded.append(row)
        else:
            kept.append(row)
    align_registers(kept)
    for row in kept:
        mark_remaining(row)
        if row["exclusion_reason"]:
            excluded.append(row)
    review_rows = [row for row in kept if not row["exclusion_reason"]]
    accepted = [row for row in review_rows if real_review(row)]

    out_dir.mkdir(parents=True, exist_ok=True)
    review_path = out_dir / "meaning_review.csv"
    with review_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=REVIEW_COLUMNS)
        writer.writeheader()
        writer.writerows(to_review_row(row) for row in review_rows)
    excluded_path = out_dir / "excluded.jsonl"
    excluded_path.write_text(
        "".join(json.dumps(to_review_row(row), ensure_ascii=False) + "\n" for row in excluded),
        encoding="utf-8",
    )
    reasons = Counter(row["exclusion_reason"] for row in excluded)
    manifest = {
        "source_sheet": str(sheet),
        "mapped_rows": len(mapped),
        "review_rows": len(review_rows),
        "excluded_rows": len(excluded),
        "excluded_reasons": dict(reasons),
        "corrections": sum(1 for row in mapped if row["correction_note"]),
        "accepted_for_training": len(accepted),
        "accepted_for_benchmark": 0,
        "approval_fields_autofilled": False,
        "public_review_pool_excluded": True,
        "retired_blind_split": "covered by balance_data public-review texts; not written to benchmarks/gold",
        "note": "No training file is written until a person fills reviewer_decision, reviewer, reviewer_date, and source_rights.",
    }
    (out_dir / "accepted_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    if accepted:
        raise SystemExit("approved rows were present; this tool does not write a training mix")
    print(json.dumps(manifest, indent=2, ensure_ascii=False), flush=True)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Map a five-column sheet into an unapproved meaning review")
    parser.add_argument("--sheet", type=Path, default=SHEET)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    if not args.sheet.is_file():
        raise SystemExit(f"sheet not found: {args.sheet}")
    improve(args.sheet, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
