#!/usr/bin/env python3
"""
Kick off commercial IndicTrans2 gold-domain training once bases are present.

Usage:
  python training/run_it2_gold_job.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
EN = REPO / "training" / "artifacts" / "it2_en_indic_merged"
NE = REPO / "training" / "artifacts" / "it2_indic_en_merged"


def has_weights(d: Path) -> bool:
    return (d / "model.safetensors").exists() or (d / "pytorch_model.bin").exists()


def main() -> int:
    if not has_weights(EN) or not has_weights(NE):
        print("Missing IT2 weights. Download first:", flush=True)
        print("  python training/download_it2.py", flush=True)
        return 1
    steps = [
        [sys.executable, str(REPO / "training" / "prepare_gold_domain_data.py")],
        [
            sys.executable,
            str(REPO / "training" / "finetune_it2_gold.py"),
            "--directions",
            "en-ne,ne-en",
            "--max-train",
            "18000",
            "--max-val",
            "500",
            "--epochs",
            "2",
            "--batch-size",
            "6",
            "--grad-accum",
            "4",
            "--lr",
            "8e-5",
            "--lora-r",
            "16",
            "--eval-steps",
            "250",
        ],
        [
            sys.executable,
            str(REPO / "benchmarks" / "eval_it2_gold.py"),
            "--systems",
            "phrasebook,it2_base,it2_ft,it2_ft_notags",
            "--tag",
            "it2_gold_post",
        ],
    ]
    for cmd in steps:
        print("RUN", " ".join(cmd), flush=True)
        r = subprocess.call(cmd, cwd=str(REPO))
        if r != 0:
            return r
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
