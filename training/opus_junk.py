"""Guard so old OPUS / Global Voices rebuild scripts cannot silently come back."""

from __future__ import annotations

import sys

REFUSE_MSG = """Refused: this script rebuilds OPUS-100 / Global Voices training junk.

Use the CPU job instead:
  python training/prepare_cpu_mix.py
  python training/finetune_it2_cpu.py

See training/CPU_FT_JOB.md.

Pass --force-opus-junk only if you need the old files locally (they are gitignored).
"""


def refuse_unless_forced(argv: list[str] | None = None) -> None:
    argv = sys.argv[1:] if argv is None else argv
    if "--help" in argv or "-h" in argv:
        return
    if "--force-opus-junk" in argv:
        return
    raise SystemExit(REFUSE_MSG)
