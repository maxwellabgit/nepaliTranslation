#!/usr/bin/env python3
"""Two NE→EN LoRA candidates from the original IndicTrans2 indic-en base.

Candidate A: formal and informal Devanagari, including identical strings.
Roman at test time goes through the phone Roman→Devanagari path.

Candidate B: A's Devanagari plus formal and informal Roman as direct sources.
Roman at test time is fed to the model as Roman.

The 16 meaning ids already held out of train_clean stay held out.
Gold and public-benchmark sheet rows are not trained on.
BF16, rank-16 LoRA, greedy decode, microbatch 4, accumulation 8. Adapters only.

  python training/train_ne_en_ab.py
"""
from __future__ import annotations

import csv
import gc
import json
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "benchmarks"))

from training.prepare_cpu_mix import blocked_text, load_blocklist, norm  # noqa: E402
import eval_it2_gold as gold_eval  # noqa: E402

SHEET = Path(r"C:\Users\maxwe\Downloads\TRAINING - nepali_training_benchmark_review (1).csv")
BASE = REPO / "training" / "artifacts" / "it2_indic_en_merged"
DATA = REPO / "training" / "data" / "ne_en_ab"
LEXICON = REPO / "mobile" / "src" / "mt" / "generated" / "meaningLexicon.json"
BENCHMARKS = {
    "opus100_test",
    "flores_plus_dev",
    "flores101_dev",
    "in22_conv",
    "bpcc_daily",
}
SURFACES = (
    ("devanagari", "deva_formal"),
    ("devanagari_informal", "deva_informal"),
    ("roman", "roman_formal"),
    ("roman_informal", "roman_informal"),
)
DEVA = re.compile(r"[\u0900-\u097F]")
VIRAMA = "्"
CONS_ROMAN = [
    ("chh", "छ"), ("ksh", "क्ष"), ("gy", "ज्ञ"), ("tr", "त्र"),
    ("kh", "ख"), ("gh", "घ"), ("ng", "ङ"), ("ch", "च"), ("jh", "झ"),
    ("th", "थ"), ("dh", "ध"), ("ph", "फ"), ("bh", "भ"), ("sh", "श"),
    ("ny", "ञ"), ("k", "क"), ("g", "ग"), ("j", "ज"), ("t", "त"),
    ("d", "द"), ("n", "न"), ("p", "प"), ("b", "ब"), ("m", "म"),
    ("y", "य"), ("r", "र"), ("l", "ल"), ("w", "व"), ("v", "व"),
    ("s", "स"), ("h", "ह"),
]
VOWEL_ROMAN = ["aa", "ii", "ee", "uu", "oo", "ai", "au", "a", "i", "u", "e", "o"]
INDEP_FROM_ROMAN = {
    "aa": "आ", "ii": "ई", "ee": "ई", "uu": "ऊ", "oo": "ऊ", "ai": "ऐ", "au": "औ",
    "a": "अ", "i": "इ", "u": "उ", "e": "ए", "o": "ओ",
}
MATRA_FROM_ROMAN = {
    "aa": "ा", "ii": "ी", "ee": "ी", "uu": "ू", "oo": "ू", "ai": "ै", "au": "ौ",
    "a": "", "i": "ि", "u": "ु", "e": "े", "o": "ो",
}


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def val_meaning_ids() -> set[str]:
    found = set()
    for name in ("val_clean_en-ne.jsonl", "val_clean_ne-en.jsonl"):
        path = REPO / "training" / "data" / name
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                found.add(json.loads(line)["meaning_id"])
    return found


def syllables_to_deva(raw: str) -> str:
    s = raw.lower()
    i = 0
    out = []
    while i < len(s):
        cons = next((pair for pair in CONS_ROMAN if s.startswith(pair[0], i)), None)
        if cons:
            after = i + len(cons[0])
            vow = next((v for v in VOWEL_ROMAN if s.startswith(v, after)), None)
            if vow:
                out.append(cons[1] + MATRA_FROM_ROMAN[vow])
                i = after + len(vow)
            else:
                more = after < len(s) and s[after].isalpha()
                out.append(cons[1] + (VIRAMA if more else ""))
                i = after
            continue
        vow = next((v for v in VOWEL_ROMAN if s.startswith(v, i)), None)
        if vow:
            out.append(INDEP_FROM_ROMAN[vow])
            i += len(vow)
            continue
        out.append(s[i])
        i += 1
    return "".join(out)


