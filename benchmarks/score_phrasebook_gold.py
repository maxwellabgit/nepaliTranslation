#!/usr/bin/env python3
"""Score current mobile phrasebook against gold; refresh viz with model bars."""
from __future__ import annotations

import json
import re
import statistics
from pathlib import Path

from run_gold_bench import (
    CLASSES,
    GOLD,
    OUT,
    VIZ,
    chr_f,
    load_jsonl,
    norm,
    svg_bar,
    token_f1,
    write_html,
    try_matplotlib,
)


def load_phrases() -> tuple[dict[str, str], dict[str, str]]:
    ts = Path(__file__).resolve().parents[1] / "mobile" / "src" / "mt" / "onDeviceTranslate.ts"
    text = ts.read_text(encoding="utf-8")
    pairs = re.findall(r"\['([^']*)',\s*'([^']*)'\]", text)
    en2ne: dict[str, str] = {}
    ne2en: dict[str, str] = {}
    for a, b in pairs:
        en2ne[norm(a)] = b
        ne2en[norm(b)] = a
    return en2ne, ne2en


INFORMAL = [
    ("तपाईंहरू", "तिमीहरू"),
    ("तपाईंलाई", "तिमीलाई"),
    ("तपाईंको", "तिमीको"),
    ("तपाईंले", "तिमीले"),
    ("तपाईं", "तिमी"),
    ("तपाईँ", "तिमी"),
]


def apply_informal(ne: str) -> str:
    out = ne
    for a, b in INFORMAL:
        out = out.replace(a, b)
    return out


def main() -> None:
    en2ne, ne2en = load_phrases()
    summary = json.loads((OUT / "gold_summary.json").read_text(encoding="utf-8"))

    for c in summary["classes"]:
        name = c["class"]
        sources = {r["id"]: r for r in load_jsonl(GOLD / name / "sources.jsonl")}
        refs = {r["id"]: r for r in load_jsonl(GOLD / name / "references.jsonl")}
        exact = norm_e = hits = 0
        f1s: list[float] = []
        chrfs: list[float] = []
        n = 0
        for sid, srow in sources.items():
            src = srow["source"]
            ref = refs[sid]["reference"]
            n += 1
            key = norm(src)
            if name.startswith("en_ne"):
                pred = en2ne.get(key)
            elif name == "ne_en_deva":
                pred = ne2en.get(key)
            else:
                pred = None
            if pred is None:
                pred = ""
            else:
                hits += 1
                if name == "en_ne_informal":
                    pred = apply_informal(pred)
            if pred == ref:
                exact += 1
            if pred and norm(pred) == norm(ref):
                norm_e += 1
            f1s.append(token_f1(pred, ref))
            chrfs.append(chr_f(pred, ref))
        c["phrasebook_baseline"] = {
            "phrase_pairs_loaded": len(en2ne),
            "coverage_hit_rate": hits / n,
            "exact_match": exact / n,
            "norm_exact_match": norm_e / n,
            "token_f1_mean": statistics.mean(f1s),
            "chrf_mean": statistics.mean(chrfs),
        }
        print(name, c["phrasebook_baseline"])

    (OUT / "gold_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Extra chart: phrasebook chrF by class
    labels = [c["class"].replace("en_ne_", "").replace("ne_en_", "") for c in summary["classes"]]
    chrf = [c["phrasebook_baseline"]["chrf_mean"] for c in summary["classes"]]
    exacts = [c["phrasebook_baseline"]["exact_match"] for c in summary["classes"]]
    (VIZ / "phrasebook_chrf.svg").write_text(
        svg_bar(labels, chrf, "Phrasebook baseline chrF (v1.4.0)"), encoding="utf-8"
    )
    (VIZ / "phrasebook_exact.svg").write_text(
        svg_bar(labels, exacts, "Phrasebook baseline exact match"), encoding="utf-8"
    )

    # Patch HTML with phrasebook section
    html_path = write_html(summary)
    extra = f"""
  <section>
    <h2>Current app baseline (phrasebook MT)</h2>
    {(VIZ / "phrasebook_chrf.svg").read_text(encoding="utf-8")}
    {(VIZ / "phrasebook_exact.svg").read_text(encoding="utf-8")}
    <p class=\"note\">Scores rise when on-device IndicTrans2 replaces the bundled phrase pack. Gold set remains the ship gate.</p>
  </section>
"""
    html = html_path.read_text(encoding="utf-8")
    html = html.replace("</main>", extra + "</main>")
    html_path.write_text(html, encoding="utf-8")

    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(8, 4.2))
        ax.bar(labels, [v * 100 for v in chrf], color="#C8102E")
        ax.set_ylabel("chrF %")
        ax.set_title("Phrasebook baseline chrF by gold class")
        ax.set_ylim(0, 100)
        fig.tight_layout()
        fig.savefig(VIZ / "phrasebook_chrf.png", dpi=160)
        plt.close(fig)
        print("png:", VIZ / "phrasebook_chrf.png")
    except Exception as e:
        print("matplotlib skip", e)

    try_matplotlib(summary)
    print("html:", html_path)


if __name__ == "__main__":
    main()
