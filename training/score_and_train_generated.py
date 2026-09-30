#!/usr/bin/env python3
"""After synthesize_direction_sets.py finishes, score the INT8 phone models
and train one dist-200M LoRA per direction on the new sets.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "benchmarks"))

OUT = REPO / "training" / "data" / "generated_bf16"
ONNX_EN = REPO / "mobile" / "assets" / "models" / "it2_en_indic"
ONNX_NE = REPO / "mobile" / "assets" / "models" / "it2_indic_en"
BASE_EN = REPO / "training" / "artifacts" / "it2_en_indic_merged"
BASE_NE = REPO / "training" / "artifacts" / "it2_indic_en_merged"
ADAPT_EN = REPO / "training" / "artifacts" / "it2_generated_en_ne_lora"
ADAPT_NE = REPO / "training" / "artifacts" / "it2_generated_ne_en_lora"


def wait_for_rows() -> None:
    needed = [
        OUT / "benchmark_en_ne.jsonl",
        OUT / "benchmark_ne_en.jsonl",
        OUT / "train_en_ne.jsonl",
        OUT / "train_ne_en.jsonl",
    ]
    while True:
        if all(path.exists() and path.stat().st_size > 0 for path in needed):
            return
        print("[score] waiting for generated sets", flush=True)
        time.sleep(30)


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def mean_chrf(pairs: list[tuple[str, str]]) -> float:
    from eval_it2_gold import chr_f

    if not pairs:
        return 0.0
    return sum(chr_f(pred, ref) for pred, ref in pairs) / len(pairs)


def score_int8() -> dict:
    from eval_it2_onnx import OnnxIt2

    bench_en = load_jsonl(OUT / "benchmark_en_ne.jsonl")
    bench_ne = load_jsonl(OUT / "benchmark_ne_en.jsonl")
    train_en = load_jsonl(OUT / "train_en_ne.jsonl")[:100]
    train_ne = load_jsonl(OUT / "train_ne_en.jsonl")[:100]
    print(f"[score] INT8 benchmark en-ne={len(bench_en)} ne-en={len(bench_ne)}", flush=True)
    en_model = OnnxIt2(ONNX_EN)
    ne_model = OnnxIt2(ONNX_NE)

    def run(model: OnnxIt2, rows: list[dict], src_lang: str, tgt_lang: str) -> float:
        pairs = []
        for index, row in enumerate(rows, start=1):
            pred = model.translate(row["src"], src_lang, tgt_lang)
            pairs.append((pred, row["tgt"]))
            if index % 100 == 0 or index == len(rows):
                print(f"[score] {src_lang}->{tgt_lang} {index}/{len(rows)}", flush=True)
        return mean_chrf(pairs)

    report = {
        "benchmark_en_ne": run(en_model, bench_en, "eng_Latn", "npi_Deva"),
        "benchmark_ne_en": run(ne_model, bench_ne, "npi_Deva", "eng_Latn"),
        "train_sample_en_ne": run(en_model, train_en, "eng_Latn", "npi_Deva"),
        "train_sample_ne_en": run(ne_model, train_ne, "npi_Deva", "eng_Latn"),
    }
    (OUT / "int8_baseline.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"[score] INT8 {report}", flush=True)
    return report


def train_one(direction: str, model_dir: Path, out_dir: Path, rows: list[dict]) -> None:
    import torch
    from IndicTransToolkit import IndicProcessor
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import (
        AutoModelForSeq2SeqLM,
        AutoTokenizer,
        DataCollatorForSeq2Seq,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
    )
    from training.finetune_it2_cpu import make_dataset

    assert torch.cuda.is_available()
    holdout = max(1, len(rows) // 20)
    train_rows, val_rows = rows[holdout:], rows[:holdout]
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    print(f"[train] {direction} n={len(train_rows)} dtype={dtype}", flush=True)
    ip = IndicProcessor(inference=False)
    tok = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(model_dir), trust_remote_code=True, torch_dtype=dtype
    ).to("cuda")
    model = get_peft_model(
        model,
        LoraConfig(
            task_type=TaskType.SEQ_2_SEQ_LM,
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            target_modules=["q_proj", "v_proj"],
            bias="none",
        ),
    )
    train_ds = make_dataset(train_rows, direction, ip, tok, 96)
    val_ds = make_dataset(val_rows, direction, ip, tok, 96)
    out_dir.mkdir(parents=True, exist_ok=True)
    args = Seq2SeqTrainingArguments(
        output_dir=str(out_dir),
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=1e-4,
        num_train_epochs=2,
        bf16=dtype == torch.bfloat16,
        fp16=dtype == torch.float16,
        logging_steps=20,
        save_strategy="no",
        report_to=[],
        use_cpu=False,
        remove_unused_columns=False,
    )
    trainer = Seq2SeqTrainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        data_collator=DataCollatorForSeq2Seq(tok, model=model, padding=True),
    )
    trainer.train()
    model.save_pretrained(out_dir)
    tok.save_pretrained(out_dir)
    del model
    torch.cuda.empty_cache()


def score_adapted() -> dict:
    import torch
    from IndicTransToolkit import IndicProcessor
    from peft import PeftModel
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    def run(base: Path, adapter: Path, rows: list[dict], src_lang: str, tgt_lang: str) -> float:
        ip = IndicProcessor(inference=True)
        tok = AutoTokenizer.from_pretrained(str(base), trust_remote_code=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(
            str(base), trust_remote_code=True, torch_dtype=torch.bfloat16
        )
        model = PeftModel.from_pretrained(model, str(adapter)).to("cuda").eval()
        pairs = []
        for start in range(0, len(rows), 8):
            chunk = rows[start : start + 8]
            processed = ip.preprocess_batch([row["src"] for row in chunk], src_lang=src_lang, tgt_lang=tgt_lang)
            inputs = tok(processed, return_tensors="pt", padding=True, truncation=True, max_length=160).to("cuda")
            with torch.no_grad():
                generated = model.generate(**inputs, max_new_tokens=128, num_beams=1, do_sample=False)
            decoded = tok.batch_decode(generated, skip_special_tokens=True, clean_up_tokenization_spaces=True)
            try:
                decoded = ip.postprocess_batch(decoded, lang=tgt_lang)
            except Exception:
                pass
            pairs.extend((pred, row["tgt"]) for pred, row in zip(decoded, chunk))
            print(f"[score] adapted {src_lang}->{tgt_lang} {min(start+8, len(rows))}/{len(rows)}", flush=True)
        del model
        torch.cuda.empty_cache()
        return mean_chrf(pairs)

    bench_en = load_jsonl(OUT / "benchmark_en_ne.jsonl")
    bench_ne = load_jsonl(OUT / "benchmark_ne_en.jsonl")
    report = {
        "benchmark_en_ne": run(BASE_EN, ADAPT_EN, bench_en, "eng_Latn", "npi_Deva"),
        "benchmark_ne_en": run(BASE_NE, ADAPT_NE, bench_ne, "npi_Deva", "eng_Latn"),
    }
    (OUT / "adapted_benchmark.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"[score] ADAPTED {report}", flush=True)
    return report


def main() -> int:
    wait_for_rows()
    baseline = score_int8()
    train_one("en-ne", BASE_EN, ADAPT_EN, load_jsonl(OUT / "train_en_ne.jsonl"))
    train_one("ne-en", BASE_NE, ADAPT_NE, load_jsonl(OUT / "train_ne_en.jsonl"))
    adapted = score_adapted()
    summary = {"int8": baseline, "adapted": adapted}
    (OUT / "comparison.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"[score] COMPARISON {summary}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
