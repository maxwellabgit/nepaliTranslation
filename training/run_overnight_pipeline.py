#!/usr/bin/env python3
"""
Overnight pipeline: wait for current big FT → eval → prepare hybrid → train overnight.

Usage:
  python training/run_overnight_pipeline.py
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
META_NE = REPO / "training" / "artifacts" / "it2_big_quality_ne_en_lora" / "ft_meta.json"
LOG = REPO / "training" / "artifacts" / "overnight_pipeline.log"


def log(msg: str) -> None:
    line = msg.rstrip() + "\n"
    print(line, end="", flush=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line)


def run(cmd: list[str]) -> int:
    log("RUN " + " ".join(cmd))
    return subprocess.call(cmd, cwd=str(REPO))


def wait_for_big_ft(timeout_s: int = 7200) -> bool:
    log("[pipeline] waiting for it2_big NE→EN ft_meta…")
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        if META_NE.exists():
            log("[pipeline] big FT complete")
            return True
        # Also exit wait if process gone and meta exists for en only — still wait
        time.sleep(30)
        log(f"[pipeline] still waiting… ({int(time.time() - t0)}s)")
    return META_NE.exists()


def main() -> int:
    LOG.write_text("", encoding="utf-8")
    if not wait_for_big_ft():
        log("[pipeline] timeout waiting for big FT — continuing overnight anyway")

    # Eval current big adapters if present
    if META_NE.exists():
        run(
            [
                sys.executable,
                "benchmarks/eval_it2_gold.py",
                "--systems",
                "it2_base,it2_big",
                "--tag",
                "it2_big_post",
            ]
        )

    if run([sys.executable, "training/prepare_overnight_hybrid.py"]) != 0:
        return 1

    # EN→NE first (5 epochs)
    if (
        run(
            [
                sys.executable,
                "training/finetune_it2_overnight.py",
                "--directions",
                "en-ne",
                "--max-train",
                "32000",
                "--max-val",
                "800",
                "--max-roman",
                "0",
                "--epochs",
                "5",
                "--batch-size",
                "8",
                "--grad-accum",
                "4",
                "--lr",
                "5e-5",
                "--lora-r",
                "16",
                "--lora-alpha",
                "32",
                "--eval-steps",
                "300",
            ]
        )
        != 0
    ):
        return 1

    # NE→EN (4 epochs + roman)
    if (
        run(
            [
                sys.executable,
                "training/finetune_it2_overnight.py",
                "--directions",
                "ne-en",
                "--max-train",
                "32000",
                "--max-val",
                "800",
                "--max-roman",
                "6000",
                "--epochs",
                "4",
                "--batch-size",
                "8",
                "--grad-accum",
                "4",
                "--lr",
                "5e-5",
                "--lora-r",
                "16",
                "--lora-alpha",
                "32",
                "--eval-steps",
                "300",
            ]
        )
        != 0
    ):
        return 1

    # Morning eval
    run(
        [
            sys.executable,
            "benchmarks/eval_it2_gold.py",
            "--systems",
            "it2_base,it2_big,it2_overnight",
            "--tag",
            "overnight_post",
        ]
    )
    log("[pipeline] DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
