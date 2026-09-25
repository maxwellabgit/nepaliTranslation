#!/usr/bin/env python3
"""Split new prompts into a blind benchmark freeze and training candidates.

Benchmark rows are chosen before any training use. Their reviewer file has
no model suggestions. They are not added to the 543-row ship gold set.
"""
from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

HERE = Path(__file__).resolve().parent
import training.prepare_cpu_mix as mix  # noqa: E402


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")


def norm_src(text: str) -> str:
    raw = text.strip()
    for tag in ("<formal>", "<informal>"):
        if raw.startswith(tag):
            raw = raw[len(tag) :].strip()
    return mix.norm(raw)


def train_norms() -> set[str]:
    found: set[str] = set()
    for name in ("train_clean_en-ne.jsonl", "train_clean_ne-en.jsonl", "val_clean_en-ne.jsonl", "val_clean_ne-en.jsonl"):
        path = ROOT / "training" / "data" / name
        if not path.exists():
            continue
        for row in load_jsonl(path):
            found.add(norm_src(row.get("src") or ""))
    return found


def main() -> int:
    prompts = load_jsonl(HERE / "prompts.jsonl")
    candidates = load_jsonl(HERE / "candidates.jsonl")
    by_surface: dict[str, list[dict]] = {}
    for row in prompts:
        by_surface.setdefault(row["surface"], []).append(row)

    known = train_norms()
    blind_ids: set[str] = set()
    for rows in by_surface.values():
        ordered = sorted(rows, key=lambda r: r["id"])
        wanted = len(ordered) // 5
        primary = [row for i, row in enumerate(ordered) if i % 5 == 0]
        extras = [row for i, row in enumerate(ordered) if i % 5 != 0]
        chosen = []
        for row in primary + extras:
            if len(chosen) >= wanted:
                break
            if norm_src(row["source_text"]) in known:
                continue
            chosen.append(row["id"])
        if len(chosen) != wanted:
            raise SystemExit(f"could not reserve {wanted} non-overlapping rows")
        blind_ids.update(chosen)

    blocked = mix.load_blocklist()
    known = train_norms()
    gold_hits = []
    train_hits = []
    for row in prompts:
        if row["id"] not in blind_ids:
            continue
        if mix.blocked_text(blocked, row["source_text"]):
            gold_hits.append(row["id"])
        if norm_src(row["source_text"]) in known:
            train_hits.append(row["id"])

    blind_prompts = []
    for row in prompts:
        if row["id"] not in blind_ids:
            continue
        blind_prompts.append(
            {
                "id": row["id"],
                "direction": row["direction"],
                "surface": row["surface"],
                "register": row["register"],
                "source_text": row["source_text"],
                "reference": "",
                "reviewer_id": "",
                "review_status": "needs_blind_reference",
                "reviewer_note": (
                    "Write the reference from the source only. "
                    "Do not open model suggestions. "
                    "For second person, mark verb agreement even when no pronoun is written."
                ),
            }
        )

    by_id: dict[str, dict] = {}
    for row in candidates:
        if row["id"] in blind_ids:
            continue
        item = by_id.setdefault(
            row["id"],
            {
                "id": row["id"],
                "direction": row["direction"],
                "surface": row["surface"],
                "register": row["register"],
                "source_text": row["source_text"],
                "suggestions": [],
                "accepted_text": "",
                "provenance": "",
                "reviewer_id": "",
                "review_status": "needs_reviewer",
            },
        )
        item["suggestions"].append({"model": row["model"], "candidate": row.get("candidate")})

    freeze = {
        "name": "balance_blind_v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "rule": "Within each surface, sorted by id, every 5th row is reserved before training. An exact copy of the current mix is skipped and the next row in that surface is reserved instead.",
        "not_part_of_ship_gold": True,
        "ship_gold_rows": 543,
        "n": len(blind_prompts),
        "by_surface": dict(Counter(r["surface"] for r in blind_prompts)),
        "ids": [r["id"] for r in blind_prompts],
        "source_sha256": [
            hashlib.sha256(norm_src(r["source_text"]).encode("utf-8")).hexdigest()
            for r in blind_prompts
        ],
        "exact_overlap_gold_blocklist_ids": gold_hits,
        "exact_overlap_current_mix_ids": train_hits,
        "review_rule": "References are written without model suggestions. Do not merge into benchmarks/gold.",
    }
    write_jsonl(HERE / "benchmark_blind" / "for_reviewers.jsonl", blind_prompts)
    (HERE / "benchmark_blind" / "FREEZE.json").write_text(
        json.dumps(freeze, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_jsonl(HERE / "training_candidates" / "for_review.jsonl", list(by_id.values()))
    print(
        json.dumps(
            {
                "blind": len(blind_prompts),
                "training": len(by_id),
                "gold_overlap_ids": gold_hits,
                "mix_overlap_ids": train_hits,
                "blind_surfaces": freeze["by_surface"],
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
