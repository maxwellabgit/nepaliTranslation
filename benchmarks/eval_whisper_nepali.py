#!/usr/bin/env python3
"""Score whisper.cpp models on the fetched FLEURS Nepali clips (CER/WER).

Prereqs:
    python benchmarks/fetch_nepali_speech_samples.py --n 40 --pcm16
    whisper.cpp built with a `whisper-cli` binary; ggml models downloaded.

Usage:
    python benchmarks/eval_whisper_nepali.py \
        --whisper /tmp/whisper.cpp/build/bin/whisper-cli \
        --models /tmp/whisper/ggml-base-q5_1.bin /tmp/whisper/ggml-small-q5_1.bin
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SAMPLES = ROOT / "speech_samples" / "fleurs_ne_test"


def norm_deva(s: str) -> str:
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"[\u0964\u0965.,!?;:\"'()\[\]{}—–-]+", " ", s)
    # Whisper often emits ASCII digits where FLEURS uses Devanagari (or vice versa)
    trans = str.maketrans("०१२३४५६७८९", "0123456789")
    s = s.translate(trans)
    return re.sub(r"\s+", " ", s).strip().lower()


def edit_distance(a: list[str], b: list[str]) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(pred: str, ref: str) -> float:
    p, r = list(norm_deva(pred).replace(" ", "")), list(norm_deva(ref).replace(" ", ""))
    return edit_distance(p, r) / max(len(r), 1)


def wer(pred: str, ref: str) -> float:
    p, r = norm_deva(pred).split(), norm_deva(ref).split()
    return edit_distance(p, r) / max(len(r), 1)


def transcribe(whisper: Path, model: Path, wav: Path, threads: int) -> tuple[str, float]:
    t0 = time.time()
    out = subprocess.run(
        [
            str(whisper), "-m", str(model), "-f", str(wav),
            "-l", "ne", "-t", str(threads), "-np", "-nt",
        ],
        capture_output=True,
        timeout=600,
    )
    # whisper-cli can emit a truncated multi-byte sequence at buffer edges.
    return out.stdout.decode("utf-8", errors="replace").strip(), time.time() - t0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--whisper", type=Path, required=True)
    ap.add_argument("--models", type=Path, nargs="+", required=True)
    ap.add_argument("--samples", type=Path, default=SAMPLES)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    manifest = [
        json.loads(l)
        for l in (args.samples / "manifest.jsonl").read_text().splitlines()
        if l.strip()
    ]
    if args.limit:
        manifest = manifest[: args.limit]

    results = {}
    for model in args.models:
        name = model.stem
        cers, wers, times = [], [], []
        print(f"\n== {name} ==")
        for row in manifest:
            wav = args.samples / row["file"]
            ref = row["transcription"]
            pred, dt = transcribe(args.whisper, model, wav, args.threads)
            c, w = cer(pred, ref), wer(pred, ref)
            cers.append(c)
            wers.append(w)
            times.append(dt)
            print(f"  {row['file'][:18]}… CER {c:.0%} WER {w:.0%} ({dt:.1f}s)")
            print(f"    ref:  {ref[:70]}")
            print(f"    pred: {pred[:70]}")
        results[name] = {
            "n": len(cers),
            "cer_mean": round(sum(cers) / len(cers), 4),
            "wer_mean": round(sum(wers) / len(wers), 4),
            "sec_per_clip": round(sum(times) / len(times), 1),
        }
        print(
            f"{name}: CER {results[name]['cer_mean']:.1%} "
            f"WER {results[name]['wer_mean']:.1%} "
            f"({results[name]['sec_per_clip']}s/clip)"
        )

    out = ROOT / "results" / "whisper_nepali.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print("\nwrote", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
