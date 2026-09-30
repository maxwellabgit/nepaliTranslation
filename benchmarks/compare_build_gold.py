#!/usr/bin/env python3
"""Compare the shipped INT8 models with the new LoRA adapters on frozen gold.

Same sentences, same chrF helper, same formal/informal prefix, same Roman
converter, greedy decode, 96 new tokens. Does not edit benchmarks/gold/.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))

from certify_ship_artifacts import (  # noqa: E402
    CLASSES,
    TAAN,
    TAPAI,
    TIMI,
    rate,
    shipped_en_input,
)
from eval_it2_gold import chr_f, load_jsonl, norm  # noqa: E402
from eval_it2_onnx import MAX_NEW_TOKENS, OnnxIt2, roman_to_deva_batch  # noqa: E402

GOLD = ROOT / "gold"
THRESHOLDS = json.loads((ROOT / "ship_thresholds.json").read_text(encoding="utf-8"))
ONNX_EN = REPO / "mobile" / "assets" / "models" / "it2_en_indic"
ONNX_NE = REPO / "mobile" / "assets" / "models" / "it2_indic_en"
BASE_EN = REPO / "training" / "artifacts" / "it2_en_indic_merged"
BASE_NE = REPO / "training" / "artifacts" / "it2_indic_en_merged"
ADAPT_EN = REPO / "training" / "artifacts" / "it2_generated_en_ne_lora"
ADAPT_NE = REPO / "training" / "artifacts" / "it2_generated_ne_en_lora"
OUT = ROOT / "results" / "build_compare_gold.json"


def pairs_for(cls: str) -> list[tuple[str, str]]:
    sources = {row["id"]: row for row in load_jsonl(GOLD / cls / "sources.jsonl")}
    refs = {row["id"]: row for row in load_jsonl(GOLD / cls / "references.jsonl")}
    rows: list[tuple[str, str]] = []
    seen: set[str] = set()
    for item_id in sorted(sources):
        src, ref = sources[item_id]["source"], refs[item_id]["reference"]
        key = f"{norm(src)}|||{norm(ref)}"
        if key in seen:
            continue
        seen.add(key)
        rows.append((src, ref))
    return rows


def prepared_inputs(cls: str, rows: list[tuple[str, str]]) -> list[str]:
    texts = [shipped_en_input(cls, src) for src, _ in rows]
    if cls == "ne_en_roman":
        texts = roman_to_deva_batch([src for src, _ in rows])
    return texts


def summarize(cls: str, preds: list[str], refs: list[str]) -> dict:
    gate = THRESHOLDS["classes"][cls]
    scores = [chr_f(pred, ref) for pred, ref in zip(preds, refs)]
    mean = sum(scores) / len(scores) if scores else 0.0
    result = {
        "n": len(scores),
        "chrf_mean": round(mean, 4),
        "min_chrf": gate["min_chrf"],
        "pass_chrf": mean >= float(gate["min_chrf"]),
    }
    if "min_tapai_rate" in gate:
        result["tapai_rate"] = round(rate(TAPAI, preds), 4)
        result["pass_tapai"] = result["tapai_rate"] >= float(gate["min_tapai_rate"])
    if "min_timi_rate" in gate:
        result["timi_rate"] = round(rate(TIMI, preds), 4)
        result["pass_timi"] = result["timi_rate"] >= float(gate["min_timi_rate"])
    if "max_taan_rate" in gate:
        result["taan_rate"] = round(rate(TAAN, preds), 4)
        result["pass_taan"] = result["taan_rate"] <= float(gate["max_taan_rate"])
    return result


def score_onnx() -> dict:
    engines = {
        "en-ne": OnnxIt2(ONNX_EN),
        "ne-en": OnnxIt2(ONNX_NE),
    }
    out = {}
    for cls in CLASSES:
        gate = THRESHOLDS["classes"][cls]
        direction = gate["direction"]
        src_lang, tgt_lang = (
            ("npi_Deva", "eng_Latn") if direction == "ne-en" else ("eng_Latn", "npi_Deva")
        )
        rows = pairs_for(cls)
        texts = prepared_inputs(cls, rows)
        preds = []
        for index, text in enumerate(texts, start=1):
            preds.append(engines[direction].translate(text, src_lang, tgt_lang))
            if index % 25 == 0 or index == len(texts):
                print(f"[gold] int8 {cls} {index}/{len(texts)}", flush=True)
        out[cls] = summarize(cls, preds, [ref for _, ref in rows])
        print(f"[gold] int8 {cls} chrF {out[cls]['chrf_mean']:.4f}", flush=True)
    return out


def score_adapter() -> dict:
    import torch
    from IndicTransToolkit import IndicProcessor
    from peft import PeftModel
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    ip = IndicProcessor(inference=True)
    loaded = {}
    for direction, base, adapter in (
        ("en-ne", BASE_EN, ADAPT_EN),
        ("ne-en", BASE_NE, ADAPT_NE),
    ):
        tok = AutoTokenizer.from_pretrained(str(base), trust_remote_code=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(
            str(base), trust_remote_code=True, torch_dtype=torch.bfloat16
        )
        model = PeftModel.from_pretrained(model, str(adapter)).to("cuda").eval()
        loaded[direction] = (tok, model)
        print(f"[gold] loaded adapter {direction}", flush=True)

    out = {}
    for cls in CLASSES:
        gate = THRESHOLDS["classes"][cls]
        direction = gate["direction"]
        src_lang, tgt_lang = (
            ("npi_Deva", "eng_Latn") if direction == "ne-en" else ("eng_Latn", "npi_Deva")
        )
        tok, model = loaded[direction]
        rows = pairs_for(cls)
        texts = prepared_inputs(cls, rows)
        preds: list[str] = []
        for start in range(0, len(texts), 8):
            chunk = texts[start : start + 8]
            processed = ip.preprocess_batch(chunk, src_lang=src_lang, tgt_lang=tgt_lang)
            inputs = tok(
                processed, return_tensors="pt", padding=True, truncation=True, max_length=160
            ).to("cuda")
            with torch.no_grad():
                generated = model.generate(
                    **inputs,
                    max_new_tokens=MAX_NEW_TOKENS,
                    num_beams=1,
                    do_sample=False,
                )
            decoded = tok.batch_decode(generated, skip_special_tokens=True, clean_up_tokenization_spaces=True)
            try:
                decoded = ip.postprocess_batch(decoded, lang=tgt_lang)
            except Exception:
                pass
            preds.extend(decoded)
            print(f"[gold] adapter {cls} {len(preds)}/{len(texts)}", flush=True)
        out[cls] = summarize(cls, preds, [ref for _, ref in rows])
        print(f"[gold] adapter {cls} chrF {out[cls]['chrf_mean']:.4f}", flush=True)
    return out


def main() -> int:
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "holdout": "benchmarks/gold",
        "metric": "chrF_mean_char_trigram",
        "decode": "greedy, max_new_tokens=96, phone formal/informal prefix, shipped romanizer",
        "old": "mobile INT8 ONNX",
        "new": "dist-200M BF16 plus generated-data LoRA, not yet exported to ONNX",
        "int8": score_onnx(),
        "adapter": score_adapter(),
    }
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"[gold] wrote {OUT}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
