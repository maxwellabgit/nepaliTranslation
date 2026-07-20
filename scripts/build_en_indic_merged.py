"""
Build training/artifacts/it2_en_indic_merged from Raghavan weights + tokenizer files.
Same pattern as indic→en merge used for ungated local loads.
"""
from __future__ import annotations

import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download, snapshot_download

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "training" / "artifacts" / "it2_en_indic_merged"


def main() -> None:
    print("Fetching Raghavan EN→Indic weights...")
    rag = Path(snapshot_download("Raghavan/indictrans2-en-indic-dist-200M", max_workers=2))
    DEST.mkdir(parents=True, exist_ok=True)

    # Tokenizer/vocab from mostwise if available; else try copying from indic-en merged
    tok_src_repo = "mostwise/nep-eng-indictrans2-v3-address"
    tok_files = [
        "tokenization_indictrans.py",
        "tokenizer_config.json",
        "dict.SRC.json",
        "dict.TGT.json",
        "model.SRC",
        "model.TGT",
        "special_tokens_map.json",
    ]
    fallback = ROOT / "training" / "artifacts" / "it2_indic_en_merged"

    for f in tok_files:
        try:
            p = hf_hub_download(tok_src_repo, f)
            shutil.copy2(p, DEST / f)
            print("tok", f)
        except Exception as e:
            alt = fallback / f
            if alt.exists():
                shutil.copy2(alt, DEST / f)
                print("tok-fallback", f)
            else:
                print("MISSING", f, e)

    for name in [
        "config.json",
        "configuration_indictrans.py",
        "modeling_indictrans.py",
        "generation_config.json",
        "pytorch_model.bin",
        "model.safetensors",
    ]:
        src = rag / name
        if src.exists():
            shutil.copy2(src, DEST / name)
            print("weights", name, src.stat().st_size)

    # Prefer mostwise modeling (fixes decoder_attention_mask None bug)
    try:
        p = hf_hub_download(tok_src_repo, "modeling_indictrans.py")
        shutil.copy2(p, DEST / "modeling_indictrans.py")
        print("modeling from mostwise")
    except Exception:
        pass

    print("Built", DEST)
    print(sorted(p.name for p in DEST.iterdir()))


if __name__ == "__main__":
    main()
