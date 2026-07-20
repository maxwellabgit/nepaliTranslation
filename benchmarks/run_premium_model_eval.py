#!/usr/bin/env python3
"""
Evaluate translation systems against premium gold (full classes + premium tier).

Systems (offline-friendly first):
  - phrasebook: mobile bundled lexicon
  - marian_hplt: HPLT/translate-*-v2.0-hplt_opus if downloadable
  - google_gtx: unofficial Google translate endpoint (baseline only)

Writes:
  benchmarks/results/premium_model_eval.json
  benchmarks/results/premium_model_eval.md
  benchmarks/results/gold_viz/model_compare.svg (+ png if matplotlib)
"""
from __future__ import annotations

import json
import re
import statistics
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GOLD = ROOT / "gold"
OUT = ROOT / "results"
VIZ = OUT / "gold_viz"

CLASSES = [
    "en_ne_formal",
    "en_ne_informal",
    "ne_en_deva",
    "ne_en_roman",
]


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def norm(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[?.!,;:।]+$", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


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


def token_f1(pred: str, ref: str) -> float:
    a, b = set(norm(pred).split()), set(norm(ref).split())
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if not inter:
        return 0.0
    p, r = inter / len(a), inter / len(b)
    return 2 * p * r / (p + r)


def register_markers(text: str) -> dict:
    return {
        "tapai": ("तपाईं" in text) or ("तपाईँ" in text),
        "timi": ("तिमी" in text) or ("तिम्रो" in text),
    }


# ---- systems ----

def load_phrasebook():
    ts = (ROOT.parent / "mobile" / "src" / "mt" / "onDeviceTranslate.ts").read_text(
        encoding="utf-8"
    )
    pairs = re.findall(r"\['([^']*)',\s*'([^']*)'\]", ts)
    en2ne = {norm(a): b for a, b in pairs}
    ne2en = {norm(b): a for a, b in pairs}
    informal = [
        ("तपाईंहरू", "तिमीहरू"),
        ("तपाईंलाई", "तिमीलाई"),
        ("तपाईंको", "तिमीको"),
        ("तपाईंले", "तिमीले"),
        ("तपाईं", "तिमी"),
        ("तपाईँ", "तिमी"),
    ]

    def translate(src: str, cls: str) -> str:
        key = norm(src)
        if cls.startswith("en_ne"):
            pred = en2ne.get(key, "")
            if pred and cls == "en_ne_informal":
                for a, b in informal:
                    pred = pred.replace(a, b)
            return pred
        if cls == "ne_en_deva":
            return ne2en.get(key, "")
        return ""

    return translate


def try_marian():
    """Load HPLT Marian en↔ne if available."""
    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        import torch
    except Exception as e:
        print("transformers/torch unavailable", e)
        return None

    device = "cuda" if torch.cuda.is_available() else "cpu"
    models = {}
    for direction, repo in [
        ("en-ne", "HPLT/translate-en-ne-v2.0-hplt_opus"),
        ("ne-en", "HPLT/translate-ne-en-v2.0-hplt_opus"),
    ]:
        try:
            print("loading", repo, "…")
            tok = AutoTokenizer.from_pretrained(repo)
            model = AutoModelForSeq2SeqLM.from_pretrained(repo).to(device)
            model.eval()
            models[direction] = (tok, model)
            print("  ok", repo)
        except Exception as e:
            print("  fail", repo, e)

    if not models:
        return None

    def translate(src: str, cls: str) -> str:
        if cls.startswith("en_ne"):
            pair = models.get("en-ne")
        else:
            pair = models.get("ne-en")
        if not pair:
            return ""
        tok, model = pair
        # For roman class: pass roman as-is (model expects Deva usually — expect weak)
        inputs = tok(src, return_tensors="pt", truncation=True, max_length=128).to(device)
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=128, num_beams=4)
        return tok.decode(out[0], skip_special_tokens=True)

    return translate


def try_google_gtx():
    def translate(src: str, cls: str) -> str:
        if cls.startswith("en_ne"):
            sl, tl = "en", "ne"
        else:
            sl, tl = "ne", "en"
        q = urllib.parse.urlencode(
            {"client": "gtx", "sl": sl, "tl": tl, "dt": "t", "q": src}
        )
        url = f"https://translate.googleapis.com/translate_a/single?{q}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            parts = []
            for chunk in data[0] or []:
                if chunk and chunk[0]:
                    parts.append(chunk[0])
            return "".join(parts)
        except Exception:
            return ""

    return translate


