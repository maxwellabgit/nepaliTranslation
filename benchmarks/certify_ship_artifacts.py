#!/usr/bin/env python3
"""F9 ship certification for exact pinned IT2 ONNX artifacts.

Always validates:
  * gold freeze integrity (delegates to check_gold_integrity checks via freeze file)
  * four-class schema presence
  * IT2 release manifest pins (Node check_model_hash.mjs)

When both ONNX model dirs exist, evaluates frozen gold against
benchmarks/ship_thresholds.json. When weights are missing, prints an explicit
BLOCKER and exits 0 (soft) unless --require-weights.

Never edits benchmarks/gold/. Never invents chrF numbers.

  python benchmarks/certify_ship_artifacts.py
  python benchmarks/certify_ship_artifacts.py --require-weights
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
GOLD = ROOT / "gold"
THRESHOLDS_PATH = ROOT / "ship_thresholds.json"
FREEZE_PATH = ROOT / "results" / "gold_freeze.json"
MANIFEST_CHECK = REPO / "mobile" / "scripts" / "check_model_hash.mjs"
CLASSES = ["en_ne_formal", "en_ne_informal", "ne_en_deva", "ne_en_roman"]

sys.path.insert(0, str(ROOT))
from eval_it2_gold import chr_f, load_jsonl, norm  # noqa: E402

# Spelling equivalence for the formal pronoun. The app treats anusvara तपाईं
# and chandrabindu तपाईँ as the same word (onDeviceTranslate maps both to तिमी).
# The ship rate counts either spelling. The two rates are also reported separately
# so a combined number is not read as evidence of one spelling.
TAPAI_ANUSVARA = re.compile(r"तपाईं")
TAPAI_CHANDRABINDU = re.compile(r"तपाईँ")
TAPAI = re.compile(r"तपाई(?:ं|ँ)")
TIMI = re.compile(r"तिमी")
TAAN = re.compile(r"(?:^|[^\u0900-\u097F])तँ")


def shipped_en_input(cls: str, text: str) -> str:
    """Match mobile/src/mt/onnx/IndicTransOnnx.ts EN→NE formality prefix."""
    raw = text.strip()
    if cls == "en_ne_informal":
        return f"<informal> {raw}"
    if cls == "en_ne_formal":
        return f"<formal> {raw}"
    return text


def fail(msg: str) -> int:
    print(f"certify-ship: FAIL — {msg}", flush=True)
    return 1


def ok(msg: str) -> None:
    print(f"certify-ship: {msg}", flush=True)


def validate_schema_and_freeze(thresholds: dict) -> int:
    if not THRESHOLDS_PATH.exists():
        return fail(f"missing thresholds at {THRESHOLDS_PATH}")
    if not FREEZE_PATH.exists():
        return fail(f"missing freeze at {FREEZE_PATH}")
    freeze = json.loads(FREEZE_PATH.read_text(encoding="utf-8"))
    for cls in CLASSES:
        class_dir = GOLD / cls
        for name in ("sources.jsonl", "references.jsonl", "manifest.json"):
            if not (class_dir / name).exists():
                return fail(f"missing {class_dir / name}")
        if cls not in freeze.get("classes", {}):
            return fail(f"freeze missing class {cls}")
        if cls not in thresholds.get("classes", {}):
            return fail(f"thresholds missing class {cls}")
        n_src = sum(1 for _ in (class_dir / "sources.jsonl").open(encoding="utf-8") if _.strip())
        n_ref = sum(1 for _ in (class_dir / "references.jsonl").open(encoding="utf-8") if _.strip())
        n_freeze = freeze["classes"][cls]["n"]
        if n_src != n_ref or n_src != n_freeze:
            return fail(
                f"{cls}: sources={n_src} refs={n_ref} freeze.n={n_freeze} (must match; never edit gold to force)"
            )
    ok(f"gold schema + freeze counts OK ({sum(freeze['classes'][c]['n'] for c in CLASSES)} rows)")
    return 0


def validate_manifest_pins() -> int:
    if not MANIFEST_CHECK.exists():
        return fail(f"missing {MANIFEST_CHECK}")
    proc = subprocess.run(
        ["node", str(MANIFEST_CHECK)],
        cwd=str(REPO / "mobile"),
        capture_output=True,
        text=True,
    )
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    if proc.returncode != 0:
        return fail("IT2 release manifest pin check failed")
    ok("IT2 release manifest pins OK")
    return 0


def resolve_model_dirs(thresholds: dict) -> dict[str, Path] | None:
    dirs = {}
    for direction, rel in thresholds.get("onnx_model_dirs", {}).items():
        path = REPO / rel
        encoder = path / "encoder_model.onnx"
        if not encoder.exists():
            return None
        dirs[direction] = path
    return dirs if len(dirs) >= 2 else None


def rate(pattern: re.Pattern[str], texts: list[str]) -> float:
    if not texts:
        return 0.0
    return sum(1 for t in texts if pattern.search(t)) / len(texts)


def eval_class(cls: str, gate: dict, model_dirs: dict[str, Path]) -> tuple[bool, dict]:
    from eval_it2_onnx import OnnxIt2, roman_to_deva_batch  # noqa: WPS433

    direction = gate["direction"]
    model_dir = model_dirs[direction]
    engine = OnnxIt2(model_dir)
    if direction == "ne-en":
        src_lang, tgt_lang = "npi_Deva", "eng_Latn"
    else:
        src_lang, tgt_lang = "eng_Latn", "npi_Deva"

    sources = {r["id"]: r for r in load_jsonl(GOLD / cls / "sources.jsonl")}
    refs = {r["id"]: r for r in load_jsonl(GOLD / cls / "references.jsonl")}
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    for i in sorted(sources):
        src, ref = sources[i]["source"], refs[i]["reference"]
        key = f"{norm(src)}|||{norm(ref)}"
        if key in seen:
            continue
        seen.add(key)
        pairs.append((src, ref))

    inputs = [shipped_en_input(cls, s) for s, _ in pairs]
    if cls == "ne_en_roman" and gate.get("requires_romanizer"):
        inputs = roman_to_deva_batch(inputs)

    preds: list[str] = []
    scores: list[float] = []
    for text, (_, ref) in zip(inputs, pairs):
        pred = engine.translate(text, src_lang, tgt_lang)
        preds.append(pred)
        scores.append(chr_f(pred, ref))

    mean = sum(scores) / len(scores) if scores else 0.0
    result = {
        "n": len(scores),
        "chrf_mean": round(mean, 4),
        "min_chrf": gate["min_chrf"],
        "pass_chrf": mean >= float(gate["min_chrf"]),
    }

    failed = not result["pass_chrf"]
    if "min_tapai_rate" in gate:
        anusvara = rate(TAPAI_ANUSVARA, preds)
        chandrabindu = rate(TAPAI_CHANDRABINDU, preds)
        r = rate(TAPAI, preds)
        result["tapai_anusvara_rate"] = round(anusvara, 4)
        result["tapai_chandrabindu_rate"] = round(chandrabindu, 4)
        result["tapai_rate"] = round(r, 4)
        result["pass_tapai"] = r >= float(gate["min_tapai_rate"])
        failed = failed or not result["pass_tapai"]
    if "min_timi_rate" in gate:
        r = rate(TIMI, preds)
        result["timi_rate"] = round(r, 4)
        result["pass_timi"] = r >= float(gate["min_timi_rate"])
        failed = failed or not result["pass_timi"]
    if "max_taan_rate" in gate:
        r = rate(TAAN, preds)
        result["taan_rate"] = round(r, 4)
        result["pass_taan"] = r <= float(gate["max_taan_rate"])
        failed = failed or not result["pass_taan"]

    return (not failed), result


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--require-weights",
        action="store_true",
        help="Exit 1 when ONNX dirs are missing (default: soft BLOCKER + exit 0).",
    )
    ap.add_argument(
        "--skip-eval",
        action="store_true",
        help="Only schema + pins (even if weights exist).",
    )
    args = ap.parse_args()

    thresholds = json.loads(THRESHOLDS_PATH.read_text(encoding="utf-8"))
    rc = validate_schema_and_freeze(thresholds)
    if rc != 0:
        return rc
    rc = validate_manifest_pins()
    if rc != 0:
        return rc

    model_dirs = resolve_model_dirs(thresholds)
    if model_dirs is None:
        msg = (
            "BLOCKER: exact IT2 ONNX weights missing under mobile/assets/models/ "
            "(it2_en_indic + it2_indic_en). Schema/pins validated; four-class gold "
            "ship eval not run. Do not invent chrF. Record in CERTIFICATION / ExecPlan."
        )
        print(f"certify-ship: {msg}", flush=True)
        if args.require_weights:
            return fail("weights required but missing")
        return 0

    if args.skip_eval:
        ok("weights present; eval skipped (--skip-eval)")
        return 0

    ok(f"evaluating pinned ONNX dirs: { {k: str(v) for k, v in model_dirs.items()} }")
    report: dict[str, dict] = {}
    all_pass = True
    for cls in CLASSES:
        passed, detail = eval_class(cls, thresholds["classes"][cls], model_dirs)
        report[cls] = detail
        status = "PASS" if passed else "FAIL"
        print(f"certify-ship: {cls}: {status} {json.dumps(detail)}", flush=True)
        all_pass = all_pass and passed

    out = ROOT / "results" / "ship_cert_last.json"
    out.write_text(
        json.dumps(
            {
                "thresholds": thresholds,
                "classes": report,
                "passed": all_pass,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    ok(f"wrote {out.relative_to(REPO)}")
    if not all_pass:
        return fail("one or more class floors failed — do not ship; do not edit gold")
    ok("all four-class ship floors met")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
