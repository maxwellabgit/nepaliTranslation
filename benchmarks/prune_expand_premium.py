#!/usr/bin/env python3
"""
Adversarial prune (worst ~2–5% of premium) + expand premium gold (fleet 2).

Kill list + rewrites come from Composer adversarial critic.
New pairs are hand-authored (not copied from gated corpora).
"""
from __future__ import annotations

import json
from pathlib import Path

from expand_gold_premium import (
    append_en_ne,
    append_ne_en,
    append_roman,
    load_jsonl,
    write_jsonl,
)

GOLD = Path(__file__).resolve().parent / "gold"

# Exact source strings to remove (works across re-id). Prefer premium-tier rot.
# Final kill list = ~4.5% of the 88-item premium set (within 2–5%).
KILL_BY_SOURCE: dict[str, set[str]] = {
    "ne_en_deva": {
        "के तपाईं कार्ड चल्नुहुन्छ?",
        "मलाई चिसो लाग्यो।",  # dual-sense; replaced by split pairs below
    },
    "ne_en_roman": {
        "malai chiso lagyo",  # dual-sense companion
    },
    "en_ne_formal": {
        "I lost my way.",  # premium dup; base + informal cover the idiom
    },
}

# Rewrites: match by English or Nepali source → new reference (+ optional note)
REWRITE_EN_NE: dict[str, dict[str, tuple[str, str]]] = {
    "en_ne_formal": {
        "What would you like to eat?": (
            "तपाईं के खान चाहनुहुन्छ?",
            "volition not habitual खानुहुन्छ",
        ),
        "I am looking for a room with a view.": (
            "म राम्रो भ्यू भएको कोठा खोज्दै छु।",
            "hotel Nepali भ्यू not calque दृश्य भएको alone",
        ),
    },
    "en_ne_informal": {
        "What would you like to eat?": (
            "तिमी के खान चाहन्छौ?",
            "volition informal",
        ),
        "I am looking for a room with a view.": (
            "म राम्रो भ्यू भएको कोठा खोज्दै छु।",
            "hotel Nepali भ्यू",
        ),
    },
}

REWRITE_NE_EN: dict[str, dict[str, tuple[str, str]]] = {
    "ne_en_deva": {
        "के तपाईं नेपाली बुझ्नुहुन्छ?": (
            "Do you understand Nepali?",
            "keep; question particle required",
        ),
    },
}

REWRITE_ROMAN: dict[str, tuple[str, str, str]] = {
    # old roman -> (new_roman, new_en_optional_or_same, note)
    "tapai nepali bujhnuhunchha?": (
        "ke tapai nepali bujhnuhunchha?",
        "Do you understand Nepali?",
        "keep के in chat roman",
    ),
}

# Split replacements for killed dual-sense cold
SPLIT_CHISO_NE_EN = [
    ("मलाई चिसो महसुस भइरहेको छ।", "I feel cold.", "temperature sense only"),
    ("मलाई रुघा लागेको छ।", "I have a cold.", "illness sense only"),
]
SPLIT_CHISO_ROMAN = [
    ("malai chiso mahasus bhairaheko cha", "मलाई चिसो महसुस भइरहेको छ।", "I feel cold.", "temp roman"),
    ("malai rugha lageko cha", "मलाई रुघा लागेको छ।", "I have a cold.", "illness roman"),
]

