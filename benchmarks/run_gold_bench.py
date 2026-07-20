#!/usr/bin/env python3
"""
Score gold sets + write JSON results + HTML/PNG visualizations.

Baseline: exact / normalized match against references (phrasebook-era
placeholder until on-device IT2 is wired). Also reports register marker rates.
"""
from __future__ import annotations

import json
import re
import statistics
from collections import Counter
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


def token_f1(pred: str, ref: str) -> float:
    a = set(norm(pred).split())
    b = set(norm(ref).split())
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if inter == 0:
        return 0.0
    p = inter / len(a)
    r = inter / len(b)
    return 2 * p * r / (p + r)


def chr_f(pred: str, ref: str, n: int = 3) -> float:
    """Simple character n-gram F-score (chrF proxy without sacrebleu)."""

    def ngrams(s: str) -> Counter:
        s = norm(pred if s is pred else s)
        s = re.sub(r"\s+", "", s)
        if len(s) < n:
            return Counter([s] if s else [])
        return Counter(s[i : i + n] for i in range(len(s) - n + 1))

    # fix: use correct string
    def grams(text: str) -> Counter:
        t = re.sub(r"\s+", "", norm(text))
        if len(t) < n:
            return Counter([t] if t else [])
        return Counter(t[i : i + n] for i in range(len(t) - n + 1))

    pg, rg = grams(pred), grams(ref)
    if not pg and not rg:
        return 1.0
    if not pg or not rg:
        return 0.0
    overlap = sum((pg & rg).values())
    prec = overlap / sum(pg.values())
    rec = overlap / sum(rg.values())
    if prec + rec == 0:
        return 0.0
    return 2 * prec * rec / (prec + rec)


def register_ok(cls: str, ref: str, pred: str | None = None) -> dict:
    text = pred if pred is not None else ref
    has_tapai = "तपाईं" in text or "तपाईँ" in text
    has_timi = "तिमी" in text or "तिम्रो" in text or "तिमीलाई" in text
    if cls == "en_ne_formal":
        return {"tapai": has_tapai, "timi": has_timi, "ok": has_tapai and not has_timi}
    if cls == "en_ne_informal":
        # Many neutral lines lack 2nd-person; score only when address forms appear in ref
        ref_needs = ("तपाईं" in ref or "तिमी" in ref or "तिम्रो" in ref)
        if not ref_needs:
            return {"tapai": has_tapai, "timi": has_timi, "ok": True, "neutral": True}
        return {"tapai": has_tapai, "timi": has_timi, "ok": has_timi and not has_tapai}
    return {"ok": True}


def phrase_baseline(source: str, direction: str) -> str | None:
    """Tiny offline phrase table mirroring high-frequency app phrases."""
    # Lazy-load from gold itself for identity ceiling is wrong; use empty.
    # Baseline = identity for NE→EN romanized won't work. Return None = miss.
    _ = (source, direction)
    return None


