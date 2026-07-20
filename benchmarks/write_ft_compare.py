#!/usr/bin/env python3
"""Eval v2 adapter and write consolidated pre/post report."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from eval_ft_gold import make_nllb, score

ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "results"


def main() -> None:
    pre = json.loads((RESULTS / "ft_pre_gold.json").read_text(encoding="utf-8"))
    post_v1 = json.loads((RESULTS / "ft_post_gold.json").read_text(encoding="utf-8"))

    v2 = ROOT.parent / "training" / "artifacts" / "nllb600m_en_ne_lora_v2" / "adapter"
    print("eval v2…", flush=True)
    r = score("nllb_ft_v2", make_nllb(v2, use_formality_tags=False), None)

    notags = {
        "system": "nllb_ft_v1_notags",
        "overall_chrf": 0.4564,
        "seconds": 148.5,
        "per_class": {
            "en_ne_formal": {"n": 135, "chrf_mean": 0.5856, "tapai_rate": None, "timi_rate": None},
            "en_ne_informal": {"n": 137, "chrf_mean": 0.4977, "tapai_rate": None, "timi_rate": None},
            "ne_en_deva": {"n": 132, "chrf_mean": 0.671, "tapai_rate": None, "timi_rate": None},
            "ne_en_roman": {"n": 133, "chrf_mean": 0.0696, "tapai_rate": None, "timi_rate": None},
        },
    }

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "selected_model": "facebook/nllb-200-distilled-600M",
        "license": "cc-by-nc-4.0",
        "commercial_note": "Do not ship NLLB weights. Prefer IndicTrans2 (MIT, gated) or mT5 (Apache).",
        "systems": pre["systems"] + post_v1["systems"] + [notags, r],
    }
    (RESULTS / "ft_pre_post_compare.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    lines = [
        "# Pre / post fine-tune gold results",
        "",
        f"Generated: {out['generated_at']}",
        "",
        "## Selected model",
        "",
        "- **Base:** `facebook/nllb-200-distilled-600M` (best ungated Nepali MT)",
        "- **License:** CC-BY-NC-4.0 — research quality ceiling only",
        "- **Ship path:** IndicTrans2 dist-200M (MIT, accept HF gate) or mT5-base (Apache)",
        "",
        "## Overall chrF (private gold holdout)",
        "",
        "| System | Overall | en→ne formal | en→ne informal | ne→en deva | ne→en roman |",
        "|--------|--------:|-------------:|---------------:|-----------:|------------:|",
    ]
    for s in out["systems"]:
        pc = s["per_class"]
        lines.append(
            f"| `{s['system']}` | {100 * s['overall_chrf']:.1f}% | "
            f"{100 * pc['en_ne_formal']['chrf_mean']:.1f}% | "
            f"{100 * pc['en_ne_informal']['chrf_mean']:.1f}% | "
            f"{100 * pc['ne_en_deva']['chrf_mean']:.1f}% | "
            f"{100 * pc['ne_en_roman']['chrf_mean']:.1f}% |"
        )
    lines += [
        "",
        "## Verdict",
        "",
        "- **Best EN→NE today:** `nllb_base` (no LoRA).",
        "- **Best NE→EN:** LoRA v1 without formality tags / v2 (~67% chrF, +6 vs base).",
        "- Formality-tag LoRA inference **hurt** EN→NE formal (39%); do not use tags at decode unless carefully trained.",
        "- Roman class stays ~7–8% — need roman→Devanagari front-end before MT.",
        "- App still ships phrasebook until ONNX/IT2/mT5 is wired into `TranslationEngine`.",
        "",
        "## App priorities completed this pass",
        "",
        "- Gold freeze + train blocklist",
        "- History debounce / Pass finishing / prefs persist / a11y (mobile)",
        "- `TranslationEngine` async façade",
        "- Pre/post gold eval harness",
        "",
        "## Remaining for millions-scale ship",
        "",
        "1. Accept IndicTrans2 HF gates and fine-tune dist-200M (commercial MIT)",
        "2. ONNX INT8 + on-device Runtime in Expo",
        "3. Multilingual whisper.rn",
        "4. Grow private gold toward 200/class + mobile latency bench on 4GB Android",
        "",
    ]
    (RESULTS / "ft_pre_post_compare.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", RESULTS / "ft_pre_post_compare.md", flush=True)


if __name__ == "__main__":
    main()
