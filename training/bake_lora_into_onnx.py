#!/usr/bin/env python3
"""Bake the generated-data LoRA into the shipped INT8 ONNX graphs.

The phone loads these graphs, not a PyTorch adapter. q_proj and v_proj are
stored as W transposed, int8, with a per-output-channel scale. This adds the
LoRA delta to the original float weight and writes the new int8 values and
scales back into the external data files. It does not call merge_and_unload.
"""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

import numpy as np
import onnx
import torch
from peft import PeftModel
from peft.tuners.lora import Linear as LoraLinear
from safetensors import safe_open
from transformers import AutoModelForSeq2SeqLM

REPO = Path(__file__).resolve().parents[1]
SRC_MODELS = REPO / "mobile" / "assets" / "models"
OUT = REPO / "training" / "artifacts" / "it2_generated_onnx"
NODE_RE = re.compile(
    r"/(encoder|decoder)/layers\.(\d+)/(self_attn|encoder_attn)/(q_proj|v_proj)/MatMul_quant$"
)

PAIRS = [
    (
        "it2_en_indic",
        REPO / "training" / "artifacts" / "it2_en_indic_merged",
        REPO / "training" / "artifacts" / "it2_generated_en_ne_lora",
    ),
    (
        "it2_indic_en",
        REPO / "training" / "artifacts" / "it2_indic_en_merged",
        REPO / "training" / "artifacts" / "it2_generated_ne_en_lora",
    ),
]


def deltas_for(base: Path, adapter: Path) -> dict[str, np.ndarray]:
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(base), trust_remote_code=True, torch_dtype=torch.float32
    )
    peft = PeftModel.from_pretrained(model, str(adapter))
    found: dict[str, np.ndarray] = {}
    for name, module in peft.named_modules():
        if not isinstance(module, LoraLinear):
            continue
        for kind in ("encoder.layers", "decoder.layers"):
            at = name.find(kind)
            if at >= 0:
                found[name[at:]] = module.get_delta_weight("default").detach().float().cpu().numpy()
                break
    del peft, model
    return found


def base_weight(handle, suffix: str) -> np.ndarray:
    return handle.get_tensor(f"model.{suffix}.weight").astype(np.float32)


def external_meta(tensor) -> dict[str, str]:
    return {item.key: item.value for item in tensor.external_data}


def read_array(model_dir: Path, tensor) -> np.ndarray:
    if tensor.float_data:
        return np.array(tensor.float_data, dtype=np.float32)
    meta = external_meta(tensor)
    if "offset" not in meta:
        raise SystemExit(f"no storage for {tensor.name}")
    dtype = {1: np.float32, 3: np.int8}[tensor.data_type]
    shape = tuple(dim for dim in tensor.dims)
    with (model_dir / meta["location"]).open("rb") as handle:
        handle.seek(int(meta["offset"]))
        raw = handle.read(int(meta["length"]))
    return np.array(np.frombuffer(raw, dtype=dtype).reshape(shape), copy=True)


def write_array(model_dir: Path, tensor, array: np.ndarray) -> None:
    meta = external_meta(tensor)
    if "offset" not in meta:
        del tensor.float_data[:]
        tensor.float_data.extend(np.ascontiguousarray(array, dtype=np.float32).tolist())
        return
    raw = np.ascontiguousarray(array).tobytes()
    if len(raw) != int(meta["length"]):
        raise SystemExit(f"size changed for {tensor.name}: {len(raw)} != {meta['length']}")
    with (model_dir / meta["location"]).open("r+b") as handle:
        handle.seek(int(meta["offset"]))
        handle.write(raw)


def patch_graph(model_dir: Path, graph_name: str, weights, deltas: dict[str, np.ndarray]) -> int:
    model = onnx.load(str(model_dir / graph_name), load_external_data=False)
    by_name = {item.name: item for item in model.graph.initializer}
    patched = 0
    checked = 0
    for node in model.graph.node:
        if node.op_type != "MatMulInteger":
            continue
        match = NODE_RE.search(node.name)
        if not match:
            continue
        suffix = f"{match.group(1)}.layers.{match.group(2)}.{match.group(3)}.{match.group(4)}"
        if suffix not in deltas:
            raise SystemExit(f"no LoRA delta for {suffix}")
        weight_name = node.input[1]
        scale_name = weight_name.replace("_quantized", "_scale")
        quant = by_name[weight_name]
        scale = by_name[scale_name]
        quant_arr = read_array(model_dir, quant)
        scale_arr = read_array(model_dir, scale)
        base = base_weight(weights, suffix)
        rebuilt = quant_arr.astype(np.float32) * scale_arr.astype(np.float32)[None, :]
        error = float(np.abs(rebuilt - base.T).mean())
        if error > 0.005:
            raise SystemExit(f"{graph_name} {suffix} does not match the base weight (mean abs {error:.5f})")
        checked += 1
        updated = base + deltas[suffix]
        new_scale = np.maximum(np.max(np.abs(updated), axis=1) / 127.0, 1e-8).astype(np.float32)
        new_quant = np.clip(np.rint(updated.T / new_scale[None, :]), -127, 127).astype(np.int8)
        write_array(model_dir, quant, new_quant)
        write_array(model_dir, scale, new_scale)
        patched += 1
    onnx.save(model, str(model_dir / graph_name))
    print(f"[bake] {model_dir.name} {graph_name} patched={patched} checked={checked}", flush=True)
    if patched == 0:
        raise SystemExit(f"no projections patched in {graph_name}")
    return patched


def main() -> int:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for folder, base, adapter in PAIRS:
        dest = OUT / folder
        print(f"[bake] copy {folder}", flush=True)
        shutil.copytree(SRC_MODELS / folder, dest)
        print(f"[bake] deltas {folder}", flush=True)
        delta = deltas_for(base, adapter)
        print(f"[bake] {folder} deltas={len(delta)}", flush=True)
        with safe_open(str(base / "model.safetensors"), framework="np") as weights:
            for graph_name in (
                "encoder_model.onnx",
                "decoder_model.onnx",
                "decoder_with_past_model.onnx",
            ):
                patch_graph(dest, graph_name, weights, delta)
    print(f"[bake] wrote {OUT}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
