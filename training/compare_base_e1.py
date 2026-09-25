#!/usr/bin/env python3
"""Base vs E1 on the existing held-out mix, then two-model proposals for new prompts.

Decode matches for both systems: greedy search, 96 new tokens, no sampling.
EN→NE rows already include the shipped <formal> or <informal> prefix.
Does not read benchmarks/gold/ and does not write approved training rows.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

DATA = REPO / "training" / "data"
ART = REPO / "training" / "artifacts"
OUT = REPO / "balance_data"
E1 = ART / "e1_gpu_baseline_20260925T140015Z"
BASE = {"en-ne": ART / "it2_en_indic_merged", "ne-en": ART / "it2_indic_en_merged"}
ONE_B = ART / "it2_en_indic_1b"
DECODE = dict(max_new_tokens=96, num_beams=1, do_sample=False)


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )


def make_translate(model_dir: Path, adapter: Path | None, direction: str):
    import torch
    from IndicTransToolkit import IndicProcessor
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    assert torch.cuda.is_available()
    src_lang, tgt_lang = ("eng_Latn", "npi_Deva") if direction == "en-ne" else ("npi_Deva", "eng_Latn")
    ip = IndicProcessor(inference=True)
    tok = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(model_dir), trust_remote_code=True, torch_dtype=torch.bfloat16
    )
    if adapter is not None:
        from peft import PeftModel

        model = PeftModel.from_pretrained(model, str(adapter))
    model = model.to("cuda").eval()

    def translate(text: str) -> str:
        processed = ip.preprocess_batch([text], src_lang=src_lang, tgt_lang=tgt_lang)
        inputs = tok(processed, return_tensors="pt", truncation=True, max_length=128).to("cuda")
        with torch.no_grad():
            out = model.generate(**inputs, **DECODE)
        dec = tok.batch_decode(out, skip_special_tokens=True, clean_up_tokenization_spaces=True)
        try:
            return ip.postprocess_batch(dec, lang=tgt_lang)[0]
        except Exception:
            return dec[0] if dec else ""

    return translate, model


def compare_heldout() -> None:
    rows_out = []
    for direction in ("en-ne", "ne-en"):
        rows = load_jsonl(DATA / f"val_clean_{direction}.jsonl")
        base_fn, base_model = make_translate(BASE[direction], None, direction)
        e1_fn, e1_model = make_translate(BASE[direction], E1 / direction / "adapter", direction)
        for row in rows:
            rows_out.append(
                {
                    "meaning_id": row["meaning_id"],
                    "direction": direction,
                    "register": row.get("register"),
                    "surface": row.get("surface"),
                    "src": row["src"],
                    "mix_reference": row["tgt"],
                    "base": base_fn(row["src"]),
                    "e1": e1_fn(row["src"]),
                    "decode": DECODE,
                    "review_status": "unapproved",
                }
            )
        del e1_fn, base_fn, e1_model, base_model
        import torch
        torch.cuda.empty_cache()
        print(f"[compare] {direction} {len(rows)}", flush=True)
    write_jsonl(OUT / "base_vs_e1_val.jsonl", rows_out)


def propose(prompts: list[dict]) -> None:
    import torch

    en_prompts = [p for p in prompts if p["direction"] == "en-ne"]
    ne_prompts = [p for p in prompts if p["direction"] == "ne-en"]
    collected: list[dict] = []

    def run(model_dir: Path, adapter: Path | None, direction: str, name: str, batch: list[dict]) -> None:
        if not model_dir.exists():
            for prompt in batch:
                collected.append({**prompt, "model": name, "candidate": None, "error": "model_missing"})
            return
        fn, model = make_translate(model_dir, adapter, direction)
        for prompt in batch:
            text = prompt["source_text"]
            if direction == "en-ne":
                tag = "<informal>" if prompt["register"] == "informal" else "<formal>"
                text = f"{tag} {text}"
            collected.append(
                {
                    **prompt,
                    "model_input": text,
                    "model": name,
                    "candidate": fn(text),
                    "review_status": "unapproved",
                }
            )
        del fn, model
        torch.cuda.empty_cache()
        print(f"[propose] {name} {len(batch)}", flush=True)

    run(BASE["en-ne"], None, "en-ne", "indictrans2-dist-200M", en_prompts)
    run(ONE_B, None, "en-ne", "indictrans2-1b", en_prompts)
    run(BASE["ne-en"], None, "ne-en", "indictrans2-dist-200M", ne_prompts)
    write_jsonl(OUT / "candidates.jsonl", collected)


def main() -> int:
    from training.balance_prompts import PROMPTS
    import training.prepare_cpu_mix as mix

    blocked = mix.load_blocklist()
    for prompt in PROMPTS:
        if mix.blocked_text(blocked, prompt["source_text"]):
            raise SystemExit(f"prompt overlaps blocked text: {prompt['id']}")
    compare_heldout()
    write_jsonl(OUT / "prompts.jsonl", PROMPTS)
    propose(PROMPTS)
    print(f"[balance] prompts={len(PROMPTS)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
