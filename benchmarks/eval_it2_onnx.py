#!/usr/bin/env python3
"""Gold eval for the INT8 ONNX IndicTrans2 graphs the app actually ships.

Replicates mobile/src/mt/onnx/IndicTransOnnx.ts exactly: same tokenizer
files, same [src_lang, tgt_lang, ...text] input layout, same greedy decode
with decoder/decoder_with_past, same 96-token cap. Numbers here are what
the phone produces (modulo ORT kernel differences across platforms).

Usage:
    python benchmarks/eval_it2_onnx.py --model-dir /tmp/it2_indic_en_onnx \
        --direction ne-en --classes ne_en_deva ne_en_roman

For ne_en_roman the shipped roman→Devanagari converter is applied first
via node (scripts must be run from the repo root so mobile/ resolves).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
GOLD = ROOT / "gold"

sys.path.insert(0, str(ROOT))
from eval_it2_gold import chr_f, load_jsonl, norm  # noqa: E402

MAX_NEW_TOKENS = 96


class OnnxIt2:
    def __init__(self, model_dir: Path):
        opts = ort.SessionOptions()
        opts.log_severity_level = 3
        self.enc = ort.InferenceSession(str(model_dir / "encoder_model.onnx"), opts)
        self.dec = ort.InferenceSession(str(model_dir / "decoder_model.onnx"), opts)
        self.dec_past = ort.InferenceSession(
            str(model_dir / "decoder_with_past_model.onnx"), opts
        )
        self.src_tok = Tokenizer.from_file(str(model_dir / "tokenizer_src.json"))
        self.tgt_tok = Tokenizer.from_file(str(model_dir / "tokenizer_tgt.json"))
        self.meta = json.loads((model_dir / "tokenizer_meta.json").read_text())
        self.gen = json.loads((model_dir / "generation_config.json").read_text())
        self.num_layers = (len(self.dec.get_outputs()) - 1) // 4

    def translate(self, text: str, src_lang: str, tgt_lang: str) -> str:
        src_lang_id = self.src_tok.encode(src_lang, add_special_tokens=False).ids[0]
        tgt_lang_id = self.src_tok.encode(tgt_lang, add_special_tokens=False).ids[0]
        prepared = text if text.startswith(" ") else f" {text}"
        enc = self.src_tok.encode(prepared)
        unk = self.meta["unk_id"]
        src_size = self.meta["src_dict_size"]
        ids = [src_lang_id, tgt_lang_id] + [
            i if i < src_size else unk for i in enc.ids
        ]
        mask = [1, 1] + list(enc.attention_mask)

        input_ids = np.array([ids], dtype=np.int64)
        attn = np.array([mask], dtype=np.int64)
        enc_out = self.enc.run(None, {"input_ids": input_ids, "attention_mask": attn})[0]

        start = self.gen.get("decoder_start_token_id", 2)
        eos = self.gen.get("eos_token_id", 2)
        out_ids = [start]
        past: dict[str, np.ndarray] = {}
        dec_input = np.array([[start]], dtype=np.int64)

        for step in range(MAX_NEW_TOKENS):
            if step == 0:
                names = [o.name for o in self.dec.get_outputs()]
                outs = self.dec.run(
                    None,
                    {
                        "input_ids": dec_input,
                        "encoder_hidden_states": enc_out,
                        "encoder_attention_mask": attn,
                    },
                )
            else:
                names = [o.name for o in self.dec_past.get_outputs()]
                feed = {"input_ids": dec_input, "encoder_attention_mask": attn}
                for i in range(self.num_layers):
                    for part in ("decoder.key", "decoder.value", "encoder.key", "encoder.value"):
                        feed[f"past_key_values.{i}.{part}"] = past[f"present.{i}.{part}"]
                outs = self.dec_past.run(None, feed)

            by_name = dict(zip(names, outs))
            logits = by_name["logits"]
            past = by_name
            next_id = int(np.argmax(logits[0, -1]))
            out_ids.append(next_id)
            if next_id == eos:
                break
            dec_input = np.array([[next_id]], dtype=np.int64)

        tgt_size = self.meta["tgt_dict_size"]
        unk = self.meta["unk_id"]
        safe = [i if i < tgt_size else unk for i in out_ids]
        return self.tgt_tok.decode(safe, skip_special_tokens=True).strip()


def roman_to_deva_batch(lines: list[str]) -> list[str]:
    """Run the shipped TS converter so eval matches the app byte-for-byte."""
    bundle = "/tmp/romanize_bundle.cjs"
    subprocess.run(
        [
            "npx", "--yes", "esbuild",
            str(REPO / "mobile" / "src" / "mt" / "romanize.ts"),
            "--bundle", "--format=cjs", f"--outfile={bundle}",
        ],
        check=True,
        capture_output=True,
        cwd=REPO / "mobile",
    )
    script = (
        f"const m = require('{bundle}');"
        "const lines = JSON.parse(require('fs').readFileSync(0, 'utf8'));"
        "console.log(JSON.stringify(lines.map((l) => m.romanToDevanagari(l))));"
    )
    out = subprocess.run(
        ["node", "-e", script],
        input=json.dumps(lines),
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(out.stdout)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", required=True, type=Path)
    ap.add_argument("--direction", choices=["ne-en", "en-ne"], default="ne-en")
    ap.add_argument("--classes", nargs="+", default=["ne_en_deva", "ne_en_roman"])
    ap.add_argument("--tag", default="onnx_int8")
    args = ap.parse_args()

    engine = OnnxIt2(args.model_dir)
    if args.direction == "ne-en":
        src_lang, tgt_lang = "npi_Deva", "eng_Latn"
    else:
        src_lang, tgt_lang = "eng_Latn", "npi_Deva"

    results = {}
    for cls in args.classes:
        sources = {r["id"]: r for r in load_jsonl(GOLD / cls / "sources.jsonl")}
        refs = {r["id"]: r for r in load_jsonl(GOLD / cls / "references.jsonl")}
        pairs = []
        seen: set[str] = set()
        for i in sorted(sources):
            src, ref = sources[i]["source"], refs[i]["reference"]
            key = f"{norm(src)}|||{norm(ref)}"
            if key in seen:
                continue
            seen.add(key)
            pairs.append((src, ref))

        inputs = [s for s, _ in pairs]
        if cls == "ne_en_roman":
            inputs = roman_to_deva_batch(inputs)

        scores = []
        t0 = time.time()
        for text, (_, ref) in zip(inputs, pairs):
            pred = engine.translate(text, src_lang, tgt_lang)
            scores.append(chr_f(pred, ref))
        dt = time.time() - t0
        mean = sum(scores) / len(scores) if scores else 0.0
        results[cls] = {
            "n": len(scores),
            "chrf_mean": round(mean, 4),
            "sec_per_sentence": round(dt / max(len(scores), 1), 2),
        }
        print(f"{cls}: chrF {mean:.1%} (n={len(scores)}, {dt/len(scores):.2f}s/sent)")

    out = ROOT / "results" / f"onnx_{args.tag}.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print("wrote", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
