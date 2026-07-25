#!/usr/bin/env python3
"""Promote teacher-reviewed synthetic rows into gold/parallel_trusted for training."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REVIEWED = REPO / "datasets" / "synthetic" / "teacher_reviewed"
OUT = REPO / "datasets" / "gold" / "sources" / "parallel_trusted" / "from_teacher_review.jsonl"


def latest() -> Path:
    files = sorted(REVIEWED.glob("teacher_*.jsonl"))
    if not files:
        raise SystemExit(f"No teacher_reviewed jsonl in {REVIEWED}")
    return files[-1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, default=None)
    ap.add_argument(
        "--include",
        default="accept_student,prefer_teacher",
        help="Comma actions to promote (exclude needs_human by default)",
    )
    args = ap.parse_args()
    src = args.input or latest()
    allow = {a.strip() for a in args.include.split(",") if a.strip()}
    rows = [json.loads(l) for l in src.read_text(encoding="utf-8").splitlines() if l.strip()]
    out_rows = []
    for r in rows:
        if r.get("action") not in allow:
            continue
        out_rows.append(
            {
                "meaning_id": f"syn_{r.get('id')}",
                "english": r["english"],
                "ne_formal": r.get("ne_formal") or r.get("ne_formal_teacher"),
                "ne_informal": r.get("ne_informal") or r.get("ne_informal_teacher"),
                "surface": r.get("domain") or "travel",
                "provenance": "teacher_reviewed_synthetic",
                "trust": "silver",
                "teacher_action": r.get("action"),
                "promoted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in out_rows) + "\n",
        encoding="utf-8",
    )
    print(f"Promoted {len(out_rows)} -> {OUT}")


if __name__ == "__main__":
    main()
