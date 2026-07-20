#!/usr/bin/env python3
"""
Expand benchmarks/gold with a PREMIUM word-choice / honorific slice.

These pairs target ambiguous English, register-sensitive Nepali, and
culture-specific lexical choice — the failure modes MT systems get wrong.
Sources are hand-authored for NepTranslate (work-for-hire style), not
copied from gated corpora. Cross-checked against IN22/FLORES domain patterns
from research (travel, health, daily, banking) without importing those texts.
"""
from __future__ import annotations

import json
from pathlib import Path

GOLD = Path(__file__).resolve().parent / "gold"

# Premium EN→NE formal: word choice + तपाईं agreement
PREMIUM_EN_NE_FORMAL: list[tuple[str, str, str]] = [
    # (en, ne_formal, note)
    ("Could you please look at this document?", "के तपाईंले यो कागजात हेर्नुहुन्छ?", "request+honorific verb"),
    ("What would you like to eat?", "तपाईं के खानुहुन्छ?", "want→खानुहुन्छ not चाहनुहुन्छ alone"),
    ("I will pick you up at the airport.", "म तपाईंलाई विमानस्थलमा लिन आउँछु।", "pick up→लिन आउनु"),
    ("Please make yourself comfortable.", "कृपया आराम गर्नुहोस्।", "idiom"),
    ("How long have you been waiting?", "तपाईं कति बेरदेखि पर्खिरहनुभएको छ?", "progressive honorific"),
    ("Do you have any allergies?", "तपाईंलाई कुनै एलर्जी छ?", "have allergy→लाई ... छ"),
    ("The doctor will see you shortly.", "डाक्टरले चाँडै तपाईंलाई भेट्नुहुन्छ।", "see patient"),
    ("Please take a seat.", "कृपया बस्नुहोस्।", "not सिट लिनुहोस्"),
    ("Can you show me the way to the temple?", "के तपाईं मन्दिर जाने बाटो देखाउन सक्नुहुन्छ?", "way/path"),
    ("I appreciate your help.", "तपाईंको सहयोगको लागि धन्यवाद।", "appreciate→धन्यवाद phrasing"),
    ("Are you feeling better today?", "आज तपाईंलाई राम्रो महसुस भएको छ?", "feeling"),
    ("Please fill out this form.", "कृपया यो फारम भर्नुहोस्।", "fill form"),
    ("Where should I pay?", "म कहाँ तिर्ने?", "pay location"),
    ("Keep the change.", "बाँकी राख्नुहोस्।", "change money"),
    ("I need to renew my visa.", "मलाई भिसा नवीकरण गर्नुपर्छ।", "renew"),
    ("Is this medicine available over the counter?", "के यो औषधि सिधै किन्न पाइन्छ?", "OTC"),
    ("Please speak a little louder.", "कृपया अलिकति ठूलो स्वरमा बोल्नुहोस्।", "louder"),
    ("I am looking for a room with a view.", "म दृश्य भएको कोठा खोज्दै छु।", "view"),
    ("What time does the bus leave?", "बस कति बजे जान्छ?", "leave/depart"),
    ("Please wake me up at six.", "कृपया मलाई छ बजे उठाउनुहोस्।", "wake up"),
    ("Do you accept credit cards?", "के तपाईं क्रेडिट कार्ड स्वीकार गर्नुहुन्छ?", "accept cards"),
    ("I lost my way.", "म बाटो बिराएँ।", "lost way idiom"),
    ("Could you write that down for me?", "के तपाईं मलाई त्यो लेखेर दिन सक्नुहुन्छ?", "write down"),
    ("How much do I owe you?", "मैले तपाईंलाई कति तिर्नुपर्छ?", "owe"),
    ("Please take care of yourself.", "कृपया आफ्नो ख्याल राख्नुहोस्।", "take care"),
]

