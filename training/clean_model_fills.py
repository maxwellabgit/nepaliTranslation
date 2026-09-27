#!/usr/bin/env python3
"""Clean base-model Devanagari and add informal plus roman suggestions.

Does not edit the source sheet, the meaning bank, or benchmarks/gold.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "training" / "data" / "model_fill_suggestions"
DEVA = re.compile(r"[\u0900-\u097F]")
LATIN = re.compile(r"[A-Za-z]")
REWRITES = sorted(
    [
        ("तपाईंहरू", "तिमीहरू"),
        ("तपाईँहरू", "तिमीहरू"),
        ("तपाईंलाई", "तिमीलाई"),
        ("तपाईँलाई", "तिमीलाई"),
        ("तपाईंको", "तिमीको"),
        ("तपाईँको", "तिमीको"),
        ("तपाईंले", "तिमीले"),
        ("तपाईँले", "तिमीले"),
        ("तपाईं", "तिमी"),
        ("तपाईँ", "तिमी"),
        ("सक्नुहुन्छ", "सक्छौ"),
        ("बोल्नुहुन्छ", "बोल्छौ"),
        ("भन्नुहुन्छ", "भन्छौ"),
        ("हुनुहुन्छ", "छौ"),
        ("सुन्नुभयो", "सुन्यौ"),
        ("बोलाउनुहोस्", "बोलाऊ"),
        ("गर्नुहोस्", "गर"),
        ("दिनुहोस्", "देऊ"),
        ("भन्नुहोस्", "भन"),
        ("बोल्नुहोस्", "बोल"),
        ("आउनुहोस्", "आऊ"),
        ("जानुहोस्", "जाऊ"),
        ("रोक्नुहोस्", "रोक"),
        ("पर्खनुहोस्", "पर्ख"),
    ],
    key=lambda pair: len(pair[0]),
    reverse=True,
)


def informal(text: str) -> str:
    out = text
    for source, target in REWRITES:
        out = out.replace(source, target)
    return out


def clean_deva(text: str) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if not text or not DEVA.search(text) or LATIN.search(text) or "तँ" in text:
        return ""
    return text


# Same tables as mobile/src/mt/romanize.ts devanagariToRoman.
CONSONANTS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng", "च": "ch", "छ": "chh",
    "ज": "j", "झ": "jh", "ञ": "ny", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh",
    "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n", "प": "p",
    "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l",
    "व": "w", "श": "sh", "ष": "sh", "स": "s", "ह": "h", "क्ष": "ksh", "त्र": "tr",
    "ज्ञ": "gy",
}
INDEPENDENT = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu", "ए": "e",
    "ऐ": "ai", "ओ": "o", "औ": "au", "अं": "am", "अः": "ah", "ऋ": "ri",
}
MATRAS = {
    "ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "े": "e", "ै": "ai",
    "ो": "o", "ौ": "au", "ृ": "ri", "ं": "n", "ः": "h", "ँ": "n",
}
VIRAMA = "्"
PHRASE_ROMAN = {
    "नमस्ते": "namaste", "धन्यवाद": "dhanyabad", "कृपया": "kripya", "हो": "ho",
    "होइन": "hoina", "ठिक छ": "thik cha", "माफ गर्नुहोस्": "maaf garnuhos",
    "माफ गर": "maaf gara", "मद्दत": "madat", "तपाईंलाई कस्तो छ": "tapai lai kasto cha",
    "तिमीलाई कस्तो छ": "timi lai kasto cha", "म ठिक छु": "ma thik chu",
    "शुभ प्रभात": "shubha prabhat", "शुभ रात्री": "shubha ratri", "स्वागत": "swagat",
    "स्वागत छ": "swagat cha", "बिदा": "bida",
}


def devanagari_to_roman(text: str) -> str:
    trimmed = text.strip()
    if not trimmed:
        return ""
    if trimmed in PHRASE_ROMAN:
        return PHRASE_ROMAN[trimmed]
    bare = re.sub(r"[?.!,;:।]+$", "", trimmed)
    punct = trimmed[len(bare) :].replace("।", ".")
    if bare in PHRASE_ROMAN:
        return PHRASE_ROMAN[bare] + punct
    out = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "।":
            out.append(".")
            i += 1
            continue
        if ch == "़":
            i += 1
            continue
        if ch == "ऱ":
            out.append("r")
            i += 1
            continue
        if ch == "ॉ":
            out.append("o")
            i += 1
            continue
        if ch.isspace() or re.match(r"[?.!,;:0-9A-Za-z]", ch):
            out.append(ch)
            i += 1
            continue
        if ch in INDEPENDENT:
            out.append(INDEPENDENT[ch])
            i += 1
            continue
        cons = CONSONANTS.get(ch)
        if cons:
            vowel = "a"
            j = i + 1
            if j < len(text) and text[j] == VIRAMA:
                vowel = ""
                j += 1
            elif j < len(text) and text[j] in MATRAS:
                vowel = MATRAS[text[j]]
                j += 1
            if j < len(text) and text[j] in ("ं", "ँ"):
                vowel += "n"
                j += 1
            out.append(cons + vowel)
            i = j
            continue
        if ch in MATRAS:
            out.append(MATRAS[ch])
            i += 1
            continue
        if ch == VIRAMA:
            i += 1
            continue
        out.append(ch)
        i += 1
    return re.sub(r"\s+", " ", "".join(out)).strip()


def main() -> int:
    source = OUT / "en_formal_deva.jsonl"
    cleaned = []
    kept = dropped = 0
    for line in source.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        deva = clean_deva(item.get("devanagari") or "")
        if deva:
            kept += 1
        else:
            dropped += 1
        cleaned.append(
            {
                "english": item["english"],
                "devanagari": deva,
                "devanagari_informal": informal(deva) if deva else "",
            }
        )
    print(f"[clean] kept={kept} dropped={dropped}", flush=True)
    out = OUT / "suggestions.jsonl"
    identical = 0
    with out.open("w", encoding="utf-8") as handle:
        for row in cleaned:
            row["roman"] = devanagari_to_roman(row["devanagari"]) if row["devanagari"] else ""
            row["roman_informal"] = (
                devanagari_to_roman(row["devanagari_informal"]) if row["devanagari_informal"] else ""
            )
            if row["devanagari"] and row["devanagari"] == row["devanagari_informal"]:
                identical += 1
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"[clean] identical_formal_informal={identical} wrote {out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
