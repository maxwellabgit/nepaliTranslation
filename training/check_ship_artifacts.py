#!/usr/bin/env python3
"""No-GPU inventory of model-ship artifacts.

Prints what is on disk vs what gold eval and on-device export expect.
Never prints chrF or other quality scores. Exit 0 only when both INT8 ONNX
ship bundles are complete. Missing PyTorch/LoRA dirs are reported but do
not by themselves make a ship-ready IPA.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ART = REPO / "training" / "artifacts"
MOBILE = REPO / "mobile" / "assets" / "models"

ONNX_FILES = [
    "encoder_model.onnx",
    "encoder_model.onnx.data",
    "decoder_model.onnx",
    "decoder_with_past_model.onnx",
    "decoder_shared.onnx.data",
    "tokenizer_src.json",
    "tokenizer_tgt.json",
    "tokenizer_meta.json",
    "generation_config.json",
]

# Names must match benchmarks/eval_it2_gold.py
EVAL_DIRS = [
    ("it2_base EN→NE", ART / "it2_en_indic_merged"),
    ("it2_base NE→EN", ART / "it2_indic_en_merged"),
    ("it2_gold_ft EN→NE LoRA", ART / "it2_en_indic_gold_ft"),
    ("it2_gold_ft NE→EN LoRA", ART / "it2_indic_en_gold_ft"),
    ("it2_cpu EN→NE LoRA", ART / "it2_cpu_en_ne_lora"),
    ("it2_cpu NE→EN LoRA", ART / "it2_cpu_ne_en_lora"),
    ("it2_meanings EN→NE LoRA", ART / "it2_meanings_en_ne_lora"),
    ("it2_meanings NE→EN LoRA", ART / "it2_meanings_ne_en_lora"),
]

SHIP_ONNX = [
    ("EN→NE INT8 ONNX", MOBILE / "it2_en_indic"),
    ("NE→EN INT8 ONNX", MOBILE / "it2_indic_en"),
]

WHISPER = MOBILE / "whisper"


def nonempty_dir(path: Path) -> bool:
    if not path.is_dir():
        return False
    return any(path.iterdir())


def lora_present(path: Path) -> bool:
    return (path / "adapter" / "adapter_config.json").is_file() or any(
        path.rglob("adapter_config.json")
    )


def onnx_complete(path: Path) -> tuple[bool, list[str]]:
    missing = [n for n in ONNX_FILES if not (path / n).is_file() or (path / n).stat().st_size <= 0]
    return (not missing, missing)


def main() -> int:
    report: dict = {
        "gpu_probe": None,
        "eval_checkpoints": {},
        "ship_onnx": {},
        "whisper_ggml": None,
        "runnable_gold_eval": False,
        "runnable_onnx_ship": False,
        "blockers": [],
    }

    try:
        import torch  # noqa: F401

        cuda = bool(getattr(__import__("torch"), "cuda").is_available())
        report["gpu_probe"] = {"torch": True, "cuda": cuda}
    except Exception:
        report["gpu_probe"] = {"torch": False, "cuda": False}

    eval_ok = []
    for label, path in EVAL_DIRS:
        exists = nonempty_dir(path)
        adapter = lora_present(path) if exists else False
        config = (path / "config.json").is_file()
        report["eval_checkpoints"][label] = {
            "path": str(path.relative_to(REPO)),
            "present": exists,
            "config_json": config,
            "lora_adapter": adapter,
        }
        if exists and (config or adapter):
            eval_ok.append(label)

    onnx_ok = True
    for label, path in SHIP_ONNX:
        complete, missing = onnx_complete(path)
        report["ship_onnx"][label] = {
            "path": str(path.relative_to(REPO)),
            "complete": complete,
            "missing": missing,
        }
        if not complete:
            onnx_ok = False

    whisper_files = list(WHISPER.glob("*.bin")) if WHISPER.is_dir() else []
    report["whisper_ggml"] = {
        "path": str(WHISPER.relative_to(REPO)),
        "present": bool(whisper_files),
        "files": [p.name for p in whisper_files],
    }

    base_en = nonempty_dir(ART / "it2_en_indic_merged") and (
        ART / "it2_en_indic_merged" / "config.json"
    ).is_file()
    base_ne = nonempty_dir(ART / "it2_indic_en_merged") and (
        ART / "it2_indic_en_merged" / "config.json"
    ).is_file()
    report["runnable_gold_eval"] = base_en and base_ne
    report["runnable_onnx_ship"] = onnx_ok

    if not report["gpu_probe"]["torch"]:
        report["blockers"].append("No PyTorch in this environment — cannot load IndicTrans2 for eval_it2_gold.py.")
    elif not report["gpu_probe"]["cuda"]:
        report["blockers"].append("No CUDA. CPU eval is possible only if merged IT2 dirs exist.")
    if not eval_ok:
        report["blockers"].append(
            "No eval checkpoints under training/artifacts/ "
            "(need it2_en_indic_merged + it2_indic_en_merged with config.json)."
        )
    if not onnx_ok:
        report["blockers"].append(
            "ONNX ship bundles incomplete under mobile/assets/models/it2_en_indic and it2_indic_en. "
            "EAS packs these via plugins/withIt2Models.js; eas_fetch_it2_models.mjs can download INT8."
        )

    print(json.dumps(report, indent=2))
    print("result:", "PASS (ONNX ship-ready)" if onnx_ok else "BLOCKED (nothing to eval or ship from this box)")
    return 0 if onnx_ok else 1


if __name__ == "__main__":
    sys.exit(main())