PREMIUM_EN_NE_INFORMAL: list[tuple[str, str, str]] = [
    ("Could you please look at this document?", "के तिमीले यो कागजात हेर्छौ?", "informal verb"),
    ("What would you like to eat?", "तिमी के खान्छौ?", "informal"),
    ("I will pick you up at the airport.", "म तिमीलाई विमानस्थलमा लिन आउँछु।", "informal object"),
    ("Please make yourself comfortable.", "कृपया आराम गर।", "imperative informal"),
    ("How long have you been waiting?", "तिमी कति बेरदेखि पर्खिरहेको छस्?", "informal progressive"),
    ("Do you have any allergies?", "तिमीलाई कुनै एलर्जी छ?", "same structure"),
    ("The doctor will see you shortly.", "डाक्टरले चाँडै तिमीलाई भेट्छ।", "informal"),
    ("Please take a seat.", "कृपया बस्।", "sit informal"),
    ("Can you show me the way to the temple?", "के तिमी मन्दिर जाने बाटो देखाउन सक्छौ?", "informal can"),
    ("I appreciate your help.", "तिम्रो सहयोगको लागि धन्यवाद।", "तिम्रो"),
    ("Are you feeling better today?", "आज तिमीलाई राम्रो महसुस भएको छ?", "informal"),
    ("Please fill out this form.", "कृपया यो फारम भर।", "informal imperative"),
    ("Where should I pay?", "म कहाँ तिर्ने?", "neutral"),
    ("Keep the change.", "बाँकी राख।", "informal"),
    ("I need to renew my visa.", "मलाई भिसा नवीकरण गर्नुपर्छ।", "neutral"),
    ("Is this medicine available over the counter?", "के यो औषधि सिधै किन्न पाइन्छ?", "neutral"),
    ("Please speak a little louder.", "कृपया अलिकति ठूलो स्वरमा बोल।", "informal"),
    ("I am looking for a room with a view.", "म दृश्य भएको कोठा खोज्दै छु।", "neutral"),
    ("What time does the bus leave?", "बस कति बजे जान्छ?", "neutral"),
    ("Please wake me up at six.", "कृपया मलाई छ बजे उठा।", "informal"),
    ("Do you accept credit cards?", "के तिमी क्रेडिट कार्ड स्वीकार गर्छौ?", "informal"),
    ("I lost my way.", "म बाटो बिराएँ।", "neutral"),
    ("Could you write that down for me?", "के तिमी मलाई त्यो लेखेर दिन सक्छौ?", "informal"),
    ("How much do I owe you?", "मैले तिमीलाई कति तिर्नुपर्छ?", "informal object"),
    ("Please take care of yourself.", "कृपया आफ्नो ख्याल राख।", "informal"),
]

PREMIUM_NE_EN: list[tuple[str, str, str]] = [
    ("तपाईंलाई के समस्या छ?", "What problem are you having?", "medical open"),
    ("मलाई चक्कर आइरहेको छ।", "I am feeling dizzy.", "dizzy not spinning head calque"),
    ("यो औषधि खानापछि खानुहोस्।", "Take this medicine after food.", "after meals"),
    ("भिसाको म्याद सकियो।", "The visa has expired.", "expired"),
    ("बाटो बिराएँ।", "I lost my way.", "idiom"),
    ("के तपाईं कार्ड चल्नुहुन्छ?", "Do you take cards?", "card acceptance"),
    ("मलाई सानो पैसा चाहियो।", "I need small change.", "change"),
    ("आज मौसम ठिक छैन।", "The weather is not good today.", "weather"),
    ("म तपाईंलाई फोन गर्छु।", "I will call you.", "call"),
    ("कृपया पर्खनुहोस्।", "Please wait.", "wait"),
    ("मलाई निद्रा लाग्यो।", "I am sleepy.", "sleepy"),
    ("पानी पर्दै छ।", "It is raining.", "raining"),
    ("यो ठाउँ कति टाढा छ?", "How far is this place?", "distance"),
    ("मलाई सहयोग चाहियो।", "I need help.", "help"),
    ("के तपाईं नेपाली बुझ्नुहुन्छ?", "Do you understand Nepali?", "understand"),
    ("मेरो पेट दुख्यो।", "My stomach hurts.", "stomach ache"),
    ("बस छुट्यो।", "I missed the bus.", "missed bus"),
    ("मलाई चिसो लाग्यो।", "I feel cold. / I have a cold.", "ambiguous chiso — prefer feel cold"),
    ("तपाईंको नाम के हो?", "What is your name?", "name"),
    ("म ठिक छु।", "I am fine.", "fine"),
    ("यो कति पर्छ?", "How much does this cost?", "cost"),
    ("म भाडा तिर्न चाहन्छु।", "I want to pay the fare.", "fare"),
    ("के यहाँ वाइफाइ छ?", "Is there Wi‑Fi here?", "wifi"),
    ("मलाई पानी चाहियो।", "I need water.", "need water"),
    ("बिहानको खाजा समावेश छ?", "Is breakfast included?", "breakfast included"),
]

