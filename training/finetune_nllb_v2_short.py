#!/usr/bin/env python3
"""
Corrective LoRA: short conversational pairs only, no formality tags, low LR.
Continues from existing adapter if present, else from base.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

REPO = Path(__file__).resolve().parents[1]
TRAIN = Path(__file__).resolve().parent / "data" / "train_en_ne.jsonl"
OUT = REPO / "training" / "artifacts" / "nllb600m_en_ne_lora_v2"
PREV = REPO / "training" / "artifacts" / "nllb600m_en_ne_lora" / "adapter"
BASE = "facebook/nllb-200-distilled-600M"


def main() -> int:
    from benchmarks.hf_login import load_hf_token
    from huggingface_hub import login

    login(token=load_hf_token(), add_to_git_credential=False)

    import torch
    from datasets import Dataset
    from peft import LoraConfig, PeftModel, TaskType, get_peft_model
    from transformers import (
        AutoModelForSeq2SeqLM,
        AutoTokenizer,
        DataCollatorForSeq2Seq,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
    )

    # Prefer short, conversational-like pairs
    rows = []
    with TRAIN.open(encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            en, ne = r["eng_Latn"].strip(), r["npi_Deva"].strip()
            if 8 <= len(en) <= 90 and 8 <= len(ne) <= 100:
                rows.append(r)
            if len(rows) >= 6000:
                break
    print(f"short rows={len(rows)}", flush=True)

    examples = []
    for r in rows:
        examples.append({"src": r["eng_Latn"], "tgt": r["npi_Deva"], "direction": "en-ne"})
        examples.append({"src": r["npi_Deva"], "tgt": r["eng_Latn"], "direction": "ne-en"})

    tok = AutoTokenizer.from_pretrained(BASE)
    tok.src_lang = "eng_Latn"
    tok.tgt_lang = "npi_Deva"
    model = AutoModelForSeq2SeqLM.from_pretrained(
        BASE, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
    )
    if PREV.exists():
        # Fresh LoRA on base is safer than stacking damaged adapter
        pass
    lora = LoraConfig(
        task_type=TaskType.SEQ_2_SEQ_LM,
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        target_modules=["q_proj", "v_proj"],
        bias="none",
    )
    model = get_peft_model(model, lora)

    def tokenize_examples(batch):
        input_ids, attention_mask, labels = [], [], []
        for src, tgt, direction in zip(batch["src"], batch["tgt"], batch["direction"]):
            if direction == "en-ne":
                tok.src_lang, tok.tgt_lang = "eng_Latn", "npi_Deva"
            else:
                tok.src_lang, tok.tgt_lang = "npi_Deva", "eng_Latn"
            enc = tok(src, max_length=96, truncation=True)
            with tok.as_target_tokenizer():
                lab = tok(tgt, max_length=96, truncation=True)
            input_ids.append(enc["input_ids"])
            attention_mask.append(enc["attention_mask"])
            labels.append(lab["input_ids"])
        return {"input_ids": input_ids, "attention_mask": attention_mask, "labels": labels}

    ds = Dataset.from_list(examples).map(
        tokenize_examples, batched=True, batch_size=64, remove_columns=["src", "tgt", "direction"]
    )
    # small val split
    split = ds.train_test_split(test_size=0.05, seed=42)
    collator = DataCollatorForSeq2Seq(tok, model=model, padding=True)
    OUT.mkdir(parents=True, exist_ok=True)
    args = Seq2SeqTrainingArguments(
        output_dir=str(OUT / "runs"),
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        gradient_accumulation_steps=2,
        learning_rate=5e-5,
        num_train_epochs=1,
        warmup_ratio=0.05,
        logging_steps=40,
        eval_strategy="steps",
        eval_steps=300,
        save_steps=300,
        save_total_limit=1,
        fp16=torch.cuda.is_available(),
        report_to=[],
        remove_unused_columns=False,
        dataloader_num_workers=0,
    )
    kw = dict(
        model=model,
        args=args,
        train_dataset=split["train"],
        eval_dataset=split["test"],
        data_collator=collator,
    )
    try:
        trainer = Seq2SeqTrainer(**kw, processing_class=tok)
    except TypeError:
        trainer = Seq2SeqTrainer(**kw, tokenizer=tok)
    trainer.train()
    model.save_pretrained(str(OUT / "adapter"))
    tok.save_pretrained(str(OUT / "adapter"))
    (OUT / "ft_meta.json").write_text(
        json.dumps({"base": BASE, "variant": "v2_short_conv", "n": len(examples)}, indent=2),
        encoding="utf-8",
    )
    print("saved", OUT / "adapter", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
