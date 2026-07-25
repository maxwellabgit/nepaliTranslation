#!/usr/bin/env python3
"""
Review student synthetic rows with IndicTrans2 1B (smartest same-family teacher on this GPU).

For each English source the teacher produces its own formal/informal translations.
We store:
  - teacher hypotheses
  - agreement flags vs student (exact / chrF)
  - action: accept_student | prefer_teacher | needs_human

Does not download 1B if --require-local and weights missing — prints download command.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

REPO = Path(__file__).resolve().parents[2]
RAW = REPO / "datasets" / "synthetic" / "student_raw"
OUT_DIR = REPO / "datasets" / "synthetic" / "teacher_reviewed"
TEACHER_DIR = REPO / "training" / "artifacts" / "it2_en_indic_1b"
TEACHER_HF = "ai4bharat/indictrans2-en-indic-1B"


def chr_f(pred: str, ref: str, n: int = 3) -> float:
    def grams(text: str) -> dict[str, int]:
        t = re.sub(r"\s+", "", (text or "").strip().lower())
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


def latest_student_file() -> Path:
    files = sorted(RAW.glob("student_*.jsonl"))
    if not files:
        raise SystemExit(f"No student_raw jsonl in {RAW}")
    return files[-1]


def ensure_teacher(require_local: bool) -> Path:
    if TEACHER_DIR.exists() and any(TEACHER_DIR.iterdir()):
        return TEACHER_DIR
    if require_local:
        raise SystemExit(
            f"Missing teacher at {TEACHER_DIR}\n"
            f"Download with:\n"
            f"  python datasets/scripts/download_teacher_1b.py"
        )
    print("Downloading teacher 1B (large)…", flush=True)
    from datasets.scripts.download_teacher_1b import download  # type: ignore

    download()
    return TEACHER_DIR


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument("--require-local", action="store_true")
    ap.add_argument("--accept-chrf", type=float, default=0.85)
    args = ap.parse_args()

    # Inline download helper to avoid import path issues
    teacher_path = TEACHER_DIR
    if not teacher_path.exists() or not any(teacher_path.iterdir()):
        if args.require_local:
            raise SystemExit(
                f"Missing {TEACHER_DIR}. Run: python datasets/scripts/download_teacher_1b.py"
            )
        print("Teacher missing — run download_teacher_1b.py first for overnight QC.", flush=True)
        raise SystemExit(2)

    import torch
    from IndicTransToolkit import IndicProcessor
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    src_path = args.input or latest_student_file()
    rows = [json.loads(l) for l in src_path.read_text(encoding="utf-8").splitlines() if l.strip()]
    if args.limit is not None:
        rows = rows[: args.limit]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"teacher={teacher_path} device={device} n={len(rows)}", flush=True)
    tok = AutoTokenizer.from_pretrained(str(teacher_path), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(teacher_path),
        trust_remote_code=True,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    ).to(device)
    model.eval()
    ip = IndicProcessor(inference=True)

    def translate_batch(texts: list[str], formality: str) -> list[str]:
        tagged = [f"<{formality}> {t}" for t in texts]
        processed = ip.preprocess_batch(tagged, src_lang="eng_Latn", tgt_lang="npi_Deva")
        enc = tok(
            processed,
            padding=True,
            truncation=True,
            max_length=96,
            return_tensors="pt",
        ).to(device)
        with torch.no_grad():
            out = model.generate(**enc, max_new_tokens=64, num_beams=5)
        decoded = tok.batch_decode(out, skip_special_tokens=True)
        return ip.postprocess_batch(decoded, lang="npi_Deva")

    reviewed: list[dict] = []
    bs = max(1, args.batch_size)
    for i in range(0, len(rows), bs):
        chunk = rows[i : i + bs]
        engs = [r["english"] for r in chunk]
        t_f = translate_batch(engs, "formal")
        t_i = translate_batch(engs, "informal")
        for r, tf, ti in zip(chunk, t_f, t_i):
            sf = (r.get("ne_formal_hyp") or "").strip()
            si = (r.get("ne_informal_hyp") or "").strip()
            tf, ti = tf.strip(), ti.strip()
            cf = chr_f(sf, tf)
            ci = chr_f(si, ti)
            if sf == tf and si == ti:
                action = "accept_student"
            elif cf >= args.accept_chrf and ci >= args.accept_chrf:
                action = "accept_student"
            elif cf < 0.5 or ci < 0.5:
                action = "needs_human"
            else:
                action = "prefer_teacher"
            reviewed.append(
                {
                    **r,
                    "ne_formal_teacher": tf,
                    "ne_informal_teacher": ti,
                    "chrf_formal": round(cf, 4),
                    "chrf_informal": round(ci, 4),
                    "action": action,
                    "teacher_model": TEACHER_HF,
                    "reviewed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    # Canonical promotion fields (teacher preferred when not accept_student)
                    "ne_formal": sf if action == "accept_student" else tf,
                    "ne_informal": si if action == "accept_student" else ti,
                }
            )
        print(f"  {min(i + bs, len(rows))}/{len(rows)}", flush=True)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = OUT_DIR / f"teacher_{run_id}.jsonl"
    out_path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in reviewed) + "\n",
        encoding="utf-8",
    )
    counts: dict[str, int] = {}
    for r in reviewed:
        counts[r["action"]] = counts.get(r["action"], 0) + 1
    meta = {
        "run_id": run_id,
        "n": len(reviewed),
        "actions": counts,
        "student_input": str(src_path.relative_to(REPO)),
        "teacher_model": TEACHER_HF,
        "output": str(out_path.relative_to(REPO)),
    }
    (OUT_DIR / f"teacher_{run_id}.meta.json").write_text(
        json.dumps(meta, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(meta, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