PREMIUM_ROMAN: list[tuple[str, str, str, str]] = [
    # roman, deva, en, note
    ("malai chakkar aairaheko cha", "मलाई चक्कर आइरहेको छ", "I am feeling dizzy.", "roman medical"),
    ("bato biraye", "बाटो बिराएँ", "I lost my way.", "idiom roman"),
    ("visa ko myaad sakiyo", "भिसाको म्याद सकियो", "The visa has expired.", "expired"),
    ("tapai lai ke samasya cha?", "तपाईंलाई के समस्या छ?", "What problem are you having?", "formal q"),
    ("yo ausadhi khanapachi khanuhos", "यो औषधि खानापछि खानुहोस्", "Take this medicine after food.", "instruction"),
    ("malai sano paisa chahiyo", "मलाई सानो पैसा चाहियो", "I need small change.", "change"),
    ("aja mausam thik chaina", "आज मौसम ठिक छैन", "The weather is not good today.", "weather"),
    ("ma tapai lai phone garchu", "म तपाईंलाई फोन गर्छु", "I will call you.", "call"),
    ("kripya parkhnuhos", "कृपया पर्खनुहोस्", "Please wait.", "wait"),
    ("malai nidra lagyo", "मलाई निद्रा लाग्यो", "I am sleepy.", "sleepy"),
    ("pani pardai cha", "पानी पर्दै छ", "It is raining.", "rain"),
    ("yo thau kati tadha cha?", "यो ठाउँ कति टाढा छ?", "How far is this place?", "distance"),
    ("malai sahayog chahiyo", "मलाई सहयोग चाहियो", "I need help.", "help"),
    ("tapai nepali bujhnuhunchha?", "तपाईं नेपाली बुझ्नुहुन्छ?", "Do you understand Nepali?", "understand"),
    ("mero pet dukhyo", "मेरो पेट दुख्यो", "My stomach hurts.", "stomach"),
    ("bus chutyo", "बस छुट्यो", "I missed the bus.", "missed"),
    ("malai chiso lagyo", "मलाई चिसो लाग्यो", "I feel cold.", "cold"),
    ("tapai ko naam ke ho?", "तपाईंको नाम के हो?", "What is your name?", "name"),
    ("ma thik chu", "म ठिक छु", "I am fine.", "fine"),
    ("yo kati parcha?", "यो कति पर्छ?", "How much does this cost?", "cost"),
    ("ma bhada tirna chahanchu", "म भाडा तिर्न चाहन्छु", "I want to pay the fare.", "fare"),
    ("yaha wifi cha?", "यहाँ वाइफाइ छ?", "Is there Wi‑Fi here?", "wifi"),
    ("malai pani chahiyo", "मलाई पानी चाहियो", "I need water.", "water"),
    ("bihanko khaja samavesh cha?", "बिहानको खाजा समावेश छ?", "Is breakfast included?", "breakfast"),
    ("dhanyabad tapai ko madat ko lagi", "धन्यवाद तपाईंको मद्दतको लागि", "Thank you for your help.", "thanks"),
]


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )


