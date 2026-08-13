#!/usr/bin/env python3
"""
Local auto-train on this machine when ≥100 edited meanings have been routed.

Typical overnight flow (Windows):
  1. Export meaning reviews from the app → save as export.json
  2. python training/route_corrections.py export.json
  3. Leave this daemon running (or Task Scheduler at 1am):
       python training/local_auto_train.py --daemon
     or one-shot:
       python training/local_auto_train.py --if-ready

What it does when ready:
  - prepare_cpu_mix.py (clean bank + CPU jsonl)
  - finetune_it2_cpu.py --directions en-ne,ne-en
  - eval_it2_gold.py --systems it2_base,it2_cpu
  - reset edited_since_train counter
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ART = REPO / "training" / "artifacts"
READY = ART / "auto_train_ready.json"
STATE = ART / "correction_router_state.json"
LOG = ART / "auto_train_runs.jsonl"
EDIT_THRESHOLD = 100


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def is_ready() -> tuple[bool, dict]:
    if READY.exists():
        meta = json.loads(READY.read_text(encoding="utf-8"))
        if meta.get("ready") and int(meta.get("edited_since_train") or 0) >= EDIT_THRESHOLD:
            return True, meta
    if STATE.exists():
        st = json.loads(STATE.read_text(encoding="utf-8"))
        n = int(st.get("edited_since_train") or 0)
        if n >= EDIT_THRESHOLD:
            return True, {"edited_since_train": n, "threshold": EDIT_THRESHOLD}
    return False, {}


def run(cmd: list[str]) -> int:
    print("+", " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=str(REPO))


def train_once() -> int:
    ready, meta = is_ready()
    if not ready:
        print("Not ready — need ≥", EDIT_THRESHOLD, "edited meanings routed.")
        return 2

    ART.mkdir(parents=True, exist_ok=True)
    started = utc_now()
    print(f"[auto_train] START {started} meta={meta}", flush=True)

    steps = [
        [sys.executable, str(REPO / "training" / "prepare_cpu_mix.py")],
        [
            sys.executable,
            str(REPO / "training" / "finetune_it2_cpu.py"),
            "--directions",
            "en-ne,ne-en",
            "--epochs",
            "2",
        ],
    ]
    eval_script = REPO / "benchmarks" / "eval_it2_gold.py"
    if eval_script.exists():
        steps.append(
            [
                sys.executable,
                str(eval_script),
                "--systems",
                "it2_base,it2_cpu",
                "--tag",
                "cpu_clean",
            ]
        )

    codes = []
    for cmd in steps:
        code = run(cmd)
        codes.append(code)
        if code != 0:
            print(f"[auto_train] FAILED step exit={code}", flush=True)
            _log_run(started, False, codes, meta)
            return code

    st = {}
    if STATE.exists():
        st = json.loads(STATE.read_text(encoding="utf-8"))
    st["edited_since_train"] = 0
    st["last_train_at"] = utc_now()
    STATE.write_text(json.dumps(st, indent=2) + "\n", encoding="utf-8")
    if READY.exists():
        READY.unlink()

    _log_run(started, True, codes, meta)
    print(f"[auto_train] DONE {utc_now()}", flush=True)
    return 0


def _log_run(started: str, ok: bool, codes: list[int], meta: dict) -> None:
    row = {
        "started_at": started,
        "finished_at": utc_now(),
        "ok": ok,
        "exit_codes": codes,
        "meta": meta,
    }
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")


def daemon(poll_seconds: int) -> int:
    print(
        f"[auto_train] daemon watching every {poll_seconds}s "
        f"(threshold={EDIT_THRESHOLD} edited)",
        flush=True,
    )
    while True:
        ready, _ = is_ready()
        if ready:
            code = train_once()
            if code != 0:
                time.sleep(max(poll_seconds, 300))
            else:
                time.sleep(poll_seconds)
        else:
            time.sleep(poll_seconds)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--if-ready", action="store_true", help="Train once if threshold met")
    ap.add_argument("--force", action="store_true", help="Train even if under threshold")
    ap.add_argument("--daemon", action="store_true", help="Poll forever and train when ready")
    ap.add_argument("--poll-seconds", type=int, default=300)
    args = ap.parse_args()

    if args.force:
        ART.mkdir(parents=True, exist_ok=True)
        READY.write_text(
            json.dumps(
                {
                    "ready": True,
                    "edited_since_train": EDIT_THRESHOLD,
                    "threshold": EDIT_THRESHOLD,
                    "forced": True,
                    "written_at": utc_now(),
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    if args.daemon:
        raise SystemExit(daemon(args.poll_seconds))
    if args.if_ready or args.force:
        raise SystemExit(train_once())

    ready, meta = is_ready()
    print(json.dumps({"ready": ready, **meta}, indent=2))
    raise SystemExit(0 if ready else 1)


if __name__ == "__main__":
    main()
