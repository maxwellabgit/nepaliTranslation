"""Shared gold-holdout helpers: freeze checksums, blocklist strings, class IO."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
GOLD = ROOT / "gold"
FREEZE_PATH = ROOT / "results" / "gold_freeze.json"
BLOCKLIST_PATH = ROOT / "data" / "gold_train_blocklist.json"
SCHEMA_PATH = GOLD / "schema.json"

CLASSES = ["en_ne_formal", "en_ne_informal", "ne_en_deva", "ne_en_roman"]
CLASS_FILES = ("sources.jsonl", "references.jsonl", "manifest.json")

# 2026-07-25 commit 81cdbb4 added these six rows after the 2026-07-20 freeze.
POST_FREEZE_IDS = {
    "en_ne_formal": ["en_ne_formal-136", "en_ne_formal-137"],
    "en_ne_informal": ["en_ne_informal-138", "en_ne_informal-139"],
    "ne_en_deva": ["ne_en_deva-133"],
    "ne_en_roman": ["ne_en_roman-134"],
}

IT2_WEIGHT_HINTS = [
    REPO / "training" / "artifacts" / "it2_en_indic_merged",
    REPO / "training" / "artifacts" / "it2_indic_en_merged",
    REPO / "training" / "artifacts" / "it2_cpu_en_ne_lora",
    REPO / "training" / "artifacts" / "it2_cpu_ne_en_lora",
]


def freeze_norm(s: str) -> str:
    return " ".join((s or "").lower().split())


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def load_class(cls: str) -> dict:
    d = GOLD / cls
    sources = load_jsonl(d / "sources.jsonl")
    references = load_jsonl(d / "references.jsonl")
    manifest = json.loads((d / "manifest.json").read_text(encoding="utf-8")) if (d / "manifest.json").exists() else {}
    return {
        "class": cls,
        "dir": d,
        "sources": sources,
        "references": references,
        "manifest": manifest,
        "sha256": {name.replace(".jsonl", "").replace(".json", ""): sha256_file(d / name) for name in CLASS_FILES},
    }


def iter_gold_text_fields(row: dict):
    for key in ("source", "reference", "deva"):
        val = row.get(key)
        if val:
            yield key, str(val)


def live_block_strings() -> tuple[set[str], set[str]]:
    """Normalized source-side and reference-side strings from live gold files."""
    src_block: set[str] = set()
    ref_block: set[str] = set()
    for cls in CLASSES:
        packed = load_class(cls)
        for row in packed["sources"]:
            for key, val in iter_gold_text_fields(row):
                t = freeze_norm(val)
                if t:
                    src_block.add(t)
        for row in packed["references"]:
            for key, val in iter_gold_text_fields(row):
                t = freeze_norm(val)
                if t:
                    (ref_block if key == "reference" else src_block).add(t)
    return src_block, ref_block


def write_freeze(frozen_at: str | None = None) -> dict:
    """Rewrite gold_freeze.json + gold_train_blocklist.json from live files."""
    src_block, ref_block = live_block_strings()
    freeze = {
        "frozen_at": frozen_at or datetime.now(timezone.utc).isoformat(),
        "classes": {},
        "blocklist_norm_sources": sorted(src_block),
        "blocklist_norm_refs": sorted(ref_block),
    }
    for cls in CLASSES:
        packed = load_class(cls)
        freeze["classes"][cls] = {
            "n": len(packed["sources"]),
            "n_premium": sum(1 for s in packed["sources"] if s.get("tier") == "premium_word_choice"),
            "sha256": packed["sha256"],
        }
    FREEZE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FREEZE_PATH.write_text(json.dumps(freeze, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    BLOCKLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
    BLOCKLIST_PATH.write_text(
        json.dumps(
            {
                "sources": freeze["blocklist_norm_sources"],
                "references": freeze["blocklist_norm_refs"],
                "frozen_at": freeze["frozen_at"],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return freeze


def it2_weights_present() -> list[str]:
    found = []
    for path in IT2_WEIGHT_HINTS:
        if path.exists() and (
            (path.is_dir() and any(path.iterdir()))
            or (path.is_file() and path.stat().st_size > 0)
        ):
            # merged dirs are gitignored; a present non-empty dir counts
            if path.is_dir() and not any(p.name != ".gitkeep" for p in path.iterdir()):
                continue
            found.append(str(path.relative_to(REPO)))
    return found
