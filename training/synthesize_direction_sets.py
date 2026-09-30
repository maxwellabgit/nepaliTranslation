#!/usr/bin/env python3
"""Build filled EN→NE and NE→EN sets from training and benchmark English.

EN→NE uses the local IndicTrans2 1B checkpoint (BF16), not INT8.
Informal Nepali is a second 1B pass with the <informal> prefix; if that
pass copies the formal line, the project's तिमी rewrite is kept instead.
NE→EN uses the local full-precision dist-200M indic-en checkpoint on those
Nepali lines. The benchmark is the English benchmark set reversed, so both
directions have the same sentences. Gold is never written into training.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
DATA = REPO / "training" / "data"
BENCH = REPO / "benchmarks" / "data"
OUT = DATA / "generated_bf16"
EN_1B = REPO / "training" / "artifacts" / "it2_en_indic_1b"
NE_DIST = REPO / "training" / "artifacts" / "it2_indic_en_merged"

TRAIN_FILES = [
    DATA / "meaning_bank.jsonl",
    DATA / "train_clean_en-ne.jsonl",
    DATA / "train_user_conversation_seeds.jsonl",
    DATA / "train_law_gov_en_ne.jsonl",
    DATA / "sheet50" / "train_en-ne.jsonl",
    DATA / "model_fill_suggestions" / "model_fill_suggestions.csv",
]
BENCH_FILES = [
    BENCH / "flores_plus_npi_eng_dev.jsonl",
    BENCH / "in22_conv_npi_sample.jsonl",
    BENCH / "bpcc_daily_npi_sample.jsonl",
    BENCH / "ne_quality_bench.json",
    BENCH / "flores_sample.json",
]


def clean_text(value: str) -> str:
    text = value.replace("\u00a0", " ")
    text = re.sub(r" +([.,])", r"\1", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def norm_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def load_blocklist() -> set[str]:
    path = BENCH / "gold_train_blocklist.json"
    if not path.exists():
        return set()
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {norm_key(item) for item in raw.get("sources", []) if isinstance(item, str)}


def english_from_obj(obj: dict) -> str:
    for key in ("english", "en", "eng_Latn"):
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            return clean_text(value)
    direction = str(obj.get("direction") or "")
    src = obj.get("src")
    if direction.startswith("en") and isinstance(src, str) and re.search(r"[A-Za-z]", src):
        return clean_text(src)
    if obj.get("src_lang") == "eng_Latn" and isinstance(src, str):
        return clean_text(src)
    return ""


def read_json_objects(path: Path) -> list[dict]:
    if path.suffix == ".jsonl":
        rows = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))
        return rows
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [row for row in raw if isinstance(row, dict)]
    if isinstance(raw, dict):
        found: list[dict] = []

        def walk(node: object) -> None:
            if isinstance(node, dict):
                if any(key in node for key in ("english", "en", "eng_Latn", "src")):
                    found.append(node)
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)

        walk(raw)
        return found
    return []


def read_csv_english(path: Path) -> list[str]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    out = []
    for row in rows:
        value = row.get("english") or row.get("input") or ""
        if value.strip():
            out.append(clean_text(value))
    return out


def collect(paths: list[Path]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for path in paths:
        if not path.exists():
            print(f"[synth] missing {path}", flush=True)
            continue
        values = read_csv_english(path) if path.suffix == ".csv" else [
            english_from_obj(row) for row in read_json_objects(path)
        ]
        added = 0
        for value in values:
            if not value:
                continue
            key = norm_key(value)
            if key in seen:
                continue
            seen.add(key)
            ordered.append(value)
            added += 1
        print(f"[synth] {path.name} unique_added={added} total={len(ordered)}", flush=True)
    return ordered


def translate(model_dir: Path, pairs: list[tuple[str, str, str]], batch_size: int) -> list[str]:
    import torch
    from IndicTransToolkit import IndicProcessor
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    print(f"[synth] load {model_dir.name} n={len(pairs)}", flush=True)
    ip = IndicProcessor(inference=True)
    tok = AutoTokenizer.from_pretrained(str(model_dir), trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        str(model_dir), trust_remote_code=True, torch_dtype=torch.bfloat16
    ).to("cuda").eval()
    outputs: list[str] = []
    for start in range(0, len(pairs), batch_size):
        chunk = pairs[start : start + batch_size]
        src_lang = chunk[0][1]
        tgt_lang = chunk[0][2]
        processed = ip.preprocess_batch([text for text, _, _ in chunk], src_lang=src_lang, tgt_lang=tgt_lang)
        inputs = tok(processed, return_tensors="pt", padding=True, truncation=True, max_length=160).to("cuda")
        with torch.no_grad():
            generated = model.generate(**inputs, max_new_tokens=128, num_beams=1, do_sample=False)
        decoded = tok.batch_decode(generated, skip_special_tokens=True, clean_up_tokenization_spaces=True)
        try:
            decoded = ip.postprocess_batch(decoded, lang=tgt_lang)
        except Exception:
            pass
        outputs.extend(clean_text(text) for text in decoded)
        done = min(start + batch_size, len(pairs))
        if done % 200 < batch_size or done == len(pairs):
            print(f"[synth] {model_dir.name} {done}/{len(pairs)}", flush=True)
    del model
    torch.cuda.empty_cache()
    return outputs


def main() -> int:
    import torch
    from training.build_meaning_bank import everyday_roman, to_informal

    if not torch.cuda.is_available():
        raise SystemExit("CUDA is required. Refusing a CPU fallback.")
    OUT.mkdir(parents=True, exist_ok=True)
    blocked = load_blocklist()
    train_en = [text for text in collect(TRAIN_FILES) if norm_key(text) not in blocked]
    bench_en = collect(BENCH_FILES)
    bench_keys = {norm_key(text) for text in bench_en}
    train_en = [text for text in train_en if norm_key(text) not in bench_keys]
    print(
        f"[synth] train_english={len(train_en)} bench_english={len(bench_en)} "
        f"gpu={torch.cuda.get_device_name(0)}",
        flush=True,
    )

    def run_direction(english: list[str], split: str) -> list[dict]:
        formal_in = [(f"<formal> {text}", "eng_Latn", "npi_Deva") for text in english]
        informal_in = [(f"<informal> {text}", "eng_Latn", "npi_Deva") for text in english]
        formal = translate(EN_1B, formal_in, 4)
        informal_model = translate(EN_1B, informal_in, 4)
        informal = []
        rewritten = 0
        for src, model_line, formal_line in zip(english, informal_model, formal):
            if norm_key(model_line) == norm_key(formal_line) or "तपाईं" in model_line or "तपाईँ" in model_line:
                informal.append(clean_text(to_informal(formal_line)))
                rewritten += 1
            else:
                informal.append(model_line)
        print(f"[synth] {split} informal_rewritten={rewritten}/{len(english)}", flush=True)
        ne_inputs = [(text, "npi_Deva", "eng_Latn") for text in formal + informal]
        back = translate(NE_DIST, ne_inputs, 8)
        back_formal = back[: len(english)]
        back_informal = back[len(english) :]
        rows = []
        for index, src in enumerate(english):
            ne_f = formal[index]
            ne_i = informal[index]
            wants_period = src.endswith(".")
            roman_f = everyday_roman(ne_f)
            roman_i = everyday_roman(ne_i)
            if wants_period:
                if roman_f and not roman_f.endswith("."):
                    roman_f += "."
                if roman_i and not roman_i.endswith("."):
                    roman_i += "."
            rows.append(
                {
                    "id": hashlib.sha1(norm_key(src).encode("utf-8")).hexdigest()[:16],
                    "split": split,
                    "english": src,
                    "ne_formal": ne_f,
                    "ne_informal": ne_i,
                    "roman_formal": clean_text(roman_f).replace("|", ""),
                    "roman_informal": clean_text(roman_i).replace("|", ""),
                    "en_from_formal": back_formal[index],
                    "en_from_informal": back_informal[index],
                }
            )
        return rows

    train_rows = run_direction(train_en, "train")
    bench_rows = run_direction(bench_en, "benchmark")

    def dump(path: Path, rows: list[dict]) -> None:
        path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")
        print(f"[synth] wrote {path} n={len(rows)}", flush=True)

    dump(OUT / "train_wide.jsonl", train_rows)
    dump(OUT / "benchmark_wide.jsonl", bench_rows)
    train_en_ne = []
    train_ne_en = []
    for row in train_rows:
        train_en_ne.append({"src": f"<formal> {row['english']}", "tgt": row["ne_formal"], "register": "formal", "id": row["id"]})
        train_en_ne.append({"src": f"<informal> {row['english']}", "tgt": row["ne_informal"], "register": "informal", "id": row["id"]})
        train_ne_en.append({"src": row["ne_formal"], "tgt": row["english"], "register": "formal", "id": row["id"]})
        train_ne_en.append({"src": row["ne_informal"], "tgt": row["english"], "register": "informal", "id": row["id"]})
    bench_en_ne = []
    bench_ne_en = []
    for row in bench_rows:
        bench_en_ne.append({"src": row["english"], "tgt": row["ne_formal"], "register": "formal", "id": row["id"]})
        bench_en_ne.append({"src": row["english"], "tgt": row["ne_informal"], "register": "informal", "id": row["id"]})
        bench_ne_en.append({"src": row["ne_formal"], "tgt": row["english"], "register": "formal", "id": row["id"]})
        bench_ne_en.append({"src": row["ne_informal"], "tgt": row["english"], "register": "informal", "id": row["id"]})
    dump(OUT / "train_en_ne.jsonl", train_en_ne)
    dump(OUT / "train_ne_en.jsonl", train_ne_en)
    dump(OUT / "benchmark_en_ne.jsonl", bench_en_ne)
    dump(OUT / "benchmark_ne_en.jsonl", bench_ne_en)
    empty = 0
    for row in train_rows + bench_rows:
        for key in ("ne_formal", "ne_informal", "roman_formal", "roman_informal"):
            if not str(row.get(key) or "").strip():
                empty += 1
    print(
        f"[synth] DONE train_en_ne={len(train_en_ne)} train_ne_en={len(train_ne_en)} "
        f"bench_en_ne={len(bench_en_ne)} bench_ne_en={len(bench_ne_en)} empty_cells={empty}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
