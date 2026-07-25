#!/usr/bin/env python3
"""Download IndicTrans2 en-indic 1B teacher weights for local synthetic QC."""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

REPO = Path(__file__).resolve().parents[2]
DEST = REPO / "training" / "artifacts" / "it2_en_indic_1b"
HF_ID = "ai4bharat/indictrans2-en-indic-1B"


def download() -> None:
    sys.path.insert(0, str(REPO))
    from benchmarks.hf_login import load_hf_token
    from huggingface_hub import hf_hub_download, list_repo_files, login

    login(token=load_hf_token(), add_to_git_credential=False)
    DEST.mkdir(parents=True, exist_ok=True)
    skip = {"pytorch_model.bin"}
    print(f"== {HF_ID} -> {DEST}", flush=True)
    for f in list_repo_files(HF_ID):
        if f in skip or f.startswith("."):
            continue
        print(f"  {f}", flush=True)
        hf_hub_download(HF_ID, f, local_dir=str(DEST))
    print("OK", DEST, flush=True)


def main() -> int:
    download()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