def append_en_ne(cls: str, pairs: list[tuple[str, str, str]]) -> int:
    d = GOLD / cls
    sources = load_jsonl(d / "sources.jsonl")
    refs = load_jsonl(d / "references.jsonl")
    existing = {s["source"].strip().lower() for s in sources if s.get("source")}
    added = 0
    next_id = len(sources) + 1
    for en, ne, note in pairs:
        if en.strip().lower() in existing:
            continue
        sid = f"{cls}-{next_id:03d}"
        sources.append(
            {
                "id": sid,
                "source": en,
                "status": "premium_reviewed",
                "tier": "premium_word_choice",
                "note": note,
            }
        )
        refs.append({"id": sid, "reference": ne, "tier": "premium_word_choice", "note": note})
        existing.add(en.strip().lower())
        next_id += 1
        added += 1
    # rewrite with compact sequential ids 001..n
    sources2, refs2, items = [], [], []
    for i, (s, r) in enumerate(zip(sources, refs), start=1):
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
                "n_premium": sum(1 for s in sources2 if s.get("tier") == "premium_word_choice"),
                "items": items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"{cls}: +{added} → {len(sources2)} total")
    return added


def append_ne_en(cls: str, pairs: list[tuple[str, str, str]]) -> int:
    d = GOLD / cls
    sources = load_jsonl(d / "sources.jsonl")
    refs = load_jsonl(d / "references.jsonl")
    existing = {s["source"].strip() for s in sources if s.get("source")}
    added = 0
    for ne, en, note in pairs:
        if ne.strip() in existing:
            continue
        sources.append(
            {
                "id": "tmp",
                "source": ne,
                "script": "deva",
                "status": "premium_reviewed",
                "tier": "premium_word_choice",
                "note": note,
            }
        )
        refs.append(
            {
                "id": "tmp",
                "reference": en,
                "tier": "premium_word_choice",
                "note": note,
            }
        )
        existing.add(ne.strip())
        added += 1
    sources2, refs2, items = [], [], []
    for i, (s, r) in enumerate(zip(sources, refs), start=1):
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
                "n_premium": sum(1 for s in sources2 if s.get("tier") == "premium_word_choice"),
                "items": items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"{cls}: +{added} → {len(sources2)} total")
    return added


def append_roman(pairs: list[tuple[str, str, str, str]]) -> int:
    cls = "ne_en_roman"
    d = GOLD / cls
    sources = load_jsonl(d / "sources.jsonl")
    refs = load_jsonl(d / "references.jsonl")
    existing = {s["source"].strip().lower() for s in sources if s.get("source")}
    added = 0
    for roman, deva, en, note in pairs:
        if roman.strip().lower() in existing:
            continue
        sources.append(
            {
                "id": "tmp",
                "source": roman,
                "deva": deva,
                "script": "roman",
                "status": "premium_reviewed",
                "tier": "premium_word_choice",
                "note": note,
            }
        )
        refs.append(
            {
                "id": "tmp",
                "reference": en,
                "deva": deva,
                "tier": "premium_word_choice",
                "note": note,
            }
        )
        existing.add(roman.strip().lower())
        added += 1
    sources2, refs2, items = [], [], []
    for i, (s, r) in enumerate(zip(sources, refs), start=1):
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
                "n_premium": sum(1 for s in sources2 if s.get("tier") == "premium_word_choice"),
                "items": items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"{cls}: +{added} → {len(sources2)} total")
    return added


def main() -> None:
    n = 0
    n += append_en_ne("en_ne_formal", PREMIUM_EN_NE_FORMAL)
    n += append_en_ne("en_ne_informal", PREMIUM_EN_NE_INFORMAL)
    n += append_ne_en("ne_en_deva", PREMIUM_NE_EN)
    n += append_roman(PREMIUM_ROMAN)
    print(f"premium pairs added (unique): ~{n}")


if __name__ == "__main__":
    main()
