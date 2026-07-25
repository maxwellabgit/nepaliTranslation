#!/usr/bin/env python3
"""
Correction router: meaning-unit review export → meaning_bank + founder queue.

Usage:
  python training/route_corrections.py path/to/export.json
  python training/route_corrections.py path/to/export.json --maybe-train

Routes:
  train_meaning (accepted | edited) → update training/data/meaning_bank.jsonl
  founder_queue (skipped)           → training/data/founder_review_queue.jsonl

When cumulative edited meanings since last train ≥ EDIT_THRESHOLD (100),
writes training/artifacts/auto_train_ready.json and optionally launches
training/local_auto_train.py --if-ready.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DATA = REPO / "training" / "data"
BANK = DATA / "meaning_bank.jsonl"
FOUNDER_Q = DATA / "founder_review_queue.jsonl"
EVENTS = DATA / "meaning_review_events.jsonl"
STATE = REPO / "training" / "artifacts" / "correction_router_state.json"
READY = REPO / "training" / "artifacts" / "auto_train_ready.json"
EDIT_THRESHOLD = 100


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_bank() -> dict[str, dict]:
    rows: dict[str, dict] = {}
    if not BANK.exists():
        return rows
    for line in BANK.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        mid = row.get("meaning_id")
        if mid:
            rows[mid] = row
    return rows


def write_bank(rows: dict[str, dict]) -> None:
    BANK.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        json.dumps(rows[k], ensure_ascii=False)
        for k in sorted(rows.keys(), key=lambda m: (rows[m].get("surface", ""), m))
    ]
    BANK.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8"))
    return {"edited_since_train": 0, "last_train_at": None, "last_routed_at": None}


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def append_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def route(export_path: Path) -> dict:
    payload = json.loads(export_path.read_text(encoding="utf-8"))
    reviews = payload.get("reviews") or {}
    if not isinstance(reviews, dict):
        raise SystemExit("export.reviews must be an object keyed by meaning_id")

    bank = load_bank()
    state = load_state()
    events: list[dict] = []
    founder_rows: list[dict] = []
    n_train = 0
    n_edited = 0
    n_accepted = 0
    n_skipped = 0

    for mid, rev in reviews.items():
        action = rev.get("action")
        route_name = rev.get("route") or (
            "founder_queue" if action == "skipped" else "train_meaning"
        )
        event = {
            "event_id": f"mre_{mid}_{rev.get('completed_at', utc_now())}",
            "meaning_id": mid,
            "action": action,
            "route": route_name,
            "flag_for_founder": bool(rev.get("flag_for_founder")),
            "fields_changed": rev.get("fields_changed") or [],
            "completed_at": rev.get("completed_at") or utc_now(),
            "export_file": str(export_path.name),
        }
        events.append(event)

        if route_name == "founder_queue" or action == "skipped":
            n_skipped += 1
            founder_rows.append(
                {
                    **event,
                    "english": rev.get("english"),
                    "ne_formal": rev.get("ne_formal_original"),
                    "ne_informal": rev.get("ne_informal_original"),
                    "roman_formal": rev.get("roman_formal_original"),
                    "roman_informal": rev.get("roman_informal_original"),
                    "surface": rev.get("surface"),
                    "provenance": rev.get("provenance"),
                    "status": "needs_founder",
                }
            )
            continue

        # train_meaning
        n_train += 1
        if action == "edited":
            n_edited += 1
        else:
            n_accepted += 1

        prev = bank.get(mid) or {
            "meaning_id": mid,
            "surface": rev.get("surface") or "travel",
            "provenance": rev.get("provenance") or "human_app_review",
            "unit": "sentence",
        }
        bank[mid] = {
            **prev,
            "meaning_id": mid,
            "english": (rev.get("english") or prev.get("english") or "").strip(),
            "ne_formal": (rev.get("ne_formal_final") or "").strip(),
            "ne_informal": (rev.get("ne_informal_final") or "").strip(),
            "roman_formal": (rev.get("roman_formal_final") or "").strip(),
            "roman_informal": (rev.get("roman_informal_final") or "").strip(),
            "surface": rev.get("surface") or prev.get("surface") or "travel",
            "provenance": "human_meaning_review",
            "unit": "sentence",
            "reviewed_at": rev.get("completed_at") or utc_now(),
            "review_action": action,
        }

    write_bank(bank)
    append_jsonl(EVENTS, events)
    if founder_rows:
        append_jsonl(FOUNDER_Q, founder_rows)

    state["edited_since_train"] = int(state.get("edited_since_train") or 0) + n_edited
    state["last_routed_at"] = utc_now()
    state["last_export"] = str(export_path)
    ready = state["edited_since_train"] >= EDIT_THRESHOLD
    if ready:
        READY.parent.mkdir(parents=True, exist_ok=True)
        READY.write_text(
            json.dumps(
                {
                    "ready": True,
                    "edited_since_train": state["edited_since_train"],
                    "threshold": EDIT_THRESHOLD,
                    "written_at": utc_now(),
                    "hint": "python training/local_auto_train.py --if-ready",
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    save_state(state)

    # Refresh mobile pack from updated bank
    try:
        subprocess.run(
            [sys.executable, str(REPO / "training" / "pack_meaning_review.py")],
            check=False,
            cwd=str(REPO),
        )
    except Exception:
        pass

    summary = {
        "n_train_meaning": n_train,
        "n_edited": n_edited,
        "n_accepted": n_accepted,
        "n_skipped_founder": n_skipped,
        "edited_since_train": state["edited_since_train"],
        "auto_train_ready": ready,
        "bank_size": len(bank),
        "founder_queue": str(FOUNDER_Q),
    }
    print(json.dumps(summary, indent=2))
    return summary


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("export_json", type=Path)
    ap.add_argument(
        "--maybe-train",
        action="store_true",
        help="If edited_since_train ≥ 100, run local_auto_train.py --if-ready",
    )
    args = ap.parse_args()
    if not args.export_json.exists():
        raise SystemExit(f"Missing {args.export_json}")
    summary = route(args.export_json)
    if args.maybe_train and summary.get("auto_train_ready"):
        cmd = [sys.executable, str(REPO / "training" / "local_auto_train.py"), "--if-ready"]
        print("Launching:", " ".join(cmd))
        raise SystemExit(subprocess.call(cmd, cwd=str(REPO)))


if __name__ == "__main__":
    main()
