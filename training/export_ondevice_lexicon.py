#!/usr/bin/env python3
"""Thin wrapper — the Node exporter is what EAS runs."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SCRIPT = (
    Path(__file__).resolve().parents[1]
    / "mobile"
    / "scripts"
    / "export_meaning_lexicon.mjs"
)
raise SystemExit(subprocess.call(["node", str(SCRIPT)], cwd=str(SCRIPT.parents[1])))
