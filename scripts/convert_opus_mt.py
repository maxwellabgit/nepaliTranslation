#!/usr/bin/env python3
"""
Convert Helsinki-NLP OPUS-MT (MarianMT) models to CoreML format.

Usage (run on macOS with Python 3.10+):
    pip install transformers coremltools torch sentencepiece
    python scripts/convert_opus_mt.py --model Helsinki-NLP/opus-mt-ne-en --output models/opus_mt_ne_en.mlpackage
    python scripts/convert_opus_mt.py --model Helsinki-NLP/opus-mt-en-ne --output models/opus_mt_en_ne.mlpackage

Models needed for NepTranslate:
    1. Helsinki-NLP/opus-mt-ne-en  (Nepali → English)
    2. Helsinki-NLP/opus-mt-en-ne  (English → Nepali, used for both formal and informal in MVP)

After conversion, copy the .mlpackage files into:
    NepTranslate/NepTranslate/Resources/Models/

Then add them to the Xcode project target so they're bundled with the app.
"""

import argparse
from pathlib import Path


def convert(model_name: str, output_path: str):
    # Imports here so the script shows usage help without requiring deps
    import torch
    from transformers import MarianMTModel, MarianTokenizer
    import coremltools as ct

    print(f"Loading {model_name} ...")
    tokenizer = MarianTokenizer.from_pretrained(model_name)
    model = MarianMTModel.from_pretrained(model_name)
    model.eval()

    # --- Encoder ---
    print("Tracing encoder ...")
    dummy_input_ids = torch.randint(0, tokenizer.vocab_size, (1, 64))
    dummy_attention_mask = torch.ones(1, 64, dtype=torch.long)

    encoder = model.get_encoder()
    traced_encoder = torch.jit.trace(encoder, (dummy_input_ids, dummy_attention_mask))

    print("Converting encoder to CoreML ...")
    encoder_mlmodel = ct.convert(
        traced_encoder,
        inputs=[
            ct.TensorType(name="input_ids", shape=(1, ct.RangeDim(1, 128)), dtype=int),
            ct.TensorType(name="attention_mask", shape=(1, ct.RangeDim(1, 128)), dtype=int),
        ],
        compute_units=ct.ComputeUnit.CPU_AND_NE,
    )

    encoder_path = output_path.replace(".mlpackage", "_encoder.mlpackage")
    encoder_mlmodel.save(encoder_path)
    print(f"  Saved encoder → {encoder_path}")

    # --- Decoder ---
    # MarianMT decoder conversion is more complex (autoregressive with KV cache).
    # For a full production conversion, export decoder with past_key_values.
    # This is a starting point — refine based on actual inference needs.
    print("NOTE: Full decoder conversion with KV cache is model-specific.")
    print("      For MVP, consider using an ONNX intermediate step or")
    print("      the encoder-only CoreML model with a custom decoder loop.")

    # Save tokenizer vocab alongside model for on-device tokenization
    vocab_path = Path(output_path).parent / f"{Path(output_path).stem}_vocab"
    tokenizer.save_pretrained(str(vocab_path))
    print(f"  Saved tokenizer → {vocab_path}")

    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert OPUS-MT (MarianMT) to CoreML")
    parser.add_argument("--model", default="Helsinki-NLP/opus-mt-ne-en",
                        help="HuggingFace model name (default: Helsinki-NLP/opus-mt-ne-en)")
    parser.add_argument("--output", default="opus_mt_ne_en.mlpackage",
                        help="Output .mlpackage path")
    args = parser.parse_args()
    convert(args.model, args.output)