def score_system(name: str, fn, premium_only: bool = False) -> dict:
    per_class = {}
    for cls in CLASSES:
        sources = {r["id"]: r for r in load_jsonl(GOLD / cls / "sources.jsonl")}
        refs = {r["id"]: r for r in load_jsonl(GOLD / cls / "references.jsonl")}
        ids = sorted(sources.keys())
        chrfs, f1s = [], []
        exact = norm_e = 0
        n = 0
        tapai_ok = timi_ok = reg_n = 0
        samples = []
        for sid in ids:
            srow, rrow = sources[sid], refs[sid]
            if premium_only and srow.get("tier") != "premium_word_choice":
                continue
            src, ref = srow.get("source") or "", rrow.get("reference") or ""
            if not src or not ref:
                continue
            n += 1
            pred = fn(src, cls) or ""
            c = chr_f(pred, ref)
            f = token_f1(pred, ref)
            chrfs.append(c)
            f1s.append(f)
            if pred == ref:
                exact += 1
            if pred and norm(pred) == norm(ref):
                norm_e += 1
            if cls.startswith("en_ne") and pred:
                reg_n += 1
                m = register_markers(pred)
                if cls == "en_ne_formal" and m["tapai"] and not m["timi"]:
                    tapai_ok += 1
                if cls == "en_ne_informal" and (m["timi"] or not m["tapai"]):
                    # soft: informal OK if no तपाईं when addressable, or has तिमी
                    if m["timi"] and not m["tapai"]:
                        timi_ok += 1
                    elif not m["tapai"] and not m["timi"]:
                        timi_ok += 1  # neutral impersonal
            if len(samples) < 3 and pred:
                samples.append({"source": src, "ref": ref, "pred": pred, "chrf": round(c, 3)})
            time.sleep(0.02 if name == "google_gtx" else 0)
        per_class[cls] = {
            "n": n,
            "chrf_mean": statistics.mean(chrfs) if chrfs else 0.0,
            "token_f1_mean": statistics.mean(f1s) if f1s else 0.0,
            "exact_match": exact / n if n else 0.0,
            "norm_exact": norm_e / n if n else 0.0,
            "formal_marker_rate": (tapai_ok / reg_n) if (cls == "en_ne_formal" and reg_n) else None,
            "informal_ok_rate": (timi_ok / reg_n) if (cls == "en_ne_informal" and reg_n) else None,
            "samples": samples,
        }
        print(
            f"  {name} {cls}: n={n} chrF={per_class[cls]['chrf_mean']:.3f} "
            f"exact={per_class[cls]['exact_match']:.3f}"
        )
    overall_n = sum(v["n"] for v in per_class.values())
    overall_chrf = (
        sum(v["chrf_mean"] * v["n"] for v in per_class.values()) / overall_n
        if overall_n
        else 0.0
    )
    return {
        "system": name,
        "overall_chrf": overall_chrf,
        "overall_n": overall_n,
        "classes": per_class,
    }


def svg_grouped(systems: list[dict], title: str) -> str:
    labels = [c.replace("en_ne_", "").replace("ne_en_", "") for c in CLASSES]
    w, h = 720, 320
    pad_l, pad_b, pad_t = 50, 50, 40
    chart_w, chart_h = w - pad_l - 30, h - pad_b - pad_t
    colors = ["#C8102E", "#0D652D", "#1A73E8", "#E8A317"]
    n_cls, n_sys = len(CLASSES), len(systems)
    group_w = chart_w / n_cls
    bar_w = group_w * 0.7 / max(n_sys, 1)
    bars = []
    for i, cls in enumerate(CLASSES):
        for j, sys in enumerate(systems):
            val = sys["classes"][cls]["chrf_mean"]
            bh = val * chart_h
            x = pad_l + i * group_w + j * bar_w + group_w * 0.15
            y = pad_t + chart_h - bh
            bars.append(
                f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{bh:.1f}" '
                f'fill="{colors[j % len(colors)]}" rx="3"/>'
            )
        bars.append(
            f'<text x="{pad_l + i * group_w + group_w/2:.1f}" y="{pad_t + chart_h + 18}" '
            f'text-anchor="middle" font-size="11" fill="#6B5E55">{labels[i]}</text>'
        )
    legend = []
    for j, sys in enumerate(systems):
        legend.append(
            f'<rect x="{pad_l + j*140}" y="8" width="12" height="12" fill="{colors[j % len(colors)]}"/>'
            f'<text x="{pad_l + j*140 + 18}" y="18" font-size="11" fill="#1A1410">{sys["system"]}</text>'
        )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <rect width="100%" height="100%" fill="#F7F1EA"/>
  <text x="{w/2}" y="28" text-anchor="middle" font-size="15" font-weight="700" fill="#1A1410">{title}</text>
  {''.join(legend)}
  <line x1="{pad_l}" y1="{pad_t+chart_h}" x2="{w-20}" y2="{pad_t+chart_h}" stroke="#E8DDD2"/>
  {''.join(bars)}