def roman_to_devanagari(text: str, roman_words: dict[str, str]) -> str:
    trimmed = text.strip()
    if not trimmed or DEVA.search(trimmed):
        return trimmed
    parts = re.split(r"(\s+|[?.!,;:।]+)", trimmed)
    out = []
    for tok in parts:
        if not tok:
            continue
        if tok.isspace() or re.fullmatch(r"[?.!,;:।]+", tok):
            out.append("।" if tok in ".!?" else tok)
            continue
        hit = roman_words.get(tok.lower())
        out.append(hit if hit else syllables_to_deva(tok))
    return re.sub(r"\s+", " ", "".join(out)).strip()


def load_roman_words() -> dict[str, str]:
    data = json.loads(LEXICON.read_text(encoding="utf-8"))
    return {str(k).lower(): str(v) for k, v in (data.get("romanWords") or {}).items()}


def fullest(rows: list[dict]) -> dict:
    def score(row: dict) -> int:
        return sum(bool((row.get(name) or "").strip()) for name, _ in SURFACES)

    return max(rows, key=score)


def build_examples() -> dict:
    held = val_meaning_ids()
    blocked = load_blocklist()
    grouped: dict[str, list[dict]] = defaultdict(list)
    dropped_benchmark = 0
    for row in read_csv(SHEET):
        name = (row.get("set_name") or "").strip()
        if name.startswith("gold_") or name in BENCHMARKS:
            dropped_benchmark += 1
            continue
        meaning_id = (row.get("id") or row.get("meaning_id") or "").strip()
        english = (row.get("english") or "").strip()
        if not meaning_id or not english:
            continue
        grouped[meaning_id].append(row)

    train_a, train_b, dev = [], [], []
    dropped_block = 0
    for meaning_id, copies in grouped.items():
        row = fullest(copies)
        english = (row.get("english") or "").strip()
        split = "dev" if meaning_id in held else "train"
        bucket = dev if split == "dev" else None
        for column, kind in SURFACES:
            nepali = (row.get(column) or "").strip()
            if not nepali:
                continue
            example = {
                "src": nepali,
                "tgt": english,
                "meaning_id": meaning_id,
                "kind": kind,
                "split": split,
            }
            if split == "train" and blocked_text(blocked, nepali, english):
                dropped_block += 1
                continue
            if kind.startswith("deva"):
                train_a.append(example) if split == "train" else None
                train_b.append(example) if split == "train" else None
            elif split == "train":
                train_b.append(example)
            if bucket is not None:
                bucket.append(example)

    DATA.mkdir(parents=True, exist_ok=True)

    def dump(path: Path, rows: list[dict]) -> None:
        path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")

    dump(DATA / "train_a.jsonl", train_a)
    dump(DATA / "train_b.jsonl", train_b)
    dump(DATA / "dev.jsonl", dev)
    manifest = {
        "held_out_meanings": sorted(held),
        "dropped_benchmark_rows": dropped_benchmark,
        "dropped_blocklist_train_examples": dropped_block,
        "train_a": len(train_a),
        "train_b": len(train_b),
        "dev": len(dev),
        "dev_by_kind": {
            kind: sum(1 for row in dev if row["kind"] == kind) for _, kind in SURFACES
        },
    }
    (DATA / "prepare_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2), flush=True)
    return manifest


def make_dataset(rows: list[dict], ip, tokenizer, max_length: int = 128):
    from datasets import Dataset

    processed = ip.preprocess_batch([row["src"] for row in rows], src_lang="npi_Deva", tgt_lang="eng_Latn")
    encoded = tokenizer(processed, max_length=max_length, truncation=True, padding=False)
    try:
        labels = tokenizer(text_target=[row["tgt"] for row in rows], max_length=max_length, truncation=True, padding=False)
    except TypeError:
        labels = tokenizer([row["tgt"] for row in rows], max_length=max_length, truncation=True, padding=False)
    capped = sum(1 for ids in labels["input_ids"] if len(ids) >= max_length)
    print(f"[ab] label_rows_at_cap={capped}/{len(rows)}", flush=True)
    return Dataset.from_dict(
        {
            "input_ids": encoded["input_ids"],
            "attention_mask": encoded["attention_mask"],
            "labels": labels["input_ids"],
        }
    )


def train_one(name: str, rows: list[dict], out_dir: Path) -> None:
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

    if not torch.cuda.is_available():
        raise SystemExit("CUDA is required.")
    if out_dir.exists():
        raise SystemExit(f"Refusing to overwrite {out_dir}")
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    print(f"[ab] train {name} rows={len(rows)} dtype={dtype}", flush=True)
    processor = IndicProcessor(inference=False)
    tokenizer = AutoTokenizer.from_pretrained(str(BASE), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(BASE), trust_remote_code=True, torch_dtype=dtype
    ).to("cuda")
    names = {module.split(".")[-1] for module, _ in model.named_modules()}
    targets = [item for item in ("q_proj", "v_proj") if item in names]
    if targets != ["q_proj", "v_proj"]:
        raise SystemExit(f"missing LoRA targets: {sorted(names)}")
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    model = get_peft_model(
        model,
        LoraConfig(
            task_type=TaskType.SEQ_2_SEQ_LM,
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            target_modules=targets,
            bias="none",
        ),
    )
    dataset = make_dataset(rows, processor, tokenizer)
    collator = DataCollatorForSeq2Seq(tokenizer, model=model, padding=True)
    out_dir.mkdir(parents=True)
    args = Seq2SeqTrainingArguments(
        output_dir=str(out_dir / "runs"),
        per_device_train_batch_size=4,
        gradient_accumulation_steps=8,
        learning_rate=1e-4,
        weight_decay=0.01,
        num_train_epochs=2,
        warmup_ratio=0.05,
        logging_steps=10,
        save_strategy="no",
        bf16=dtype == torch.bfloat16,
        fp16=dtype == torch.float16,
        use_cpu=False,
        dataloader_pin_memory=True,
        dataloader_num_workers=0,
        report_to=[],
        remove_unused_columns=False,
        predict_with_generate=False,
        seed=42,
    )
    kwargs = dict(model=model, args=args, train_dataset=dataset, data_collator=collator)
    try:
        trainer = Seq2SeqTrainer(**kwargs, processing_class=tokenizer)
    except TypeError:
        trainer = Seq2SeqTrainer(**kwargs, tokenizer=tokenizer)
    trainer.train()
    adapter = out_dir / "adapter"
    model.save_pretrained(str(adapter))
    tokenizer.save_pretrained(str(adapter))
    del trainer, model, tokenizer
    gc.collect()
    torch.cuda.empty_cache()
    print(f"[ab] saved {adapter}", flush=True)


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def load_translator(adapter: Path | None):
    import torch
    from IndicTransToolkit import IndicProcessor
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    ip = IndicProcessor(inference=True)
    tok = AutoTokenizer.from_pretrained(str(BASE), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(str(BASE), trust_remote_code=True, torch_dtype=dtype)
    if adapter is not None:
        from peft import PeftModel

        model = PeftModel.from_pretrained(model, str(adapter))
    model = model.to(device).eval()

    def translate(text: str) -> tuple[str, float]:
        started = time.perf_counter()
        processed = ip.preprocess_batch([text], src_lang="npi_Deva", tgt_lang="eng_Latn")
        inputs = tok(processed, return_tensors="pt", truncation=True, max_length=128).to(device)
        with torch.no_grad():
            out = model.generate(**inputs, max_new_tokens=96, num_beams=1, do_sample=False)
        dec = tok.batch_decode(out, skip_special_tokens=True, clean_up_tokenization_spaces=True)
        try:
            text_out = ip.postprocess_batch(dec, lang="eng_Latn")[0]
        except Exception:
            text_out = dec[0] if dec else ""
        return text_out, (time.perf_counter() - started) * 1000

    return translate, model


def score_rows(rows: list[dict], translate, prepare) -> dict:
    scores = []
    millis = []
    for row in rows:
        pred, ms = translate(prepare(row["src"]))
        scores.append(gold_eval.chr_f(pred, row["tgt"]))
        millis.append(ms)
    return {
        "n": len(rows),
        "chrf": round(sum(scores) / len(scores), 4) if scores else 0.0,
        "latency_ms_mean": round(sum(millis) / len(millis), 1) if millis else 0.0,
    }


def gold_rows(cls: str) -> list[dict]:
    sources = gold_eval.load_jsonl(gold_eval.GOLD / cls / "sources.jsonl")
    refs = gold_eval.load_jsonl(gold_eval.GOLD / cls / "references.jsonl")
    by_id = {row.get("id", i): row for i, row in enumerate(refs)}
    out = []
    seen = set()
    for i, src in enumerate(sources):
        ref = by_id.get(src.get("id", i), refs[i] if i < len(refs) else {})
        source = src.get("source") or ""
        reference = ref.get("reference") or ""
        key = f"{norm(source)}|||{norm(reference)}"
        if not source or not reference or key in seen:
            continue
        seen.add(key)
        out.append({"src": source, "tgt": reference})
    return out


def release(model) -> None:
    import torch

    del model
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def evaluate(run: Path) -> dict:
    roman_words = load_roman_words()
    dev = load_jsonl(DATA / "dev.jsonl")
    deva = [row for row in dev if row["kind"].startswith("deva")]
    roman = [row for row in dev if row["kind"].startswith("roman")]
    systems = {
        "base": None,
        "A": run / "A" / "adapter",
        "B": run / "B" / "adapter",
    }
    report = {"blind": {}, "gold": {}}
    for name, adapter in systems.items():
        translate, model = load_translator(adapter)
        report["blind"][name] = {
            "deva": score_rows(deva, translate, lambda text: text),
            "roman_phone_path": score_rows(
                roman, translate, lambda text: roman_to_devanagari(text, roman_words)
            ),
            "roman_direct": score_rows(roman, translate, lambda text: text),
        }
        report["gold"][name] = {
            "ne_en_deva": score_rows(gold_rows("ne_en_deva"), translate, lambda text: text),
            "ne_en_roman_phone_path": score_rows(
                gold_rows("ne_en_roman"),
                translate,
                lambda text: roman_to_devanagari(text, roman_words),
            ),
            "ne_en_roman_direct": score_rows(gold_rows("ne_en_roman"), translate, lambda text: text),
        }
        release(model)
        print(f"[ab] scored {name}", flush=True)

    blind = report["blind"]
    b_roman = blind["B"]["roman_direct"]["chrf"]
    a_roman = blind["A"]["roman_phone_path"]["chrf"]
    b_deva = blind["B"]["deva"]["chrf"]
    base_deva = blind["base"]["deva"]["chrf"]
    a_deva = blind["A"]["deva"]["chrf"]
    direct_roman = b_roman > a_roman and b_deva >= base_deva and b_deva >= a_deva
    report["decision"] = {
        "direct_roman": direct_roman,
        "chosen": "B" if direct_roman else "A",
        "reason": (
            "B is higher on unseen Roman and not worse on Devanagari."
            if direct_roman
            else "Keep the phone Roman→Devanagari path. B did not win Roman without a Devanagari drop."
        ),
    }
    return report


def main() -> int:
    build_examples()
    train_a = load_jsonl(DATA / "train_a.jsonl")
    train_b = load_jsonl(DATA / "train_b.jsonl")
    if not train_a or not train_b:
        raise SystemExit("training sets are empty")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run = REPO / "training" / "artifacts" / f"ne_en_ab_{stamp}"
    train_one("A", train_a, run / "A")
    train_one("B", train_b, run / "B")
    report = evaluate(run)
    report["run"] = str(run)
    report["generated_at"] = datetime.now(timezone.utc).isoformat()
    out = DATA / f"report_{stamp}.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    chosen = run / report["decision"]["chosen"] / "adapter"
    ready = {
        "direction": "ne-en",
        "en_ne": "production base, unchanged",
        "chosen": report["decision"]["chosen"],
        "adapter": str(chosen),
        "direct_roman": report["decision"]["direct_roman"],
        "reason": report["decision"]["reason"],
    }
    (DATA / "testflight_ready.json").write_text(json.dumps(ready, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["decision"], indent=2), flush=True)
    print(f"[ab] wrote {out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
