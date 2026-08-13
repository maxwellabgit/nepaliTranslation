#!/usr/bin/env python3
"""Load HF_TOKEN from benchmarks/.env without printing it."""
from __future__ import annotations

from pathlib import Path


def load_hf_token(env_path: Path | None = None) -> str:
    path = env_path or Path(__file__).resolve().parent / ".env"
    if not path.exists():
        raise FileNotFoundError(f"HF_TOKEN file missing: {path}")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("HF_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise FileNotFoundError(f"HF_TOKEN not found in {path}")


def try_hf_login() -> bool:
    """Login when a token is present. IndicTrans2 dist-200M is public MIT."""
    try:
        from huggingface_hub import login

        login(token=load_hf_token(), add_to_git_credential=False)
        return True
    except Exception as exc:
        print(f"[hf] skip login ({exc}); public models should still download", flush=True)
        return False


if __name__ == "__main__":
    from huggingface_hub import login, whoami

    tok = load_hf_token()
    login(token=tok, add_to_git_credential=False)
    info = whoami()
    print("authenticated as", info.get("name") or info.get("fullname") or info)
