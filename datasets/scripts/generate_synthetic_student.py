#!/usr/bin/env python3
"""
Translate English pool with the on-device student (IndicTrans2 dist-200M).

Writes datasets/synthetic/student_raw/<run_id>.jsonl
Each row: english, domain, ne_formal_hyp, ne_informal_hyp, model_id.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))

POOL = REPO / "datasets" / "synthetic" / "english_pool" / "en_pool_v1.jsonl"
OUT_DIR = REPO / "datasets" / "synthetic" / "student_raw"
MODEL_DIR = REPO / "training" / "artifacts" / "it2_en_indic_merged"
MODEL_ID = "ai4bharat/indictrans2-en-indic-dist-200M"


def load_pool(limit: int | None) -> list[dict]:
    rows = [json.loads(l) for l in POOL.read_text(encoding="utf-8").splitlines() if l.strip()]
    if limit is not None:
        rows = rows[:limit]
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--batch-size", type=int, default=8)
    args = ap.parse_args()

    if not POOL.exists():
        raise SystemExit(f"Missing {POOL} — run seed_english_domains.py first")
    if not MODEL_DIR.exists():
        raise SystemExit(f"Missing student weights at {MODEL_DIR}")

    import torch
    from IndicTransToolkit import IndicProcessor
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device={device} model={MODEL_DIR}", flush=True)
    tok = AutoTokenizer.from_pretrained(str(MODEL_DIR), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(MODEL_DIR),
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
            out = model.generate(
                **enc,
                max_new_tokens=64,
                num_beams=5,
                num_return_sequences=1,
            )
        decoded = tok.batch_decode(out, skip_special_tokens=True)
        return ip.postprocess_batch(decoded, lang="npi_Deva")

    rows = load_pool(args.limit)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"student_{run_id}.jsonl"

    results: list[dict] = []
    bs = max(1, args.batch_size)
    for i in range(0, len(rows), bs):
        chunk = rows[i : i + bs]
        engs = [r["english"] for r in chunk]
        formal = translate_batch(engs, "formal")
        informal = translate_batch(engs, "informal")
        for r, f, inf in zip(chunk, formal, informal):
            results.append(
                {
                    "id": r["id"],
                    "domain": r.get("domain"),
                    "english": r["english"],
                    "ne_formal_hyp": f.strip(),
                    "ne_informal_hyp": inf.strip(),
                    "student_model": MODEL_ID,
                    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                }
            )
        print(f"  {min(i + bs, len(rows))}/{len(rows)}", flush=True)

    out_path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in results) + "\n",
        encoding="utf-8",
    )
    manifest = OUT_DIR / f"student_{run_id}.meta.json"
    manifest.write_text(
        json.dumps(
            {
                "run_id": run_id,
                "n": len(results),
                "student_model": MODEL_ID,
                "device": device,
                "output": str(out_path.relative_to(REPO)),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(results)} -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
