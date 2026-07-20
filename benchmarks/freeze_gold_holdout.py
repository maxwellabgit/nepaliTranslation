#!/usr/bin/env python3
"""
Freeze gold checksums + extend train blocklist to include gold sources/refs.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GOLD = ROOT / "gold"
OUT = ROOT / "results" / "gold_freeze.json"
CLASSES = ["en_ne_formal", "en_ne_informal", "ne_en_deva", "ne_en_roman"]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def main() -> None:
    freeze = {
        "frozen_at": datetime.now(timezone.utc).isoformat(),
        "classes": {},
        "blocklist_norm_sources": [],
        "blocklist_norm_refs": [],
    }
    src_block: set[str] = set()
    ref_block: set[str] = set()
    for cls in CLASSES:
        d = GOLD / cls
        files = {
            "sources": sha256_file(d / "sources.jsonl"),
            "references": sha256_file(d / "references.jsonl"),
            "manifest": sha256_file(d / "manifest.json"),
        }
        sources = [json.loads(l) for l in (d / "sources.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        refs = [json.loads(l) for l in (d / "references.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        for s in sources:
            t = " ".join((s.get("source") or "").lower().split())
            if t:
                src_block.add(t)
        for r in refs:
            t = " ".join((r.get("reference") or "").lower().split())
            if t:
                ref_block.add(t)
        freeze["classes"][cls] = {
            "n": len(sources),
            "n_premium": sum(1 for s in sources if s.get("tier") == "premium_word_choice"),
            "sha256": files,
        }
    freeze["blocklist_norm_sources"] = sorted(src_block)
    freeze["blocklist_norm_refs"] = sorted(ref_block)
    # compact blocklist file for train prep
    bl = {
        "sources": freeze["blocklist_norm_sources"],
        "references": freeze["blocklist_norm_refs"],
        "frozen_at": freeze["frozen_at"],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(freeze, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "data" / "gold_train_blocklist.json").write_text(
        json.dumps(bl, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({k: freeze[k] for k in ("frozen_at", "classes")}, indent=2))
    print("blocklist sources", len(src_block), "refs", len(ref_block))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