# Fleet-2 additions (adversarial-filtered)
PREMIUM2_EN_NE_FORMAL: list[tuple[str, str, str]] = [
    (
        "Could you tell me where the nearest health center is?",
        "के तपाईं मलाई नजिकैको स्वास्थ्य केन्द्र कहाँ छ भनेर भन्न सक्नुहुन्छ?",
        "clinic directions + honorific request",
    ),
    (
        "Do you know if there is an ATM nearby?",
        "के तपाईंलाई थाहा छ, नजिकै कुनै एटीएम छ?",
        "ATM lookup",
    ),
    (
        "Can you tell me how to get to the old city from here?",
        "के तपाईं मलाई यहाँबाट पुरानो शहर जाने बाटो बताउन सक्नुहुन्छ?",
        "travel directions",
    ),
    (
        "I have landed safely; I will call you soon.",
        "म सुरक्षित ओर्लिएँ, चाँडै तपाईंलाई फोन गर्नेछु।",
        "family call to elder",
    ),
    (
        "Could we see the menu, please?",
        "कृपया हामीलाई मेनु देखाउन सक्नुहुन्छ?",
        "hotel dining request",
    ),
    (
        "I have been coughing for three days.",
        "म तीन दिनदेखि खोकी लागिरहेको छु।",
        "clinic symptom report",
    ),
    (
        "I tried to withdraw money but the transaction failed.",
        "मैले पैसा झिक्न खोजें, तर कारोबार असफल भयो।",
        "ATM failure",
    ),
    (
        "Which stop should I get off at for the museum?",
        "संग्रहालय जान कुन बिसौनीमा ओर्लिनुपर्छ?",
        "transit directions",
    ),
    (
        "Please let Grandma know I am doing well.",
        "कृपया हजुरआमालाई म ठिकै छु भनेर भन्नुहोस्।",
        "family relay — not म ठिक छु as fine reply calque",
    ),
    (
        "Is lunch included in the room rate?",
        "के कोठाको भाडामा दिउँसोको खाना समावेश छ?",
        "hotel meal plan",
    ),
    (
        "Where is the nearest pharmacy?",
        "नजिकको औषधि पसल कहाँ छ?",
        "pharmacy location distinct from I need a pharmacy",
    ),
    (
        "That was delicious.",
        "मिठो थियो।",
        "past dining feedback",
    ),
]

PREMIUM2_EN_NE_INFORMAL: list[tuple[str, str, str]] = [
    (
        "Could you tell me where the nearest health center is?",
        "के तिमी मलाई नजिकैको स्वास्थ्य केन्द्र कहाँ छ भनेर भन्न सक्छौ?",
        "clinic directions informal",
    ),
    (
        "Do you know if there is an ATM nearby?",
        "के तिमीलाई थाहा छ, नजिकै कुनै एटीएम छ?",
        "ATM lookup informal",
    ),
    (
        "Can you tell me how to get to the old city from here?",
        "के तिमी मलाई यहाँबाट पुरानो शहर जाने बाटो बताउन सक्छौ?",
        "travel directions informal",
    ),
    (
        "I have landed safely; I will call you soon.",
        "म सुरक्षित ओर्लिएँ, चाँडै तिमीलाई फोन गर्छु।",
        "family call peer",
    ),
    (
        "Could we see the menu, please?",
        "कृपया हामीलाई मेनु देखाउन सक्छौ?",
        "hotel dining informal",
    ),
    (
        "I have been coughing for three days.",
        "म तीन दिनदेखि खोकी लागिरहेको छु।",
        "clinic symptom neutral",
    ),
    (
        "I tried to withdraw money but the transaction failed.",
        "मैले पैसा झिक्न खोजें, तर कारोबार असफल भयो।",
        "ATM failure neutral",
    ),
    (
        "Which stop should I get off at for the museum?",
        "संग्रहालय जान कुन बिसौनीमा ओर्लिनुपर्छ?",
        "transit directions neutral",
    ),
    (
        "Please let Grandma know I am doing well.",
        "कृपया हजुरआमालाई म ठिकै छु भनेर भनिदेऊ।",
        "family relay informal",
    ),
    (
        "Is lunch included in the room rate?",
        "के कोठाको भाडामा दिउँसोको खाना समावेश छ?",
        "hotel meal plan neutral",
    ),
    (
        "Where is the nearest pharmacy?",
        "नजिकको औषधि पसल कहाँ छ?",
        "pharmacy location",
    ),
    (
        "That was delicious.",
        "मिठो थियो।",
        "past dining feedback",
    ),
    (
        "Don't leave me.",
        "मलाई नछोड।",
        "informal imperative emotional",
    ),
]

