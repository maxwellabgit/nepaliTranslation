"""Sentence-level splitting for IndicTrans2 fine-tune prep and parity with the app.

IndicTrans2 dist-200M:
  max_source_positions = 256
  max_target_positions = 256
Fine-tune default --max-length = 96 (truncate). Prefer one natural sentence per example.
"""
from __future__ import annotations

import re
from typing import Iterable

_END = re.compile(r"([.?!…।]+)(?:\s+|$)")
_SOFT_MAX = 140
_HARD_MAX = 220

IT2_WINDOW = {
    "max_source_positions": 256,
    "max_target_positions": 256,
    "fine_tune_max_length": 96,
    "soft_char_max": _SOFT_MAX,
    "hard_char_max": _HARD_MAX,
}


def split_sentences(text: str) -> tuple[list[str], str]:
    """Return (complete_sentences, remainder)."""
    raw = re.sub(r"\s+", " ", (text or "").strip())
    if not raw:
        return [], ""

    complete: list[str] = []
    buf = ""
    i = 0
    while i < len(raw):
        slice_ = raw[i:]
        m = _END.search(slice_)
        if m:
            buf += slice_[: m.end(1)]
            sent = buf.strip()
            if sent:
                complete.append(sent)
            buf = ""
            i += m.end()
            continue
        buf += slice_
        break

    remainder = buf.strip()
    while len(remainder) > _HARD_MAX:
        window = remainder[:_SOFT_MAX]
        cut = max(window.rfind(" "), window.rfind(","))
        if cut < 40:
            cut = _SOFT_MAX
        complete.append(remainder[:cut].strip())
        remainder = remainder[cut:].strip()
    return complete, remainder


def is_multi_sentence(text: str) -> bool:
    complete, remainder = split_sentences(text)
    if len(complete) >= 2:
        return True
    if len(complete) == 1 and len(remainder.strip()) > 12:
        return True
    return bool(re.search(r"[.?!…।].+\S", (text or "").strip()))


def expand_pair_to_sentences(en: str, ne: str) -> list[tuple[str, str]]:
    """
    Prefer 1:1 sentence alignment when counts match.
    If counts differ, keep the whole pair as one example (safer than misaligned splits).
    """
    en_s, en_rem = split_sentences(en)
    ne_s, ne_rem = split_sentences(ne)
    if en_rem:
        en_s = [*en_s, en_rem] if en_rem else en_s
    if ne_rem:
        ne_s = [*ne_s, ne_rem] if ne_rem else ne_s
    # Drop empties
    en_s = [s for s in en_s if s.strip()]
    ne_s = [s for s in ne_s if s.strip()]
    if not en_s or not ne_s:
        return []
    if len(en_s) == len(ne_s) and len(en_s) > 1:
        return list(zip(en_s, ne_s))
    return [(en.strip(), ne.strip())]


def iter_sentence_pairs(rows: Iterable[dict], en_key: str = "eng_Latn", ne_key: str = "npi_Deva"):
    for r in rows:
        en, ne = r.get(en_key, ""), r.get(ne_key, "")
        for e, n in expand_pair_to_sentences(str(en), str(ne)):
            out = dict(r)
            out[en_key] = e
            out[ne_key] = n
            out["sentence_split"] = True
            yield out