def score_class(name: str) -> dict:
    sources = {r["id"]: r for r in load_jsonl(GOLD / name / "sources.jsonl")}
    refs = {r["id"]: r for r in load_jsonl(GOLD / name / "references.jsonl")}
    ids = sorted(sources.keys())
    assert len(ids) == 100, f"{name} expected 100, got {len(ids)}"

    exact = 0
    norm_exact = 0
    f1s: list[float] = []
    chrfs: list[float] = []
    src_lens: list[int] = []
    ref_lens: list[int] = []
    reg_ok = 0
    reg_n = 0
    filled = 0

    # Coverage / structure metrics (always). Prediction metrics use reference
    # as "oracle" for distribution viz, plus a null-model baseline (empty pred).
    for sid in ids:
        src = sources[sid].get("source") or ""
        ref = refs[sid].get("reference") or ""
        if not src or not ref:
            continue
        filled += 1
        src_lens.append(len(src.split()))
        ref_lens.append(len(ref.split()))
        # Null baseline: empty prediction → scores near 0 (honest floor)
        pred = ""
        if norm(pred) == norm(ref) and pred:
            norm_exact += 1
        if pred == ref and pred:
            exact += 1
        f1s.append(token_f1(pred, ref))
        chrfs.append(chr_f(pred, ref))
        ro = register_ok(name, ref)
        if name.startswith("en_ne"):
            reg_n += 1
            if ro.get("ok"):
                reg_ok += 1

    # Reference-side register quality (gold integrity)
    gold_reg_ok = 0
    gold_reg_n = 0
    for sid in ids:
        ref = refs[sid].get("reference") or ""
        if not ref:
            continue
        if name == "en_ne_formal":
            gold_reg_n += 1
            if register_ok(name, ref)["ok"] or not (
                "you" in sources[sid]["source"].lower()
                or "your" in sources[sid]["source"].lower()
                or sources[sid]["source"].lower().startswith("please")
                or "?" in sources[sid]["source"]
            ):
                # Count lines that either correctly mark तपाईं when addressable,
                # or are impersonal.
                ro = register_ok(name, ref)
                if "तपाईं" in ref or "तपाईँ" in ref:
                    gold_reg_ok += 1 if ro["ok"] else 0
                else:
                    gold_reg_ok += 1  # impersonal allowed
        elif name == "en_ne_informal":
            gold_reg_n += 1
            src_l = sources[sid]["source"].lower()
            addressable = any(
                w in src_l for w in ("you", "your", "please")
            ) or sources[sid]["source"].endswith("?")
            if not addressable:
                gold_reg_ok += 1
            else:
                ro = register_ok(name, ref)
                gold_reg_ok += 1 if (ro.get("timi") or ro.get("ok")) else 0

    return {
        "class": name,
        "n": filled,
        "n_target": 100,
        "coverage": filled / 100,
        "src_tokens_mean": statistics.mean(src_lens) if src_lens else 0,
        "src_tokens_median": statistics.median(src_lens) if src_lens else 0,
        "ref_tokens_mean": statistics.mean(ref_lens) if ref_lens else 0,
        "ref_tokens_median": statistics.median(ref_lens) if ref_lens else 0,
        "null_baseline": {
            "exact_match": exact / filled if filled else 0,
            "token_f1_mean": statistics.mean(f1s) if f1s else 0,
            "chrf_mean": statistics.mean(chrfs) if chrfs else 0,
        },
        "gold_register_integrity": {
            "rate": (gold_reg_ok / gold_reg_n) if gold_reg_n else None,
            "ok": gold_reg_ok,
            "n": gold_reg_n,
        },
        "src_len_hist": dict(Counter(min(12, L) for L in src_lens)),
        "ref_len_hist": dict(Counter(min(12, L) for L in ref_lens)),
    }


def svg_bar(labels: list[str], values: list[float], title: str, ymax: float = 1.0) -> str:
    w, h = 640, 280
    pad_l, pad_b, pad_t = 56, 48, 40
    chart_w = w - pad_l - 20
    chart_h = h - pad_b - pad_t
    bars = []
    n = max(len(labels), 1)
    bw = chart_w / n * 0.7
    gap = chart_w / n
    for i, (lab, val) in enumerate(zip(labels, values)):
        bh = (val / ymax) * chart_h if ymax else 0
        x = pad_l + i * gap + (gap - bw) / 2
        y = pad_t + chart_h - bh
        bars.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" '
            f'rx="6" fill="#C8102E"/>'
            f'<text x="{x + bw/2:.1f}" y="{pad_t + chart_h + 18}" '
            f'text-anchor="middle" font-size="11" fill="#6B5E55">{lab}</text>'
            f'<text x="{x + bw/2:.1f}" y="{y - 6:.1f}" text-anchor="middle" '
            f'font-size="12" font-weight="600" fill="#1A1410">{val:.0%}</text>'
        )
    return f"""
<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <rect width="100%" height="100%" fill="#F7F1EA"/>
  <text x="{w/2}" y="24" text-anchor="middle" font-size="16" font-weight="700" fill="#1A1410">{title}</text>
  <line x1="{pad_l}" y1="{pad_t}" x2="{pad_l}" y2="{pad_t+chart_h}" stroke="#E8DDD2"/>
  <line x1="{pad_l}" y1="{pad_t+chart_h}" x2="{w-20}" y2="{pad_t+chart_h}" stroke="#E8DDD2"/>
  {''.join(bars)}
</svg>
"""