</svg>
"""


def write_md(report: dict) -> str:
    lines = [
        "# Premium gold model evaluation",
        "",
        f"Generated: {report['generated_at']}",
        "",
        f"Gold sizes: {report['gold_sizes']}",
        "",
        "## Overall chrF (weighted by class n)",
        "",
        "| System | Overall chrF | n |",
        "|--------|-------------:|--:|",
    ]
    for s in report["systems"]:
        lines.append(
            f"| `{s['system']}` | {s['overall_chrf']*100:.1f}% | {s['overall_n']} |"
        )
    lines += ["", "## Per-class chrF", ""]
    header = "| Class | " + " | ".join(s["system"] for s in report["systems"]) + " |"
    sep = "|-------|" + "|".join(["-------:"] * len(report["systems"])) + "|"
    lines += [header, sep]
    for cls in CLASSES:
        row = [f"`{cls}`"]
        for s in report["systems"]:
            row.append(f"{s['classes'][cls]['chrf_mean']*100:.1f}%")
        lines.append("| " + " | ".join(row) + " |")
    lines += [
        "",
        "## Register markers (EN→NE)",
        "",
        "| System | Formal तपाईं rate | Informal OK rate |",
        "|--------|------------------:|-----------------:|",
    ]
    for s in report["systems"]:
        f = s["classes"]["en_ne_formal"].get("formal_marker_rate")
        i = s["classes"]["en_ne_informal"].get("informal_ok_rate")
        lines.append(
            f"| `{s['system']}` | "
            f"{'—' if f is None else f'{f*100:.0f}%'} | "
            f"{'—' if i is None else f'{i*100:.0f}%'} |"
        )
    lines += [
        "",
        "## Notes",
        "",
        "- `phrasebook`: current on-device ship floor (bundled lexicon).",
        "- `marian_hplt`: open CC-BY HPLT Marian v2.0 (if loaded).",
        "- `google_gtx`: unofficial web endpoint — **demo baseline only**, not for production.",
        "- IndicTrans2-1B / cloud LLM oracles need HF gated access + API keys (see analysis report).",
        "- Premium tier items stress **word choice** and **honorifics**; chrF alone understates register errors.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    VIZ.mkdir(parents=True, exist_ok=True)

    sizes = {}
    for cls in CLASSES:
        src = load_jsonl(GOLD / cls / "sources.jsonl")
        sizes[cls] = {
            "n": len(src),
            "premium": sum(1 for s in src if s.get("tier") == "premium_word_choice"),
        }
    print("gold sizes", sizes)

    systems = []
    print("\n== phrasebook ==")
    systems.append(score_system("phrasebook", load_phrasebook()))

    print("\n== marian_hplt ==")
    marian = try_marian()
    if marian:
        systems.append(score_system("marian_hplt", marian))
    else:
        print("  skipped")

    print("\n== google_gtx ==")
    systems.append(score_system("google_gtx", try_google_gtx()))

    # Premium-only slice for phrasebook + google
    print("\n== premium-only phrasebook / google ==")
    premium_slice = {
        "phrasebook": score_system("phrasebook_premium", load_phrasebook(), premium_only=True),
        "google_gtx": score_system("google_gtx_premium", try_google_gtx(), premium_only=True),
    }
    if marian:
        premium_slice["marian_hplt"] = score_system(
            "marian_hplt_premium", marian, premium_only=True
        )

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "gold_sizes": sizes,
        "systems": systems,
        "premium_only": premium_slice,
        "research_shortlist_not_run": [
            "ai4bharat/indictrans2-en-indic-1B (MIT, gated — needs valid HF token)",
            "ai4bharat/indictrans2-indic-en-1B",
            "GPT-4o / Claude register oracles (API)",
            "Azure Translator + tone (API)",
            "DeepL ne (API)",
        ],
    }
    (OUT / "premium_model_eval.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    md = write_md(report)
    (OUT / "premium_model_eval.md").write_text(md, encoding="utf-8")

    svg = svg_grouped(systems, "chrF on expanded gold by system")
    (VIZ / "model_compare.svg").write_text(svg, encoding="utf-8")
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np

        fig, ax = plt.subplots(figsize=(9, 4.5))
        x = np.arange(len(CLASSES))
        width = 0.8 / len(systems)
        for j, s in enumerate(systems):
            vals = [s["classes"][c]["chrf_mean"] * 100 for c in CLASSES]
            ax.bar(x + j * width, vals, width, label=s["system"])
        ax.set_xticks(x + width * (len(systems) - 1) / 2)
        ax.set_xticklabels(
            [c.replace("en_ne_", "").replace("ne_en_", "") for c in CLASSES]
        )
        ax.set_ylabel("chrF %")
        ax.set_title("Model chrF on expanded gold")
        ax.legend()
        ax.set_ylim(0, 100)
        fig.tight_layout()
        fig.savefig(VIZ / "model_compare.png", dpi=160)
        plt.close(fig)
        print("png", VIZ / "model_compare.png")
    except Exception as e:
        print("matplotlib skip", e)

    print("\n" + md)


if __name__ == "__main__":
    main()
