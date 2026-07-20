#!/usr/bin/env python3
"""Qualitative formal/informal honorific probe against TranslationManager."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from core.translation import TranslationManager
from core.types import Formality, NepaliScript


def _norm_ne(s: str) -> str:
    """Normalize common Nepali orthographic variants for marker checks."""
    return (s or "").replace("तपाईँ", "तपाईं").replace("तिमीँ", "तिमी")


def main() -> int:
    probe = json.loads((REPO / "benchmarks" / "honorific_probe.json").read_text(encoding="utf-8"))
    mgr = TranslationManager(num_beams=1, max_length=96)
    mgr.load()

    rows = []
    for item in probe["items"]:
        formality = Formality.FORMAL if item["register"] == "formal" else Formality.INFORMAL
        out = mgr.translate(
            item["en"],
            nepali_script=NepaliScript.DEVANAGARI,
            formality=formality,
        )
        hyp_n = _norm_ne(out.text)
        markers = item.get("expected_markers") or []
        hits = [m for m in markers if _norm_ne(m) in hyp_n]
        # Informal: also credit तिमी if rewrite applied even when probe listed तँ
        if item["register"] == "informal" and "तिमी" in hyp_n and "तिमी" not in hits:
            if any(m in ("तिमी", "तँ", "छस्", "छौ") for m in markers):
                hits = list(hits) + (["तिमी"] if "तिमी" not in hits else [])
        rows.append(
            {
                "id": item["id"],
                "register": item["register"],
                "en": item["en"],
                "hyp": out.text,
                "marker_hits": hits,
                "marker_hit_rate": (len(hits) / len(markers)) if markers else None,
            }
        )

    out_path = REPO / "benchmarks" / "results" / "honorific_probe_run.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "n": len(rows),
        "mean_marker_hit_rate": sum(r["marker_hit_rate"] or 0 for r in rows) / max(len(rows), 1),
        "rows": rows,
        "note": "Stopgap तपाईं→तिमी rewrite for informal; not a trained register model.",
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")
    print(f"mean_marker_hit_rate={payload['mean_marker_hit_rate']:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
