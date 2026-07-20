#!/usr/bin/env python3
"""Continue IT2 gold job: train NE→EN if weights ready, then eval both."""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
NE = REPO / "training" / "artifacts" / "it2_indic_en_merged" / "model.safetensors"
OUT_NE = REPO / "training" / "artifacts" / "it2_indic_en_gold_ft"


def main() -> int:
    print("waiting for NE→EN weights…", flush=True)
    for _ in range(120):
        if NE.exists() and NE.stat().st_size > 800_000_000:
            print("found", NE, NE.stat().st_size, flush=True)
            break
        time.sleep(30)
    else:
        print("timeout waiting for weights", flush=True)
        return 1

    if not (OUT_NE / "config.json").exists():
        cmd = [
            sys.executable,
            str(REPO / "training" / "finetune_it2_gold.py"),
            "--directions",
            "ne-en",
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
        ]
        print("RUN", " ".join(cmd), flush=True)
        r = subprocess.call(cmd, cwd=str(REPO))
        if r != 0:
            return r

    # Eval when EN→NE FT also present
    en_ft = REPO / "training" / "artifacts" / "it2_en_indic_gold_ft"
    if (en_ft / "config.json").exists() and (OUT_NE / "config.json").exists():
        cmd = [
            sys.executable,
            str(REPO / "benchmarks" / "eval_it2_gold.py"),
            "--systems",
            "phrasebook,it2_base,it2_ft,it2_ft_notags",
            "--tag",
            "it2_gold_post",
        ]
        print("RUN", " ".join(cmd), flush=True)
        return subprocess.call(cmd, cwd=str(REPO))
    print("EN→NE FT not ready yet — skip eval", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
