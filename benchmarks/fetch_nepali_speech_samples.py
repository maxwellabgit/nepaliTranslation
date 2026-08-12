#!/usr/bin/env python3
"""Fetch spoken-Nepali samples (audio + transcripts) for STT validation.

Pulls N clips from the FLEURS ne_np test split on Hugging Face — read
speech from native speakers with sentence-level Devanagari transcripts.
The audio tarball is streamed, so only the first N clips are downloaded
regardless of split size.

Usage:
    python benchmarks/fetch_nepali_speech_samples.py --n 20
    python benchmarks/fetch_nepali_speech_samples.py --split validation --n 10

Output (default benchmarks/speech_samples/fleurs_ne_<split>/):
    *.wav            16 kHz mono clips
    manifest.jsonl   {"file", "transcription", "raw_transcription"} per clip

Other corpora worth knowing about (not fetched here):
    OpenSLR SLR54  ~157k Nepali utterances, CC BY-SA 4.0  https://openslr.org/54
    OpenSLR SLR43  Nepali TTS corpus (~2.8 h)             https://openslr.org/43
    Common Voice   ne-NP, ~2 h, CC-0                      https://commonvoice.mozilla.org
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import shutil
import subprocess
import tarfile
import urllib.request
from pathlib import Path

BASE = "https://huggingface.co/datasets/google/fleurs/resolve/main/data/ne_np"


def load_transcripts(split: str) -> dict[str, dict[str, str]]:
    url = f"{BASE}/{split}.tsv"
    with urllib.request.urlopen(url) as resp:
        text = resp.read().decode("utf-8")
    out: dict[str, dict[str, str]] = {}
    # Columns: id, filename, raw_transcription, transcription, chars, samples, gender
    for row in csv.reader(io.StringIO(text), delimiter="\t"):
        if len(row) < 4:
            continue
        out[row[1]] = {"raw_transcription": row[2], "transcription": row[3]}
    return out


def fetch(split: str, n: int, out_dir: Path) -> int:
    transcripts = load_transcripts(split)
    print(f"{split}.tsv: {len(transcripts)} transcripts")

    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = out_dir / "manifest.jsonl"
    saved = 0

    url = f"{BASE}/audio/{split}.tar.gz"
    with urllib.request.urlopen(url) as resp, tarfile.open(
        fileobj=resp, mode="r|gz"
    ) as tar, manifest.open("w", encoding="utf-8") as mf:
        for member in tar:
            if saved >= n:
                break
            if not member.name.endswith(".wav"):
                continue
            name = Path(member.name).name
            meta = transcripts.get(name)
            if meta is None:
                continue
            fobj = tar.extractfile(member)
            if fobj is None:
                continue
            (out_dir / name).write_bytes(fobj.read())
            mf.write(json.dumps({"file": name, **meta}, ensure_ascii=False) + "\n")
            saved += 1
            print(f"  [{saved}/{n}] {name}: {meta['transcription'][:60]}")

    return saved


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--n", type=int, default=20, help="number of clips")
    ap.add_argument(
        "--split", default="test", choices=["train", "validation", "test"]
    )
    ap.add_argument("--out", default=None, help="output directory")
    ap.add_argument(
        "--pcm16",
        action="store_true",
        help="convert to 16-bit PCM via ffmpeg (FLEURS ships float32; "
        "whisper.cpp needs s16)",
    )
    args = ap.parse_args()

    out_dir = (
        Path(args.out)
        if args.out
        else Path(__file__).parent / "speech_samples" / f"fleurs_ne_{args.split}"
    )
    saved = fetch(args.split, args.n, out_dir)
    print(f"Saved {saved} clips + manifest to {out_dir}")

    if args.pcm16:
        if not shutil.which("ffmpeg"):
            raise SystemExit("--pcm16 requires ffmpeg on PATH")
        for wav in sorted(out_dir.glob("*.wav")):
            tmp = wav.with_suffix(".s16.wav")
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                 "-acodec", "pcm_s16le", "-ar", "16000", str(tmp)],
                check=True,
            )
            tmp.replace(wav)
        print(f"Converted {saved} clips to 16-bit PCM")


if __name__ == "__main__":
    main()
