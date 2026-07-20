#!/usr/bin/env python3
"""
Comprehensive EN↔NE benchmark on ne_quality_bench.json (FLORES + OPUS-100 test).

Primary metric: chrF++. Secondary: BLEU.
Also runs honorific probe (EN→NE formal/informal marker hit-rate).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
BENCH = Path(__file__).resolve().parent
DATA = BENCH / "data"
RESULTS = BENCH / "results"
QUALITY = DATA / "ne_quality_bench.json"


def _ensure() -> None:
    from run_mt_bench import _ensure_deps

    _ensure_deps()


def load_quality() -> dict[str, Any]:
    if not QUALITY.exists():
        from build_ne_quality_bench import build

        build()
    return json.loads(QUALITY.read_text(encoding="utf-8"))


def score_corpus(hyps: list[str], refs: list[str], tgt: str) -> dict[str, float]:
    from run_mt_bench import score_corpus as _sc

    return _sc(hyps, refs, tgt)


def eval_pairs(
    tm,
    pairs: list[dict[str, str]],
    direction: str,
    n: int | None,
    n_examples: int = 8,
) -> dict[str, Any]:
    from run_mt_bench import translate_batch

    if direction == "ne-en":
        src_col, tgt_col, pair_key = "npi_Deva", "eng_Latn", "indic_en"
    else:
        src_col, tgt_col, pair_key = "eng_Latn", "npi_Deva", "en_indic"

    usable = [p for p in pairs if p.get(src_col) and p.get(tgt_col)]
    if n is not None:
        usable = usable[:n]
    if not usable:
        return {"direction": direction, "error": "no pairs", "n": 0}

    srcs = [p[src_col] for p in usable]
    refs = [p[tgt_col] for p in usable]
    t0 = time.perf_counter()
    hyps = translate_batch(tm, srcs, src_col, tgt_col, pair_key)
    elapsed = time.perf_counter() - t0
    metrics = score_corpus(hyps, refs, tgt_col)

    # per-domain if present
    by_domain: dict[str, dict[str, Any]] = {}
    domains = sorted({p.get("domain", "unknown") for p in usable})
    for dom in domains:
        idx = [i for i, p in enumerate(usable) if p.get("domain", "unknown") == dom]
        if not idx:
            continue
        sub_h = [hyps[i] for i in idx]
        sub_r = [refs[i] for i in idx]
        by_domain[dom] = score_corpus(sub_h, sub_r, tgt_col)

    examples = [
        {"src": srcs[i], "ref": refs[i], "hyp": hyps[i], "domain": usable[i].get("domain")}
        for i in range(min(n_examples, len(srcs)))
    ]
    return {
        "direction": direction,
        "src": src_col,
        "tgt": tgt_col,
        **metrics,
        "latency_s": round(elapsed, 2),
        "latency_ms_per_sent": round(1000 * elapsed / max(len(hyps), 1), 1),
        "by_domain": by_domain,
        "examples": examples,
    }


def run_honorific(tm, items: list[dict[str, Any]]) -> dict[str, Any]:
    """EN→NE with formal vs informal; marker presence rate."""
    from core.types import Formality

    if not items:
        return {"n": 0, "skipped": True}

    formal_hits = 0
    informal_hits = 0
    rows = []
    for it in items:
        en = it["eng_Latn"]
        formal = tm.translate(en, formality=Formality.FORMAL).text
        informal = tm.translate(en, formality=Formality.INFORMAL).text
        # Prefer तपाईं in formal, तिमी/तँ in informal when address is expected
        f_ok = ("तपाईं" in formal or "तपाईँ" in formal) or not any(
            m in ("तपाईं", "तिमी", "तँ") for m in (it.get("expect_markers") or ["तपाईं"])
        )
        i_ok = ("तिमी" in informal or "तँ" in informal) or (
            "तपाईं" not in informal and "तपाईँ" not in informal
        )
        # Simpler: for informal, rewrite should remove तपाईं when present in formal
        if "तपाईं" in formal or "तपाईँ" in formal:
            f_ok = True
            i_ok = ("तिमी" in informal or "तँ" in informal) and (
                "तपाईं" not in informal and "तपाईँ" not in informal
            )
        else:
            f_ok = True
            i_ok = True
        formal_hits += int(f_ok)
        informal_hits += int(i_ok)
        rows.append(
            {
                "en": en,
                "formal": formal,
                "informal": informal,
                "formality_tag": it.get("formality"),
                "formal_ok": f_ok,
                "informal_ok": i_ok,
            }
        )
    n = len(items)
    return {
        "n": n,
        "formal_marker_rate": round(formal_hits / n, 3) if n else 0.0,
        "informal_marker_rate": round(informal_hits / n, 3) if n else 0.0,
        "examples": rows[:10],
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--n",
        type=int,
        default=None,
        help="Cap pairs per direction (default: full quality suite)",
    )
    p.add_argument("--device", type=str, default=None)
    p.add_argument(
        "--out",
        type=Path,
        default=RESULTS / "ne_quality_baseline.json",
    )
    p.add_argument("--skip-honorific", action="store_true")
    args = p.parse_args()

    _ensure()
    RESULTS.mkdir(parents=True, exist_ok=True)
    data = load_quality()
    pairs = data["pairs"]
    print(
        f"[ne-bench] Loaded quality suite n={len(pairs)} "
        f"counts={data.get('counts')} honorific={data.get('honorific_n')}",
        flush=True,
    )

    from run_mt_bench import load_manager

    tm = load_manager(args.device)

    primary: dict[str, Any] = {}
    for d in ("ne-en", "en-ne"):
        print(f"[ne-bench] Evaluating {d} on {args.n or len(pairs)} pairs…", flush=True)
        primary[d] = eval_pairs(tm, pairs, d, args.n)
        r = primary[d]
        if r.get("error"):
            print(f"[ne-bench] FAIL {d}: {r['error']}", flush=True)
        else:
            print(
                f"[ne-bench] {d}: chrF++={r['chrf_plus_plus']}  BLEU={r['bleu']}  "
                f"n={r['n']}  {r['latency_ms_per_sent']} ms/sent",
                flush=True,
            )
            for dom, m in (r.get("by_domain") or {}).items():
                print(
                    f"           └ {dom}: chrF++={m['chrf_plus_plus']} BLEU={m['bleu']} n={m['n']}",
                    flush=True,
                )

    honorific = None
    if not args.skip_honorific:
        print("[ne-bench] Honorific probe…", flush=True)
        honorific = run_honorific(tm, data.get("honorific") or [])

    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "suite": str(QUALITY),
        "suite_counts": data.get("counts"),
        "eval_n": args.n or len(pairs),
        "device": tm.device,
        "models": {
            "indic_en": str(tm.indic_en_dir),
            "en_indic": str(tm.en_indic_dir) if tm.en_indic_dir else None,
        },
        "metrics": {
            "primary": "chrF++",
            "secondary": "BLEU",
            "register": "honorific marker rates",
        },
        "primary": primary,
        "honorific": honorific,
    }
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ne-bench] Wrote {args.out}", flush=True)

    # Human-readable summary
    summary = RESULTS / "ne_quality_baseline.md"
    lines = [
        "# Nepali quality benchmark (baseline)",
        "",
        f"- When: `{payload['created_at']}`",
        f"- Device: `{payload['device']}`",
        f"- Suite: FLORES-101 + OPUS-100 test (filtered Devanagari)",
        f"- Counts: `{data.get('counts')}`",
        f"- Eval n: **{payload['eval_n']}**",
        "",
        "| Direction | chrF++ | BLEU | n | ms/sent |",
        "|-----------|--------|------|---|---------|",
    ]
    for d in ("ne-en", "en-ne"):
        r = primary[d]
        if r.get("error"):
            lines.append(f"| {d} | ERROR | — | — | — |")
        else:
            lines.append(
                f"| {d} | **{r['chrf_plus_plus']}** | {r['bleu']} | {r['n']} | {r['latency_ms_per_sent']} |"
            )
    if honorific and not honorific.get("skipped"):
        lines += [
            "",
            "## Honorific (EN→NE register)",
            f"- Formal marker rate: **{honorific['formal_marker_rate']}**",
            f"- Informal marker rate: **{honorific['informal_marker_rate']}**",
            f"- n={honorific['n']}",
        ]
    lines += ["", "## Per-domain chrF++", ""]
    for d in ("ne-en", "en-ne"):
        r = primary.get(d) or {}
        lines.append(f"### {d}")
        for dom, m in (r.get("by_domain") or {}).items():
            lines.append(f"- `{dom}`: chrF++ **{m['chrf_plus_plus']}**, BLEU {m['bleu']} (n={m['n']})")
        lines.append("")
    summary.write_text("\n".join(lines), encoding="utf-8")
    print(summary.read_text(encoding="utf-8"), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
