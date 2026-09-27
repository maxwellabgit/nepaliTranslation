#!/usr/bin/env python3
"""chrF delta: production-family base vs the sheet-50 LoRA adapters.

Reads benchmarks/gold. Does not edit it. Does not train.

The base system is the same pair eval_it2_gold.py calls it2_base
(it2_en_indic_merged and it2_indic_en_merged), scored with no control tags.

The sheet-50 system loads those bases plus the new adapters and uses the
tags the training script wrote:

  en_ne_formal      <formal> <deva>
  en_ne_informal    <informal> <deva>
  ne_en_deva        <formal> <deva>
  ne_en_roman       <formal> <roman>

  python benchmarks/eval_sheet50_delta.py
  python benchmarks/eval_sheet50_delta.py --run training/artifacts/sheet50_<stamp>
"""
from __future__ import annotations

import argparse
import gc
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "benchmarks"))

import eval_it2_gold as gold_eval  # noqa: E402

TAGS = {
    "en_ne_formal": ("en-ne", "<formal> <deva> "),
    "en_ne_informal": ("en-ne", "<informal> <deva> "),
    "ne_en_deva": ("ne-en", "<formal> <deva> "),
    "ne_en_roman": ("ne-en", "<formal> <roman> "),
}


def latest_run(explicit: Path | None) -> Path:
    if explicit is not None:
        if not explicit.exists():
            raise SystemExit(f"Missing run directory: {explicit}")
        return explicit
    runs = sorted(p for p in (REPO / "training" / "artifacts").glob("sheet50_*") if p.is_dir())
    if not runs:
        raise SystemExit("No training/artifacts/sheet50_* run. Train first.")
    return runs[-1]


def sheet50_translate(run: Path):
    en_adapter = run / "en-ne" / "adapter"
    ne_adapter = run / "ne-en" / "adapter"
    if not (en_adapter / "adapter_config.json").exists() or not (ne_adapter / "adapter_config.json").exists():
        raise SystemExit(f"Adapters missing under {run}")
    bare = gold_eval.make_it2(
        gold_eval.BASE_EN_NE,
        gold_eval.BASE_NE_EN,
        use_formality_prefix=False,
        adapter_en_ne=en_adapter,
        adapter_ne_en=ne_adapter,
    )

    def translate(src: str, cls: str) -> str:
        direction, prefix = TAGS[cls]
        text = f"{prefix}{src.strip()}"
        renamed = "en_ne_formal" if direction == "en-ne" else "ne_en_deva"
        # make_it2 only branches on the class prefix. The sheet-50 tag is already on the text.
        return bare(text, renamed)

    return translate


def release(fn) -> None:
    del fn
    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


def delta_row(base: dict, tuned: dict) -> dict:
    out = {
        "overall": round(tuned["overall_chrf"] - base["overall_chrf"], 4),
        "per_class": {},
    }
    for cls in gold_eval.CLASSES:
        out["per_class"][cls] = round(
            tuned["per_class"][cls]["chrf_mean"] - base["per_class"][cls]["chrf_mean"],
            4,
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", type=Path, default=None)
    args = parser.parse_args()
    run = latest_run(args.run)

    print("== it2_base ==", flush=True)
    base_fn = gold_eval.make_it2(
        gold_eval.BASE_EN_NE,
        gold_eval.BASE_NE_EN,
        use_formality_prefix=False,
    )
    base = gold_eval.score("it2_base", base_fn)
    release(base_fn)

    print("\n== sheet50 ==", flush=True)
    tuned_fn = sheet50_translate(run)
    tuned = gold_eval.score("sheet50", tuned_fn)
    release(tuned_fn)

    change = delta_row(base, tuned)
    results = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run": str(run),
        "metric": "chrF_mean_char_trigram",
        "base": "it2_en_indic_merged + it2_indic_en_merged, no control tags",
        "sheet50_tags": TAGS,
        "systems": [base, tuned],
        "delta_sheet50_minus_base": change,
        "note": "Positive delta means the new adapters scored higher. Gold files were not modified.",
    }
    gold_eval.OUT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = gold_eval.OUT / f"sheet50_delta_{stamp}.json"
    path.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(change, indent=2), flush=True)
    print("wrote", path, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
