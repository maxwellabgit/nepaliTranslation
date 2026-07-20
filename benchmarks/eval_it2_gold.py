#!/usr/bin/env python3
"""Pre/post gold eval for IndicTrans2 base vs gold-domain LoRA merges."""
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
CLASSES = ["en_ne_formal", "en_ne_informal", "ne_en_deva", "ne_en_roman"]

BASE_EN_NE = REPO / "training" / "artifacts" / "it2_en_indic_merged"
BASE_NE_EN = REPO / "training" / "artifacts" / "it2_indic_en_merged"
FT_EN_NE = REPO / "training" / "artifacts" / "it2_en_indic_gold_ft"
FT_NE_EN = REPO / "training" / "artifacts" / "it2_indic_en_gold_ft"


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


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
            g = t[i : i + n]
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


def make_it2(en_ne_dir: Path, ne_en_dir: Path, use_formality_prefix: bool):
    import torch
    from IndicTransToolkit import IndicProcessor
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    ip = IndicProcessor(inference=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    models = {}
    for direction, path in [("en-ne", en_ne_dir), ("ne-en", ne_en_dir)]:
        if not path.exists():
            print("missing", path, flush=True)
            continue
        tok = AutoTokenizer.from_pretrained(str(path), trust_remote_code=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(
            str(path),
            trust_remote_code=True,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        ).to(device)
        model.eval()
        models[direction] = (tok, model)

    def translate(src: str, cls: str) -> str:
        text = src.strip()
        if not text:
            return ""
        if cls.startswith("en_ne"):
            pair = models.get("en-ne")
            if not pair:
                return ""
            if use_formality_prefix:
                tag = "<informal> " if "informal" in cls else "<formal> "
                text = tag + text
            src_lang, tgt_lang = "eng_Latn", "npi_Deva"
        else:
            pair = models.get("ne-en")
            if not pair:
                return ""
            src_lang, tgt_lang = "npi_Deva", "eng_Latn"
            # roman class: still pass latin; model may struggle — measured honestly
        tok, model = pair
        processed = ip.preprocess_batch([text], src_lang=src_lang, tgt_lang=tgt_lang)
        inputs = tok(processed, return_tensors="pt", truncation=True, max_length=128).to(device)
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=96, num_beams=5, num_return_sequences=1)
        dec = tok.batch_decode(out, skip_special_tokens=True, clean_up_tokenization_spaces=True)
        try:
            return ip.postprocess_batch(dec, lang=tgt_lang)[0]
        except Exception:
            return dec[0] if dec else ""

    return translate


def score(name: str, fn) -> dict:
    per = {}
    all_s = []
    t0 = time.time()
    for cls in CLASSES:
        sources = {r["id"]: r for r in load_jsonl(GOLD / cls / "sources.jsonl")}
        refs = {r["id"]: r for r in load_jsonl(GOLD / cls / "references.jsonl")}
        scores = []
        tapai = timi = 0
        n_en = 0
        for i in sorted(sources):
            pred = fn(sources[i]["source"], cls) or ""
            scores.append(chr_f(pred, refs[i]["reference"]))
            if cls.startswith("en_ne"):
                n_en += 1
                if "तपाईं" in pred or "तपाईँ" in pred:
                    tapai += 1
                if "तिमी" in pred or "तिम्रो" in pred:
                    timi += 1
        mean = sum(scores) / len(scores) if scores else 0.0
        all_s.extend(scores)
        per[cls] = {
            "n": len(scores),
            "chrf_mean": round(mean, 4),
            "tapai_rate": round(tapai / n_en, 4) if n_en else None,
            "timi_rate": round(timi / n_en, 4) if n_en else None,
        }
        print(f"  {name} {cls}: {mean:.1%}", flush=True)
    return {
        "system": name,
        "overall_chrf": round(sum(all_s) / len(all_s), 4) if all_s else 0.0,
        "seconds": round(time.time() - t0, 1),
        "per_class": per,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--systems", default="it2_base,it2_ft")
    ap.add_argument("--tag", default="it2_gold")
    args = ap.parse_args()

    sys.path.insert(0, str(ROOT))
    results = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_family": "IndicTrans2-dist-200M",
        "license": "MIT",
        "commercial_ship": True,
        "systems": [],
    }
    wanted = [x.strip() for x in args.systems.split(",") if x.strip()]
    for name in wanted:
        print(f"\n== {name} ==", flush=True)
        if name == "phrasebook":
            from run_premium_model_eval import load_phrasebook

            results["systems"].append(score("phrasebook", load_phrasebook()))
        elif name == "it2_base":
            results["systems"].append(
                score("it2_base", make_it2(BASE_EN_NE, BASE_NE_EN, use_formality_prefix=False))
            )
        elif name == "it2_ft":
            if not FT_EN_NE.exists() or not FT_NE_EN.exists():
                print("FT checkpoints missing — skip", flush=True)
                continue
            results["systems"].append(
                score("it2_ft", make_it2(FT_EN_NE, FT_NE_EN, use_formality_prefix=True))
            )
        elif name == "it2_ft_notags":
            results["systems"].append(
                score("it2_ft_notags", make_it2(FT_EN_NE, FT_NE_EN, use_formality_prefix=False))
            )

    OUT.mkdir(parents=True, exist_ok=True)
    jp = OUT / f"ft_{args.tag}.json"
    jp.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        f"# IndicTrans2 gold eval (`{args.tag}`)",
        "",
        f"Generated: {results['generated_at']}",
        f"Family: {results['model_family']} (MIT, commercial OK)",
        "",
        "| System | Overall | formal | informal | ne→en | roman |",
        "|--------|--------:|-------:|---------:|------:|------:|",
    ]
    for s in results["systems"]:
        pc = s["per_class"]
        lines.append(
            f"| `{s['system']}` | {100*s['overall_chrf']:.1f}% | "
            f"{100*pc['en_ne_formal']['chrf_mean']:.1f}% | "
            f"{100*pc['en_ne_informal']['chrf_mean']:.1f}% | "
            f"{100*pc['ne_en_deva']['chrf_mean']:.1f}% | "
            f"{100*pc['ne_en_roman']['chrf_mean']:.1f}% |"
        )
    mp = OUT / f"ft_{args.tag}.md"
    mp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", jp, mp, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
