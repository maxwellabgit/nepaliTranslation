#!/usr/bin/env python3
"""
Evaluate phrasebook + NLLB base + NLLB LoRA (if present) on gold holdout.

Writes benchmarks/results/ft_pre_post_gold.json and .md
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
GOLD = ROOT / "gold"
OUT = ROOT / "results"
ADAPTER = REPO / "training" / "artifacts" / "nllb600m_en_ne_lora" / "adapter"
BASE = "facebook/nllb-200-distilled-600M"
CLASSES = ["en_ne_formal", "en_ne_informal", "ne_en_deva", "ne_en_roman"]


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def norm(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[?.!,;:।]+$", "", s)
    return re.sub(r"\s+", " ", s)


def chr_f(pred: str, ref: str, n: int = 3) -> float:
    def grams(text: str) -> dict[str, int]:
        t = re.sub(r"\s+", "", norm(text))
        if len(t) < n:
            return {t: 1} if t else {}
        out: dict[str, int] = {}
        for i in range(len(t) - n + 1):
            g = t[t : i + n] if False else t[i : i + n]
            out[g] = out.get(g, 0) + 1
        return out

    pg, rg = grams(pred), grams(ref)
    if not pg and not rg:
        return 1.0
    if not pg or not rg:
        return 0.0
    overlap = sum(min(pg[g], rg[g]) for g in pg if g in rg)
    prec = overlap / sum(pg.values())
    rec = overlap / sum(rg.values())
    if prec + rec == 0:
        return 0.0
    return 2 * prec * rec / (prec + rec)


def phrasebook_fn():
    sys.path.insert(0, str(REPO / "mobile" / "src" / "mt"))
    # Use Python port via scoring script if available; else call JS-less reimplementation
    # Load the same lexicon by importing score helper from existing eval
    from run_premium_model_eval import try_phrasebook

    return try_phrasebook()


def make_nllb(adapter: Path | None, use_formality_tags: bool = False):
    from benchmarks.hf_login import load_hf_token
    from huggingface_hub import login

    login(token=load_hf_token(), add_to_git_credential=False)
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    tok_src = str(adapter) if adapter and (adapter / "tokenizer_config.json").exists() else BASE
    tok = AutoTokenizer.from_pretrained(tok_src)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        BASE, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
    )
    if adapter and adapter.exists():
        from peft import PeftModel

        if len(tok) != model.get_input_embeddings().weight.shape[0]:
            model.resize_token_embeddings(len(tok))
        model = PeftModel.from_pretrained(model, str(adapter))
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    model.eval()
    id_ne = tok.convert_tokens_to_ids("npi_Deva")
    id_en = tok.convert_tokens_to_ids("eng_Latn")

    def translate(src: str, cls: str) -> str:
        text = src.strip()
        if not text:
            return ""
        if cls.startswith("en_ne"):
            if use_formality_tags:
                tag = "<informal> " if "informal" in cls else "<formal> "
                text = tag + text
            forced = id_ne
        else:
            forced = id_en
        inputs = tok(text, return_tensors="pt", truncation=True, max_length=128).to(device)
        with torch.no_grad():
            out = model.generate(
                **inputs,
                forced_bos_token_id=forced,
                max_new_tokens=96,
                num_beams=4,
            )
        return tok.decode(out[0], skip_special_tokens=True)

    return translate


def score(name: str, fn, max_per_class: int | None = None) -> dict:
    per = {}
    all_chrf = []
    t0 = time.time()
    for cls in CLASSES:
        sources = {r["id"]: r for r in load_jsonl(GOLD / cls / "sources.jsonl")}
        refs = {r["id"]: r for r in load_jsonl(GOLD / cls / "references.jsonl")}
        ids = sorted(sources.keys())
        if max_per_class:
            ids = ids[:max_per_class]
        scores = []
        tapai = timi = 0
        n_en_ne = 0
        for i in ids:
            pred = fn(sources[i]["source"], cls) or ""
            ref = refs[i]["reference"]
            scores.append(chr_f(pred, ref))
            if cls.startswith("en_ne"):
                n_en_ne += 1
                if "तपाईं" in pred or "तपाईँ" in pred:
                    tapai += 1
                if "तिमी" in pred or "तिम्रो" in pred:
                    timi += 1
        mean = sum(scores) / len(scores) if scores else 0.0
        all_chrf.extend(scores)
        per[cls] = {
            "n": len(scores),
            "chrf_mean": round(mean, 4),
            "tapai_rate": round(tapai / n_en_ne, 4) if n_en_ne else None,
            "timi_rate": round(timi / n_en_ne, 4) if n_en_ne else None,
        }
        print(f"  {name} {cls}: chrF={mean:.1%} n={len(scores)}", flush=True)
    overall = sum(all_chrf) / len(all_chrf) if all_chrf else 0.0
    return {
        "system": name,
        "overall_chrf": round(overall, 4),
        "seconds": round(time.time() - t0, 1),
        "per_class": per,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--systems", default="phrasebook,nllb_base,nllb_ft", help="comma list")
    ap.add_argument("--max-per-class", type=int, default=0, help="0=all")
    ap.add_argument("--tag", default="pre_post")
    args = ap.parse_args()
    max_n = args.max_per_class or None

    OUT.mkdir(parents=True, exist_ok=True)
    results = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_model": BASE,
        "adapter": str(ADAPTER) if ADAPTER.exists() else None,
        "systems": [],
    }

    wanted = [x.strip() for x in args.systems.split(",") if x.strip()]
    for name in wanted:
        print(f"\n== {name} ==", flush=True)
        if name == "phrasebook":
            # reuse existing loader
            sys.path.insert(0, str(ROOT))
            from run_premium_model_eval import load_phrasebook

            fn = load_phrasebook()
            if not fn:
                print("phrasebook unavailable", flush=True)
                continue
            results["systems"].append(score("phrasebook", fn, max_n))
        elif name == "nllb_base":
            results["systems"].append(
                score("nllb_base", make_nllb(None, use_formality_tags=False), max_n)
            )
        elif name == "nllb_ft":
            if not ADAPTER.exists():
                print("adapter missing — skip nllb_ft", flush=True)
                continue
            results["systems"].append(
                score("nllb_ft", make_nllb(ADAPTER, use_formality_tags=True), max_n)
            )
        else:
            print("unknown system", name, flush=True)

    json_path = OUT / f"ft_{args.tag}_gold.json"
    json_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        f"# Fine-tune gold evaluation (`{args.tag}`)",
        "",
        f"Generated: {results['generated_at']}",
        f"Base: `{BASE}`",
        f"Adapter: `{results['adapter']}`",
        "",
        "## Overall chrF",
        "",
        "| System | Overall chrF | seconds |",
        "|--------|-------------:|--------:|",
    ]
    for s in results["systems"]:
        lines.append(
            f"| `{s['system']}` | {100*s['overall_chrf']:.1f}% | {s['seconds']} |"
        )
    lines += ["", "## Per-class chrF", ""]
    header = "| Class | " + " | ".join(s["system"] for s in results["systems"]) + " |"
    sep = "|-------|" + "|".join(["-------:"] * len(results["systems"])) + "|"
    lines += [header, sep]
    for cls in CLASSES:
        row = [cls]
        for s in results["systems"]:
            row.append(f"{100*s['per_class'][cls]['chrf_mean']:.1f}%")
        lines.append("| " + " | ".join(row) + " |")
    md_path = OUT / f"ft_{args.tag}_gold.md"
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", json_path, md_path, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
