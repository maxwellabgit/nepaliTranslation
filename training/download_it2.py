#!/usr/bin/env python3
"""Download IndicTrans2 dist-200M bases (MIT, commercial) for on-device FT."""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("PYTHONUNBUFFERED", "1")

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))


def main() -> int:
    from benchmarks.hf_login import load_hf_token
    from huggingface_hub import hf_hub_download, login, list_repo_files

    login(token=load_hf_token(), add_to_git_credential=False)
    targets = [
        ("ai4bharat/indictrans2-en-indic-dist-200M", REPO / "training" / "artifacts" / "it2_en_indic_merged"),
        ("ai4bharat/indictrans2-indic-en-dist-200M", REPO / "training" / "artifacts" / "it2_indic_en_merged"),
    ]
    # Prefer safetensors only (skip duplicate pytorch_model.bin ~1GB)
    skip = {"pytorch_model.bin"}
    for repo, dest in targets:
        dest.mkdir(parents=True, exist_ok=True)
        print(f"== {repo} → {dest}", flush=True)
        files = list_repo_files(repo)
        for f in files:
            if f in skip or f.startswith("."):
                continue
            print(f"  {f}", flush=True)
            hf_hub_download(repo, f, local_dir=str(dest))
        print("OK", dest, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
