#!/usr/bin/env python3
"""Check whether folding LoRA into base weights matches the attached adapter."""
from __future__ import annotations

import copy
import sys
from pathlib import Path

import torch
from IndicTransToolkit import IndicProcessor
from peft import PeftModel
from peft.tuners.lora import Linear as LoraLinear
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

REPO = Path(__file__).resolve().parents[1]
BASE = REPO / "training" / "artifacts" / "it2_en_indic_merged"
ADAPTER = REPO / "training" / "artifacts" / "it2_generated_en_ne_lora"


def translate(model, tok, ip, text: str) -> str:
    processed = ip.preprocess_batch([f"<formal> {text}"], src_lang="eng_Latn", tgt_lang="npi_Deva")
    inputs = tok(processed, return_tensors="pt", truncation=True, max_length=128).to("cuda")
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=32, num_beams=1, do_sample=False)
    decoded = tok.batch_decode(out, skip_special_tokens=True, clean_up_tokenization_spaces=True)
    try:
        return ip.postprocess_batch(decoded, lang="npi_Deva")[0]
    except Exception:
        return decoded[0]


def main() -> int:
    ip = IndicProcessor(inference=True)
    tok = AutoTokenizer.from_pretrained(str(BASE), trust_remote_code=True)
    base = AutoModelForSeq2SeqLM.from_pretrained(
        str(BASE), trust_remote_code=True, torch_dtype=torch.bfloat16
    )
    peft = PeftModel.from_pretrained(base, str(ADAPTER)).to("cuda").eval()
    sample = "Where is the hospital?"
    attached = translate(peft, tok, ip, sample)
    print("attached", attached, flush=True)

    seen = {}
    for name, module in peft.named_modules():
        if isinstance(module, LoraLinear):
            seen.setdefault(id(module), name)
    print("lora_modules", len(seen), flush=True)

    with torch.no_grad():
        for module in {id(m): m for _, m in peft.named_modules() if isinstance(m, LoraLinear)}.values():
            delta = module.get_delta_weight("default").to(module.get_base_layer().weight.dtype)
            module.get_base_layer().weight.data.add_(delta)

    with peft.disable_adapter():
        folded = translate(peft, tok, ip, sample)
    print("folded", folded, flush=True)
    print("match", attached == folded, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