PREMIUM2_NE_EN: list[tuple[str, str, str]] = [
    ("मलाई रगतको जाँच गर्नुपर्छ।", "I need a blood test.", "clinic lab work"),
    ("यो कार्डले यहाँ काम गर्छ?", "Does this card work here?", "payment not चल्नु calque"),
    ("हामी होटलमा पुग्यौं।", "We have reached the hotel.", "travel arrival"),
    ("मलाई नुनिलो खाना मन पर्दैन।", "I do not like salty food.", "dining preference"),
    ("कृपया धेरै तेल नहाल्नुहोस्।", "Please do not use too much oil.", "dining instruction"),
    ("म बुबालाई सम्झिरहेको छु।", "I am thinking of Dad.", "family phone call"),
    ("नेपालमा पहिलो पटक आएको हुँ।", "This is my first time in Nepal.", "tourist context"),
    ("मेरो पासपोर्ट होटलमा छ।", "My passport is at the hotel.", "travel documents"),
    ("हाम्रो उडान ढिला भयो।", "Our flight is delayed.", "airport family update"),
    ("के तपाईं अङ्ग्रेजी बोल्नुहुन्छ?", "Do you speak English?", "staff query"),
    ("बिरामी कक्ष कुन तर्फ हो?", "Which way to the ward?", "hospital direction"),
    ("पैसा सकियो।", "I'm out of cash.", "colloquial money"),
]

PREMIUM2_ROMAN: list[tuple[str, str, str, str]] = [
    ("malai ragatko janch garnuparcha", "मलाई रगतको जाँच गर्नुपर्छ।", "I need a blood test.", "chat roman clinic"),
    ("yo card le yaha kaam garcha?", "यो कार्डले यहाँ काम गर्छ?", "Does this card work here?", "payment roman"),
    ("hami hotel ma pugyau", "हामी होटलमा पुग्यौं।", "We have reached the hotel.", "arrival text"),
    ("malai nunilo khana man pardaina", "मलाई नुनिलो खाना मन पर्दैन।", "I do not like salty food.", "dining preference"),
    ("kripya dherai tel nahalnuhos", "कृपया धेरै तेल नहाल्नुहोस्।", "Please do not use too much oil.", "waiter request"),
    ("ma baba lai samjiraheko chu", "म बुबालाई सम्झिरहेको छु।", "I am thinking of Dad.", "family chat"),
    ("nepal ma pahilo patak aayeko hu", "नेपालमा पहिलो पटक आएको हुँ।", "This is my first time in Nepal.", "tourist intro"),
    ("mero passport hotel ma cha", "मेरो पासपोर्ट होटलमा छ।", "My passport is at the hotel.", "travel roman"),
    ("hamro udan dhila bhayo", "हाम्रो उडान ढिला भयो।", "Our flight is delayed.", "family update"),
    ("ke tapai angreji bolnuhunchha?", "के तपाईं अङ्ग्रेजी बोल्नुहुन्छ?", "Do you speak English?", "staff query"),
    ("birami kakshya kun tarfa ho?", "बिरामी कक्ष कुन तर्फ हो?", "Which way to the ward?", "hospital"),
    ("paisa sakiyo", "पैसा सकियो।", "I'm out of cash.", "colloquial money roman"),
]


def _norm(s: str) -> str:
    return s.strip()


def rewrite_class(cls: str) -> int:
    d = GOLD / cls
    sources = load_jsonl(d / "sources.jsonl")
    refs = load_jsonl(d / "references.jsonl")
    by_id = {r["id"]: r for r in refs}
    n = 0
    if cls in REWRITE_EN_NE:
        for s in sources:
            key = _norm(s.get("source", ""))
            if key in REWRITE_EN_NE[cls]:
                ne, note = REWRITE_EN_NE[cls][key]
                r = by_id[s["id"]]
                if r.get("reference") != ne:
                    r["reference"] = ne
                    r["note"] = note
                    r["tier"] = s.get("tier", r.get("tier", "premium_word_choice"))
                    n += 1
    if cls in REWRITE_NE_EN:
        for s in sources:
            key = _norm(s.get("source", ""))
            if key in REWRITE_NE_EN[cls]:
                en, note = REWRITE_NE_EN[cls][key]
                r = by_id[s["id"]]
                if r.get("reference") != en:
                    r["reference"] = en
                    r["note"] = note
                    n += 1
    if cls == "ne_en_roman":
        for s in sources:
            key = _norm(s.get("source", "")).lower()
            if key in REWRITE_ROMAN:
                new_roman, new_en, note = REWRITE_ROMAN[key]
                s["source"] = new_roman
                s["note"] = note
                r = by_id[s["id"]]
                r["reference"] = new_en
                r["note"] = note
                n += 1
    write_jsonl(d / "sources.jsonl", sources)
    write_jsonl(d / "references.jsonl", [by_id[s["id"]] for s in sources])
    return n


