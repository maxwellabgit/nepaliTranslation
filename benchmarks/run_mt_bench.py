#!/usr/bin/env python3
"""
Autonomous FLORES / IN22 MT benchmark for local IndicTrans2 models.

Primary: eng_Latn ↔ npi_Deva (and hin_Deva) on FLORES-200/FLORES+ or cached sample.
Metrics: corpus BLEU + chrF++ (sacrebleu).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Prefer non-XET hub downloads (more reliable in restricted / cloud envs).
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

BENCH_DIR = Path(__file__).resolve().parent
DATA_DIR = BENCH_DIR / "data"
RESULTS_DIR = BENCH_DIR / "results"
SAMPLE_JSON = DATA_DIR / "flores_sample.json"
FLORES101_URL = "https://dl.fbaipublicfiles.com/flores101/dataset/flores101_dataset.tar.gz"

LANG_COLS = {
    "eng": "eng_Latn",
    "npi": "npi_Deva",
    "hin": "hin_Deva",
}

DIRECTION_META = {
    "ne-en": ("npi_Deva", "eng_Latn", "indic_en"),
    "en-ne": ("eng_Latn", "npi_Deva", "en_indic"),
    "hi-en": ("hin_Deva", "eng_Latn", "indic_en"),
    "en-hi": ("eng_Latn", "hin_Deva", "en_indic"),
}


def _ensure_deps() -> None:
    missing: list[str] = []
    for mod, pip_name in [
        ("sacrebleu", "sacrebleu"),
        ("transformers", "transformers"),
        ("torch", "torch"),
        ("IndicTransToolkit", "IndicTransToolkit"),
        ("tqdm", "tqdm"),
    ]:
        try:
            __import__(mod)
        except ImportError:
            missing.append(pip_name)
    if missing:
        import subprocess

        print(f"[bench] Installing: {missing}", flush=True)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *missing])


def download_flores101_sample(dest: Path = SAMPLE_JSON) -> Path:
    """Download FLORES-101 and cache eng/npi/hin parallel JSON."""
    import tarfile
    import tempfile

    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"[bench] Downloading FLORES-101 fallback → {dest}", flush=True)
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        urllib.request.urlretrieve(FLORES101_URL, tmp_path)
        with tarfile.open(tmp_path, "r:gz") as tar:

            def read_lang(name: str) -> list[str]:
                f = tar.extractfile(name)
                assert f is not None
                return [ln.decode("utf-8").rstrip("\n") for ln in f]

            eng = read_lang("flores101_dataset/dev/eng.dev")
            npi = read_lang("flores101_dataset/dev/npi.dev")
            hin = read_lang("flores101_dataset/dev/hin.dev")
        rows = [
            {"id": i, "eng_Latn": e, "npi_Deva": n, "hin_Deva": h}
            for i, (e, n, h) in enumerate(zip(eng, npi, hin))
        ]
        payload = {
            "source": "FLORES-101/dev (eng/npi/hin)",
            "n": len(rows),
            "pairs": rows,
        }
        dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[bench] Cached {len(rows)} pairs at {dest}", flush=True)
        return dest
    finally:
        tmp_path.unlink(missing_ok=True)


def load_flores_hf(n: int) -> tuple[list[dict[str, str]], str]:
    """Try HuggingFace FLORES+ / FLORES-200. Raises on failure."""
    from datasets import load_dataset

    attempts: list[tuple[str, dict[str, Any]]] = [
        ("openlanguagedata/flores_plus", {"split": "dev"}),
        ("facebook/flores", {"name": "flores200_dev", "split": "dev"}),
    ]
    last_err: Exception | None = None
    for name, kwargs in attempts:
        try:
            split = kwargs.pop("split", "dev")
            ds = load_dataset(name, **kwargs, split=split)
            rows: list[dict[str, str]] = []
            for i, row in enumerate(ds):
                if i >= max(n * 4, 200):
                    break
                item: dict[str, str] = {"id": str(i)}
                for col in ("eng_Latn", "npi_Deva", "hin_Deva"):
                    # FLORES+ may nest under 'text' or use sentence_* keys
                    if col in row and row[col]:
                        item[col] = str(row[col]).strip()
                    elif f"sentence_{col}" in row and row[f"sentence_{col}"]:
                        item[col] = str(row[f"sentence_{col}"]).strip()
                if "eng_Latn" in item and "npi_Deva" in item:
                    rows.append(item)
                if len(rows) >= n:
                    break
            if not rows:
                raise RuntimeError(f"{name}: no eng/npi rows parsed (cols={ds.column_names})")
            return rows, f"huggingface:{name}"
        except Exception as e:
            last_err = e
            print(f"[bench] HF load failed ({name}): {e}", flush=True)
    raise RuntimeError(f"All HF FLORES loads failed: {last_err}")


def load_flores_sample(n: int) -> tuple[list[dict[str, str]], str]:
    path = SAMPLE_JSON
    if not path.exists():
        download_flores101_sample(path)
    data = json.loads(path.read_text(encoding="utf-8"))
    pairs = data["pairs"][:n]
    src = data.get("source", str(path))
    return pairs, f"cached:{src}"


def load_eval_data(n: int) -> tuple[list[dict[str, str]], str]:
    try:
        rows, src = load_flores_hf(n)
        return rows[:n], src
    except Exception as e:
        print(f"[bench] Using cached FLORES sample ({e})", flush=True)
        return load_flores_sample(n)


def try_load_in22(n: int) -> tuple[list[dict[str, str]], str] | None:
    try:
        from datasets import load_dataset

        ds = load_dataset("ai4bharat/IN22-Conv", split="test")
    except Exception as e:
        print(f"[bench] IN22-Conv unavailable: {e}", flush=True)
        return None

    rows: list[dict[str, str]] = []
    for i, row in enumerate(ds):
        eng = row.get("eng_Latn") or row.get("en") or row.get("english")
        npi = row.get("npi_Deva") or row.get("ne") or row.get("nepali")
        hin = row.get("hin_Deva") or row.get("hi") or row.get("hindi")
        if not eng:
            continue
        item = {"id": str(i), "eng_Latn": str(eng).strip()}
        if npi:
            item["npi_Deva"] = str(npi).strip()
        if hin:
            item["hin_Deva"] = str(hin).strip()
        if "npi_Deva" in item or "hin_Deva" in item:
            rows.append(item)
        if len(rows) >= n:
            break
    if not rows:
        return None
    return rows, "huggingface:ai4bharat/IN22-Conv"


def score_corpus(hyps: list[str], refs: list[str], tgt_lang: str) -> dict[str, float]:
    import sacrebleu

    # English refs: 13a; Devanagari: character-friendly tokenization
    if tgt_lang == "eng_Latn":
        bleu = sacrebleu.corpus_bleu(hyps, [refs], tokenize="13a")
    else:
        # flores200 tokenizer handles non-Latin better when available
        try:
            bleu = sacrebleu.corpus_bleu(hyps, [refs], tokenize="flores200")
        except Exception:
            bleu = sacrebleu.corpus_bleu(hyps, [refs], tokenize="none")
    chrf = sacrebleu.corpus_chrf(hyps, [refs], word_order=2)  # chrF++
    return {
        "bleu": round(float(bleu.score), 2),
        "chrf": round(float(chrf.score), 2),
        "chrf_plus_plus": round(float(chrf.score), 2),
        "n": len(hyps),
    }


def load_manager(device: str | None):
    from core.translation.indictrans2 import TranslationManager

    tm = TranslationManager(device=device, num_beams=1, max_length=256)
    print("[bench] Loading TranslationManager…", flush=True)
    t0 = time.perf_counter()
    tm.load()
    print(
        f"[bench] Ready in {time.perf_counter() - t0:.1f}s "
        f"device={tm.device} en_indic={'yes' if tm._en_indic else 'NO'}",
        flush=True,
    )
    return tm


def translate_batch(
    tm,
    texts: list[str],
    src_lang: str,
    tgt_lang: str,
    pair_key: str,
) -> list[str]:
    from tqdm import tqdm

    if pair_key == "indic_en":
        pair = tm._indic_en
    else:
        pair = tm._en_indic
    if pair is None:
        raise RuntimeError(f"Model pair '{pair_key}' not loaded")

    hyps: list[str] = []
    for text in tqdm(texts, desc=f"{src_lang}→{tgt_lang}", unit="sent"):
        hyp = tm._generate(pair, text, src_lang, tgt_lang)
        hyps.append(hyp.strip())
    return hyps


def eval_direction(
    tm,
    rows: list[dict[str, str]],
    direction: str,
    n_examples: int = 5,
) -> dict[str, Any]:
    src_col, tgt_col, pair_key = DIRECTION_META[direction]
    usable = [r for r in rows if r.get(src_col) and r.get(tgt_col)]
    if not usable:
        return {
            "direction": direction,
            "error": f"No rows with {src_col}/{tgt_col}",
            "bleu": None,
            "chrf": None,
        }

    srcs = [r[src_col] for r in usable]
    refs = [r[tgt_col] for r in usable]
    t0 = time.perf_counter()
    try:
        hyps = translate_batch(tm, srcs, src_col, tgt_col, pair_key)
    except Exception as e:
        return {
            "direction": direction,
            "src": src_col,
            "tgt": tgt_col,
            "error": str(e),
            "bleu": None,
            "chrf": None,
        }
    elapsed = time.perf_counter() - t0
    metrics = score_corpus(hyps, refs, tgt_col)
    examples = []
    for i in range(min(n_examples, len(srcs))):
        examples.append(
            {
                "src": srcs[i],
                "ref": refs[i],
                "hyp": hyps[i],
            }
        )
    return {
        "direction": direction,
        "src": src_col,
        "tgt": tgt_col,
        "model": pair_key,
        **metrics,
        "latency_s": round(elapsed, 2),
        "latency_ms_per_sent": round(1000 * elapsed / max(len(hyps), 1), 1),
        "examples": examples,
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="FLORES MT benchmark for IndicTrans2")
    p.add_argument("--n", type=int, default=50, help="Sentences per direction (default 50)")
    p.add_argument(
        "--directions",
        type=str,
        default="ne-en,en-ne,hi-en,en-hi",
        help="Comma-separated: ne-en,en-ne,hi-en,en-hi",
    )
    p.add_argument("--device", type=str, default=None, help="cuda|cpu (default: auto)")
    p.add_argument("--skip-secondary", action="store_true", help="Skip IN22-Conv")
    p.add_argument(
        "--out",
        type=Path,
        default=RESULTS_DIR / "flores_baseline.json",
        help="Output JSON path",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    _ensure_deps()
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    directions = [d.strip() for d in args.directions.split(",") if d.strip()]
    for d in directions:
        if d not in DIRECTION_META:
            print(f"[bench] Unknown direction: {d}", flush=True)
            return 2

    rows, data_source = load_eval_data(args.n)
    print(f"[bench] Eval data: {data_source} n={len(rows)}", flush=True)

    failures: list[str] = []
    tm = None
    try:
        tm = load_manager(args.device)
    except Exception as e:
        failures.append(f"model_load: {e}")
        result = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "data_source": data_source,
            "eval_n": args.n,
            "failures": failures,
            "primary": {},
            "secondary": None,
        }
        args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[bench] FATAL model load: {e}", flush=True)
        return 1

    primary: dict[str, Any] = {}
    for d in directions:
        print(f"[bench] Evaluating {d}…", flush=True)
        res = eval_direction(tm, rows, d)
        primary[d] = res
        if res.get("error"):
            failures.append(f"{d}: {res['error']}")
            print(f"[bench] FAIL {d}: {res['error']}", flush=True)
        else:
            print(
                f"[bench] {d}: BLEU={res['bleu']}  chrF++={res['chrf']}  "
                f"({res['latency_ms_per_sent']} ms/sent)",
                flush=True,
            )

    secondary = None
    if not args.skip_secondary:
        in22 = try_load_in22(args.n)
        if in22 is not None:
            in22_rows, in22_src = in22
            secondary = {"data_source": in22_src, "directions": {}}
            for d in directions:
                if d.startswith("hi") or d.endswith("hi"):
                    # IN22 may lack some langs; still attempt
                    pass
                res = eval_direction(tm, in22_rows, d)
                secondary["directions"][d] = res
                if res.get("error"):
                    failures.append(f"in22/{d}: {res['error']}")

    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "data_source": data_source,
        "eval_n": len(rows),
        "requested_n": args.n,
        "device": tm.device,
        "models": {
            "indic_en": str(tm.indic_en_dir),
            "en_indic": str(tm.en_indic_dir) if tm.en_indic_dir else None,
            "en_indic_loaded": tm._en_indic is not None,
        },
        "metrics": {
            "primary": "chrF++ (sacrebleu corpus_chrf word_order=2)",
            "secondary": "BLEU (sacrebleu)",
        },
        "primary": primary,
        "secondary": secondary,
        "failures": failures,
        "honorific_probe": str(BENCH_DIR / "honorific_probe.json"),
    }
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[bench] Wrote {args.out}", flush=True)
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
