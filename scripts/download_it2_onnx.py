#!/usr/bin/env python3
"""Download IndicTrans2 dist-200M INT8 ONNX bundles for the mobile app.

Outputs:
  mobile/assets/models/it2_en_indic/
  mobile/assets/models/it2_indic_en/

These paths are gitignored. Run before EAS builds that bundle models, or let
the app download on first warmUp into the device document directory.
"""

from __future__ import annotations

import os
from pathlib import Path

from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "mobile" / "assets" / "models"

ALLOW = [
    "encoder_model.onnx",
    "encoder_model.onnx.data",
    "decoder_model.onnx",
    "decoder_with_past_model.onnx",
    "decoder_shared.onnx.data",
    "tokenizer_src.json",
    "tokenizer_tgt.json",
    "tokenizer_meta.json",
    "generation_config.json",
    "tokenizer_config.json",
]

BUNDLES = [
    ("hari31416/indictrans2-en-indic-dist-200M-ONNX-int8", MODELS / "it2_en_indic"),
    ("hari31416/indictrans2-indic-en-dist-200M-ONNX-int8", MODELS / "it2_indic_en"),
]


def main() -> None:
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    for repo, dest in BUNDLES:
        print(f"Downloading {repo} -> {dest}", flush=True)
        snapshot_download(repo_id=repo, local_dir=str(dest), allow_patterns=ALLOW)
        print(f"Done {dest}", flush=True)
    print("ALL_DONE", flush=True)


if __name__ == "__main__":
    main()
