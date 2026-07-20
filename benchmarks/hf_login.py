#!/usr/bin/env python3
"""Load HF_TOKEN from benchmarks/.env without printing it."""
from __future__ import annotations

from pathlib import Path


def load_hf_token(env_path: Path | None = None) -> str:
    path = env_path or Path(__file__).resolve().parent / ".env"
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("HF_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"HF_TOKEN not found in {path}")


if __name__ == "__main__":
    from huggingface_hub import login, whoami

    tok = load_hf_token()
    login(token=tok, add_to_git_credential=False)
    info = whoami()
    print("authenticated as", info.get("name") or info.get("fullname") or info)
