#!/usr/bin/env python3
"""
Fresh baseline: current on-device student vs non-reviewed gold.

Writes immutable run under datasets/benchmarks/runs/<ts>_<tag>/.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

REPO = Path(__file__).resolve().parents[2]
RUNS = REPO / "datasets" / "benchmarks" / "runs"
GOLD = REPO / "benchmarks" / "gold"
EVAL = REPO / "benchmarks" / "eval_it2_gold.py"


def gold_snapshot_hash() -> str:
    h = hashlib.sha256()
    for cls in sorted(p.name for p in GOLD.iterdir() if p.is_dir()):
        for name in ("sources.jsonl", "references.jsonl"):
            p = GOLD / cls / name
            if p.exists():
                h.update(p.read_bytes())
    return h.hexdigest()[:16]


def git_commit() -> str:
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(REPO))
            .decode()
            .strip()
        )
    except Exception:
        return "unknown"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="prereview")
    ap.add_argument("--systems", default="it2_base", help="eval_it2_gold --systems value")
    args = ap.parse_args()

    if not EVAL.exists():
        raise SystemExit(f"Missing {EVAL}")

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = RUNS / f"{ts}_{args.tag}"
    run_dir.mkdir(parents=True, exist_ok=True)

    meta = {
        "tag": args.tag,
        "started_at": ts,
        "systems": args.systems,
        "model_note": "IndicTrans2 dist-200M student (on-device base)",
        "gold_root": "benchmarks/gold",
        "gold_snapshot": gold_snapshot_hash(),
        "git_commit": git_commit(),
        "review_status": "non_reviewed" if args.tag == "prereview" else args.tag,
    }
    (run_dir / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    cmd = [sys.executable, str(EVAL), "--systems", args.systems, "--tag", f"datasets_{args.tag}"]
    print("+", " ".join(cmd), flush=True)
    code = subprocess.call(cmd, cwd=str(REPO))
    results_dir = REPO / "benchmarks" / "results"
    candidates = sorted(results_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    metrics = None
    for c in candidates[:12]:
        try:
            data = json.loads(c.read_text(encoding="utf-8"))
        except Exception:
            continue
        blob = json.dumps(data)[:800].lower()
        if "chrf" in blob or "overall" in data or "systems" in data or "per_class" in data:
            metrics = data
            (run_dir / "metrics_source.txt").write_text(str(c) + "\n", encoding="utf-8")
            (run_dir / "metrics.json").write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
            )
            break

    if metrics is None:
        (run_dir / "metrics.json").write_text(
            json.dumps({"error": "eval finished but metrics file not located", "exit": code}, indent=2)
            + "\n",
            encoding="utf-8",
        )
    meta["finished_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta["exit_code"] = code
    (run_dir / "meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"Run folder: {run_dir}")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
