#!/usr/bin/env python3
"""Freeze gold_summary.json → gold_baseline.{json,md}."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

OUT = Path(__file__).resolve().parent / "results"
src = OUT / "gold_summary.json"
summary = json.loads(src.read_text(encoding="utf-8"))
shutil.copy2(src, OUT / "gold_baseline.json")

lines = [
    f"# Gold baseline (frozen {summary['generated_at'][:10]})",
    "",
    f"Status: **{summary['status']}** · {summary['total_filled']}/{summary['total_target']} samples",
    "",
    "| Class | n | Phrasebook chrF | Norm exact | Hit rate |",
    "|-------|--:|----------------:|-----------:|---------:|",
]
for c in summary["classes"]:
    pb = c["phrasebook_baseline"]
    lines.append(
        f"| `{c['class']}` | {c['n']} | {pb['chrf_mean']*100:.1f}% | "
        f"{pb['norm_exact_match']*100:.1f}% | {pb['coverage_hit_rate']*100:.0f}% |"
    )
lines += [
    "",
    "Visualizations: [`gold_viz/index.html`](gold_viz/index.html)",
    "",
    "This freezes the v1.4.0 phrasebook floor. On-device IndicTrans2 must beat these rates.",
    "",
]
(OUT / "gold_baseline.md").write_text("\n".join(lines), encoding="utf-8")
print("wrote", OUT / "gold_baseline.md")