def svg_hist(hist: dict, title: str) -> str:
    keys = sorted(int(k) for k in hist)
    labels = [str(k) if k < 12 else "12+" for k in keys]
    values = [hist[str(k)] if str(k) in hist else hist.get(k, 0) for k in keys]
    # normalize keys from Counter dump
    values = []
    for k in keys:
        values.append(hist.get(k, hist.get(str(k), 0)))
    mx = max(values) if values else 1
    w, h = 640, 260
    pad_l, pad_b, pad_t = 48, 44, 36
    chart_w = w - pad_l - 20
    chart_h = h - pad_b - pad_t
    bars = []
    n = max(len(keys), 1)
    gap = chart_w / n
    bw = gap * 0.75
    for i, (lab, val) in enumerate(zip(labels, values)):
        bh = (val / mx) * chart_h
        x = pad_l + i * gap + (gap - bw) / 2
        y = pad_t + chart_h - bh
        bars.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{bh:.1f}" rx="4" fill="#0D652D"/>'
            f'<text x="{x + bw/2:.1f}" y="{pad_t + chart_h + 16}" text-anchor="middle" font-size="10" fill="#6B5E55">{lab}</text>'
        )
    return f"""
<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <text x="{w/2}" y="22" text-anchor="middle" font-size="14" font-weight="700" fill="#1A1410">{title}</text>
  <line x1="{pad_l}" y1="{pad_t+chart_h}" x2="{w-20}" y2="{pad_t+chart_h}" stroke="#E8DDD2"/>
  {''.join(bars)}
</svg>
"""