def prune_class(cls: str) -> tuple[int, int]:
    """Remove kill sources. Returns (removed_total, removed_premium)."""
    d = GOLD / cls
    sources = load_jsonl(d / "sources.jsonl")
    refs = load_jsonl(d / "references.jsonl")
    kill = {_norm(x) for x in KILL_BY_SOURCE.get(cls, set())}
    kill_l = {x.lower() for x in kill}
    keep_s, keep_r = [], []
    removed = removed_prem = 0
    ref_by_id = {r["id"]: r for r in refs}
    for s in sources:
        src = _norm(s.get("source", ""))
        hit = src in kill or src.lower() in kill_l
        if hit:
            removed += 1
            if s.get("tier") == "premium_word_choice":
                removed_prem += 1
            continue
        keep_s.append(s)
        keep_r.append(ref_by_id[s["id"]])
    # re-id
    sources2, refs2, items = [], [], []
    for i, (s, r) in enumerate(zip(keep_s, keep_r), start=1):
        sid = f"{cls}-{i:03d}"
        s = {**s, "id": sid}
        r = {**r, "id": sid}
        sources2.append(s)
        refs2.append(r)
        items.append({"id": sid, "status": s.get("status", "reviewed")})
    write_jsonl(d / "sources.jsonl", sources2)
    write_jsonl(d / "references.jsonl", refs2)
    (d / "manifest.json").write_text(
        json.dumps(
            {
                "class": cls,
                "n_target": len(sources2),
                "n_filled": len(sources2),
                "n_premium": sum(
                    1 for s in sources2 if s.get("tier") == "premium_word_choice"
                ),
                "items": items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return removed, removed_prem


def premium_count() -> int:
    n = 0
    for cls in ("en_ne_formal", "en_ne_informal", "ne_en_deva", "ne_en_roman"):
        for s in load_jsonl(GOLD / cls / "sources.jsonl"):
            if s.get("tier") == "premium_word_choice":
                n += 1
    return n


def main() -> None:
    before = premium_count()
    print(f"premium before: {before}")

    rewrites = 0
    for cls in ("en_ne_formal", "en_ne_informal", "ne_en_deva", "ne_en_roman"):
        rewrites += rewrite_class(cls)
    print(f"rewrites applied: {rewrites}")

    removed_total = removed_prem = 0
    for cls in ("en_ne_formal", "en_ne_informal", "ne_en_deva", "ne_en_roman"):
        rt, rp = prune_class(cls)
        removed_total += rt
        removed_prem += rp
        print(f"prune {cls}: removed {rt} (premium {rp})")

    mid = premium_count()
    prune_pct = (100.0 * removed_prem / before) if before else 0.0
    print(f"premium after prune: {mid} (removed {removed_prem} = {prune_pct:.1f}% of premium)")

    # split replacements + fleet 2
    append_ne_en("ne_en_deva", SPLIT_CHISO_NE_EN)
    append_roman(SPLIT_CHISO_ROMAN)
    n = 0
    n += append_en_ne("en_ne_formal", PREMIUM2_EN_NE_FORMAL)
    n += append_en_ne("en_ne_informal", PREMIUM2_EN_NE_INFORMAL)
    n += append_ne_en("ne_en_deva", PREMIUM2_NE_EN)
    n += append_roman(PREMIUM2_ROMAN)
    after = premium_count()
    print(f"fleet2 unique adds ~{n}; premium after expand: {after}")

    report = {
        "premium_before": before,
        "premium_killed": removed_prem,
        "premium_kill_pct": round(prune_pct, 2),
        "rewrites": rewrites,
        "rows_removed_total": removed_total,
        "premium_after": after,
        "kill_sources": {k: sorted(v) for k, v in KILL_BY_SOURCE.items()},
    }
    path = Path(__file__).resolve().parent / "results" / "premium_prune_expand.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", path)


if __name__ == "__main__":
    main()
