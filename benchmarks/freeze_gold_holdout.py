#!/usr/bin/env python3
"""
Freeze gold checksums + extend train blocklist to include gold sources/refs/deva.

Prefer the guarded path:

    python benchmarks/check_gold_integrity.py --update-freeze

That refuses to freeze if inventory, register, or train-leak checks fail.
This script is the low-level writer only.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from gold_holdout import write_freeze  # noqa: E402


def main() -> None:
    freeze = write_freeze()
    print(json.dumps({"frozen_at": freeze["frozen_at"], "classes": freeze["classes"]}, indent=2))
    print(
        "blocklist sources",
        len(freeze["blocklist_norm_sources"]),
        "refs",
        len(freeze["blocklist_norm_refs"]),
    )
    print("wrote", ROOT / "results" / "gold_freeze.json")


if __name__ == "__main__":
    main()