def write_html(summary: dict) -> Path:
    VIZ.mkdir(parents=True, exist_ok=True)
    classes = summary["classes"]
    labels = [c["class"].replace("_", "\n") for c in classes]
    cov = [c["coverage"] for c in classes]
    cov_svg = svg_bar(
        [c["class"].replace("en_ne_", "").replace("ne_en_", "") for c in classes],
        cov,
        "Gold coverage (filled / 100)",
    )
    (VIZ / "coverage.svg").write_text(cov_svg, encoding="utf-8")

    reg_labels, reg_vals = [], []
    for c in classes:
        gri = c.get("gold_register_integrity") or {}
        if gri.get("rate") is not None:
            reg_labels.append(c["class"].replace("en_ne_", ""))
            reg_vals.append(gri["rate"])
    if reg_labels:
        reg_svg = svg_bar(reg_labels, reg_vals, "Gold register integrity (formal/informal)")
        (VIZ / "register.svg").write_text(reg_svg, encoding="utf-8")
    else:
        reg_svg = ""

    hist_blocks = []
    for c in classes:
        svg = svg_hist(c["src_len_hist"], f"{c['class']} — source token length")
        fname = f"hist_{c['class']}.svg"
        (VIZ / fname).write_text(svg, encoding="utf-8")
        hist_blocks.append(f'<figure><figcaption>{c["class"]}</figcaption>{svg}</figure>')

    rows = []
    for c in classes:
        gri = c.get("gold_register_integrity") or {}
        rows.append(
            f"<tr><td>{c['class']}</td><td>{c['n']}/100</td>"
            f"<td>{c['src_tokens_mean']:.1f}</td><td>{c['ref_tokens_mean']:.1f}</td>"
            f"<td>{(gri.get('rate') if gri.get('rate') is not None else '—')}</td></tr>"
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>NepTranslate gold benchmark</title>
<style>
  :root {{ --bg:#F7F1EA; --ink:#1A1410; --muted:#6B5E55; --crimson:#C8102E; --forest:#0D652D; }}
  body {{ font-family: "Segoe UI", system-ui, sans-serif; margin:0; background:var(--bg); color:var(--ink); }}
  main {{ max-width: 920px; margin: 0 auto; padding: 32px 20px 64px; }}
  h1 {{ font-size: 28px; letter-spacing:-0.02em; margin:0 0 8px; color:var(--crimson); }}
  .sub {{ color:var(--muted); margin-bottom: 28px; }}
  section {{ background:#fff; border-radius:20px; padding:22px; margin-bottom:18px; }}
  h2 {{ font-size:18px; margin:0 0 14px; }}
  table {{ width:100%; border-collapse:collapse; font-size:14px; }}
  th, td {{ text-align:left; padding:10px 8px; border-bottom:1px solid #E8DDD2; }}
  th {{ color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:0.04em; }}
  figure {{ margin: 16px 0; }}
  figcaption {{ font-size:12px; color:var(--muted); margin-bottom:6px; }}
  .grid {{ display:grid; gap:12px; }}
  .note {{ font-size:13px; color:var(--muted); line-height:1.5; }}
</style>
</head>
<body>
<main>
  <h1>NepTranslate gold benchmark</h1>
  <p class="sub">Generated {summary["generated_at"]} · {summary["total_filled"]} / {summary["total_target"]} samples</p>

  <section>
    <h2>Coverage</h2>
    {cov_svg}
  </section>

  {"<section><h2>Register integrity</h2>" + reg_svg + "</section>" if reg_svg else ""}

  <section>
    <h2>Class summary</h2>
    <table>
      <thead><tr><th>Class</th><th>Filled</th><th>Src tokens (mean)</th><th>Ref tokens (mean)</th><th>Register OK</th></tr></thead>
      <tbody>
        {''.join(rows)}
      </tbody>
    </table>
    <p class="note">Register OK applies to EN→NE formal/informal gold references (तपाईं vs तिमी). Model prediction scores will appear here once on-device IT2 is wired into <code>run_gold_bench.py</code>.</p>
  </section>

  <section>
    <h2>Source length distributions</h2>
    <div class="grid">
      {''.join(hist_blocks)}
    </div>
  </section>
</main>
</body>
</html>
"""
    path = VIZ / "index.html"
    path.write_text(html, encoding="utf-8")
    return path


def try_matplotlib(summary: dict) -> list[Path]:
    paths: list[Path] = []
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        return paths

    VIZ.mkdir(parents=True, exist_ok=True)
    classes = summary["classes"]
    names = [c["class"] for c in classes]
    cov = [c["coverage"] * 100 for c in classes]

    fig, ax = plt.subplots(figsize=(8, 4.2))
    ax.bar(names, cov, color="#C8102E")
    ax.set_ylim(0, 110)
    ax.set_ylabel("% filled")
    ax.set_title("Gold coverage by class")
    ax.tick_params(axis="x", rotation=20)
    fig.tight_layout()
    p = VIZ / "coverage.png"
    fig.savefig(p, dpi=160)
    plt.close(fig)
    paths.append(p)

    fig, axes = plt.subplots(2, 2, figsize=(9, 7))
    for ax, c in zip(axes.flat, classes):
        hist = c["src_len_hist"]
        xs = sorted(int(k) for k in hist)
        ys = [hist.get(k, hist.get(str(k), 0)) for k in xs]
        ax.bar([str(x) if x < 12 else "12+" for x in xs], ys, color="#0D652D")
        ax.set_title(c["class"])
        ax.set_xlabel("source tokens")
    fig.suptitle("Source length histograms")
    fig.tight_layout()
    p2 = VIZ / "length_hists.png"
    fig.savefig(p2, dpi=160)
    plt.close(fig)
    paths.append(p2)
    return paths


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    classes = [score_class(c) for c in CLASSES]
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_filled": sum(c["n"] for c in classes),
        "total_target": 400,
        "classes": classes,
        "status": "complete" if all(c["n"] == 100 for c in classes) else "incomplete",
    }
    (OUT / "gold_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    html = write_html(summary)
    pngs = try_matplotlib(summary)
    print("status:", summary["status"])
    print("html:", html)
    for p in pngs:
        print("png:", p)
    print("json:", OUT / "gold_summary.json")


if __name__ == "__main__":
    main()
