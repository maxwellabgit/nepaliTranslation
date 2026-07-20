#!/usr/bin/env python3
"""
Build a meaning-centric EN↔NE bank and expand to ≤10k controlled FT examples.

Canonical schema (one meaning, two Devanagari registers, two everyday Roman views):
{
  "meaning_id": "travel_00031",
  "english": "Please wait here.",
  "ne_formal": "कृपया यहाँ पर्खनुहोस्।",
  "ne_informal": "यहाँ पर्ख न।",
  "roman_formal": "kripya yaha parkhanuhos.",
  "roman_informal": "yaha parkha na.",
  "surface": "travel",
  ...
}

Training expands to ONE controlled MT family (not 4 models):
  <en><ne><formal> EN → ne_formal
  <en><ne><informal> EN → ne_informal
  <ne><en> ne_* → EN
  (optional) roman → EN for noisy-input robustness
"""
from __future__ import annotations

import csv
import hashlib
import json
import random
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

OUT = Path(__file__).resolve().parent / "data"
GOLD_BLOCK = REPO / "benchmarks" / "data" / "gold_train_blocklist.json"
USER_CSV = OUT / "external" / "nepali_translation_gold_candidates.csv"
if not USER_CSV.exists():
    USER_CSV = Path(r"c:\Users\maxwe\Downloads\nepali_translation_gold_candidates.csv")

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
MAX_TRAIN_EX = 10_000

# Surface-area priority (annotation / sampling order)
SURFACES = [
    "core_grammar",
    "pronouns_honorifics",
    "questions_requests",
    "travel",
    "health",
    "shopping",
    "government",
    "family",
    "numbers_money",
    "code_switch_names",
    "asr_noise",
    "conversation_long",
]

# Soft caps when ingesting OPUS/GV/gold extras so core_grammar cannot drown
# priority surfaces. Hand seeds + user CSV are never capped.
SURFACE_CAPS: dict[str, int] = {
    "core_grammar": 350,
    "conversation_long": 220,
    "questions_requests": 180,
    "government": 120,
    "numbers_money": 100,
    "travel": 120,
    "shopping": 100,
    "pronouns_honorifics": 100,
    "health": 100,
    "family": 80,
    "code_switch_names": 60,
    "asr_noise": 40,
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def load_blocklist() -> set[str]:
    blocked: set[str] = set()
    if GOLD_BLOCK.exists():
        g = json.loads(GOLD_BLOCK.read_text(encoding="utf-8"))
        for s in (g.get("sources") or []) + (g.get("references") or []):
            blocked.add(norm(s))
    gold = REPO / "benchmarks" / "gold"
    if gold.exists():
        for cls in gold.iterdir():
            if not cls.is_dir():
                continue
            for name in ("sources.jsonl", "references.jsonl"):
                p = cls / name
                if not p.exists():
                    continue
                for line in p.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    row = json.loads(line)
                    for k in ("source", "reference", "deva"):
                        if row.get(k):
                            blocked.add(norm(str(row[k])))
    return blocked


# Everyday Roman house style (no scholarly diacritics) — mirrors annotation guide.
_ROMAN = [
    ("क्ष", "chhya"),
    ("त्र", "tra"),
    ("ज्ञ", "gya"),
    ("श्र", "shra"),
    ("ख", "kha"),
    ("घ", "gha"),
    ("च", "cha"),
    ("छ", "chha"),
    ("ज", "ja"),
    ("झ", "jha"),
    ("ट", "ta"),
    ("ठ", "tha"),
    ("ड", "da"),
    ("ढ", "dha"),
    ("ण", "na"),
    ("त", "ta"),
    ("थ", "tha"),
    ("द", "da"),
    ("ध", "dha"),
    ("न", "na"),
    ("प", "pa"),
    ("फ", "pha"),
    ("ब", "ba"),
    ("भ", "bha"),
    ("म", "ma"),
    ("य", "ya"),
    ("र", "ra"),
    ("ल", "la"),
    ("व", "wa"),
    ("श", "sha"),
    ("ष", "sha"),
    ("स", "sa"),
    ("ह", "ha"),
    ("क", "ka"),
    ("ग", "ga"),
    ("ङ", "nga"),
    ("ञ", "nya"),
    ("आ", "aa"),
    ("अ", "a"),
    ("इ", "i"),
    ("ई", "i"),
    ("उ", "u"),
    ("ऊ", "u"),
    ("ए", "e"),
    ("ऐ", "ai"),
    ("ओ", "o"),
    ("औ", "au"),
    ("ा", "a"),
    ("ि", "i"),
    ("ी", "i"),
    ("ु", "u"),
    ("ू", "u"),
    ("े", "e"),
    ("ै", "ai"),
    ("ो", "o"),
    ("ौ", "au"),
    ("ं", "n"),
    ("ँ", "n"),
    ("ः", ""),
    ("्", ""),
    ("।", "."),
]


def everyday_roman(ne: str) -> str:
    """Everyday chat Roman (no diacritics). Consonant + matra aware."""
    # Phrase-level house spellings first
    phrases = {
        "नमस्ते": "namaste",
        "धन्यवाद": "dhanyabad",
        "कृपया": "kripya",
        "तपाईं": "tapai",
        "तपाईँ": "tapai",
        "तिमी": "timi",
        "कहाँ": "kaha",
        "गर्नुहोस्": "garnuhos",
        "पर्खनुहोस्": "parkhanuhos",
        "हुनुहुन्छ": "hunuhunchha",
        "जाँदै": "jadai",
        "राम्रो": "ramro",
        "ठिक": "thik",
        "छ": "chha",
        "हो": "ho",
        "मलाई": "malai",
        "मेरो": "mero",
    }
    s = ne.strip()
    # longest-first replace for multi-akshara tokens
    for k in sorted(phrases, key=len, reverse=True):
        s = s.replace(k, phrases[k])
    # Remaining Devanagari → rough roman
    out = []
    i = 0
    cons = {
        "क": "k",
        "ख": "kh",
        "ग": "g",
        "घ": "gh",
        "ङ": "ng",
        "च": "ch",
        "छ": "chh",
        "ज": "j",
        "झ": "jh",
        "ट": "t",
        "ठ": "th",
        "ड": "d",
        "ढ": "dh",
        "ण": "n",
        "त": "t",
        "थ": "th",
        "द": "d",
        "ध": "dh",
        "न": "n",
        "प": "p",
        "फ": "ph",
        "ब": "b",
        "भ": "bh",
        "म": "m",
        "य": "y",
        "र": "r",
        "ल": "l",
        "व": "w",
        "श": "sh",
        "ष": "sh",
        "स": "s",
        "ह": "h",
    }
    indep = {
        "अ": "a",
        "आ": "aa",
        "इ": "i",
        "ई": "i",
        "उ": "u",
        "ऊ": "u",
        "ए": "e",
        "ऐ": "ai",
        "ओ": "o",
        "औ": "au",
    }
    matra = {
        "ा": "a",
        "ि": "i",
        "ी": "i",
        "ु": "u",
        "ू": "u",
        "े": "e",
        "ै": "ai",
        "ो": "o",
        "ौ": "au",
        "ं": "n",
        "ँ": "n",
        "्": "",
    }
    while i < len(s):
        ch = s[i]
        if ch in indep:
            out.append(indep[ch])
            i += 1
            continue
        if ch in cons:
            stem = cons[ch]
            i += 1
            if i < len(s) and s[i] in matra:
                m = matra[s[i]]
                i += 1
                out.append(stem + m if m is not None else stem)
            else:
                out.append(stem + "a")
            continue
        if ch in matra:
            out.append(matra[ch])
            i += 1
            continue
        if ch == "।":
            out.append(".")
            i += 1
            continue
        out.append(ch)
        i += 1
    text = "".join(out)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s?.!,]", "", text)
    return text.strip().lower()


def to_informal(ne: str) -> str:
    out = ne
    reps = [
        ("तपाईंहरू", "तिमीहरू"),
        ("तपाईँहरू", "तिमीहरू"),
        ("तपाईंको", "तिम्रो"),
        ("तपाईँको", "तिम्रो"),
        ("तपाईंलाई", "तिमीलाई"),
        ("तपाईँलाई", "तिमीलाई"),
        ("तपाईंले", "तिमीले"),
        ("तपाईँले", "तिमीले"),
        ("तपाईं", "तिमी"),
        ("तपाईँ", "तिमी"),
        ("गर्नुहोस्", "गर"),
        ("दिनुहोस्", "देऊ"),
        ("बस्नुहोस्", "बस"),
        ("पर्खनुहोस्", "पर्ख"),
        ("आउनुहोस्", "आउ"),
        ("जानुहोस्", "जा"),
        ("खानुहोस्", "खा"),
        ("बोल्नुहोस्", "बोल"),
        ("गर्नुहुन्छ", "गर्छौ"),
        ("सक्नुहुन्छ", "सक्छौ"),
        ("हुनुहुन्छ", "छौ"),
        ("जाँदै हुनुहुन्छ", "जाँदै छौ"),
        ("छन्", "छौ"),
        ("कृपया ", ""),
    ]
    for a, b in reps:
        out = out.replace(a, b)
    return out


def meaning(
    surface: str,
    idx: int,
    english: str,
    ne_formal: str,
    ne_informal: str | None = None,
    provenance: str = "hand_seed",
) -> dict:
    nf = ne_formal.strip()
    ni = (ne_informal or to_informal(nf)).strip()
    return {
        "meaning_id": f"{surface}_{idx:05d}",
        "english": english.strip(),
        "ne_formal": nf,
        "ne_informal": ni,
        "roman_formal": everyday_roman(nf),
        "roman_informal": everyday_roman(ni),
        "surface": surface,
        "provenance": provenance,
        "unit": "sentence",
    }


# --- Priority hand seeds (surface coverage) ---
HAND_SEEDS: list[tuple[str, str, str, str | None]] = [
    # core_grammar / pronouns
    ("core_grammar", "I am fine.", "म ठिक छु।", "म ठिक छु।"),
    ("core_grammar", "This is good.", "यो राम्रो छ।", "यो राम्रो छ।"),
    ("core_grammar", "That is not right.", "त्यो ठिक होइन।", "त्यो ठिक होइन।"),
    ("pronouns_honorifics", "How are you?", "तपाईंलाई कस्तो छ?", "तिमीलाई कस्तो छ?"),
    ("pronouns_honorifics", "Where are you going?", "तपाईं कहाँ जाँदै हुनुहुन्छ?", "तिमी कहाँ जाँदै छौ?"),
    ("pronouns_honorifics", "What is your name?", "तपाईंको नाम के हो?", "तिम्रो नाम के हो?"),
    ("pronouns_honorifics", "Please sit down.", "कृपया बस्नुहोस्।", "बस न।"),
    ("pronouns_honorifics", "Could you help me?", "के तपाईं मलाई मद्दत गर्न सक्नुहुन्छ?", "के तिमी मलाई मद्दत गर्न सक्छौ?"),
    ("questions_requests", "Please wait here.", "कृपया यहाँ पर्खनुहोस्।", "यहाँ पर्ख न।"),
    ("questions_requests", "Can you repeat that?", "कृपया फेरि भन्नुहोस्।", "फेरि भन न।"),
    ("questions_requests", "Speak slowly, please.", "कृपया बिस्तारै बोल्नुहोस्।", "बिस्तारै बोल न।"),
    ("questions_requests", "Do you understand?", "के तपाईं बुझ्नुहुन्छ?", "के तिमी बुझ्छौ?"),
    ("questions_requests", "What does this mean?", "यसको अर्थ के हो?", "यसको अर्थ के हो?"),
    # travel
    ("travel", "Where is the bathroom?", "शौचालय कहाँ छ?", "शौचालय कहाँ छ?"),
    ("travel", "Where is the airport?", "विमानस्थल कहाँ छ?", "विमानस्थल कहाँ छ?"),
    ("travel", "Where is the hotel?", "होटल कहाँ छ?", "होटल कहाँ छ?"),
    ("travel", "I am lost.", "म हराएँ।", "म हराएँ।"),
    ("travel", "How far is it?", "यो कति टाढा छ?", "यो कति टाढा छ?"),
    ("travel", "Please take me to the bus station.", "कृपया मलाई बस स्टेशन लैजानुहोस्।", "मलाई बस स्टेशन लगिदे।"),
    ("travel", "Is this the way to Thamel?", "के यो ठमेल जाने बाटो हो?", "के यो ठमेल जाने बाटो हो?"),
    ("travel", "I need a taxi.", "मलाई ट्याक्सी चाहियो।", "मलाई ट्याक्सी चाहियो।"),
    # health
    ("health", "I need a doctor.", "मलाई डाक्टर चाहियो।", "मलाई डाक्टर चाहियो।"),
    ("health", "Where is the hospital?", "अस्पताल कहाँ छ?", "अस्पताल कहाँ छ?"),
    ("health", "I have a fever.", "मलाई ज्वरो आएको छ।", "मलाई ज्वरो आएको छ।"),
    ("health", "My stomach hurts.", "मेरो पेट दुख्यो।", "मेरो पेट दुख्यो।"),
    ("health", "Call an ambulance.", "एम्बुलेन्स बोलाउनुहोस्।", "एम्बुलेन्स बोला।"),
    ("health", "I am allergic to peanuts.", "मलाई बदामको एलर्जी छ।", "मलाई बदामको एलर्जी छ।"),
    # shopping
    ("shopping", "How much does this cost?", "यसको मूल्य कति हो?", "यो कति पर्छ?"),
    ("shopping", "That is too expensive.", "त्यो धेरै महँगो छ।", "त्यो धेरै महँगो छ।"),
    ("shopping", "Do you take cards?", "के तपाईं कार्ड लिनुहुन्छ?", "कार्ड चल्छ?"),
    ("shopping", "I want this one.", "म यो चाहन्छु।", "म यो चाहन्छु।"),
    ("shopping", "Bill please.", "बिल दिनुहोस्।", "बिल देऊ।"),
    ("shopping", "Keep the change.", "बाँकी राख्नुहोस्।", "बाँकी राख।"),
    # government
    ("government", "I need to renew my visa.", "मलाई भिसा नवीकरण गर्नुपर्छ।", "मलाई भिसा नवीकरण गर्नुपर्छ।"),
    ("government", "Where should I pay?", "म कहाँ तिर्ने?", "म कहाँ तिर्ने?"),
    ("government", "Please fill out this form.", "कृपया यो फारम भर्नुहोस्।", "यो फारम भर।"),
    ("government", "I have a reservation.", "मेरो आरक्षण छ।", "मेरो बुकिङ छ।"),
    ("government", "This is my passport.", "यो मेरो पासपोर्ट हो।", "यो मेरो पासपोर्ट हो।"),
    # family
    ("family", "This is my family.", "यो मेरो परिवार हो।", "यो मेरो परिवार हो।"),
    ("family", "How is your mother?", "तपाईंकी आमालाई कस्तो छ?", "तिम्री आमालाई कस्तो छ?"),
    ("family", "See you later.", "पछि भेटौंला।", "पछि भेटौंला।"),
    ("family", "Welcome.", "स्वागत छ।", "स्वागत छ।"),
    ("family", "Thank you very much.", "धेरै धन्यवाद।", "धेरै धन्यवाद।"),
    # numbers_money
    ("numbers_money", "What time is it?", "कति बज्यो?", "कति बज्यो?"),
    ("numbers_money", "I need small change.", "मलाई सानो पैसा चाहियो।", "मलाई सानो पैसा चाहियो।"),
    ("numbers_money", "It is two hundred rupees.", "दुई सय रुपैयाँ हो।", "दुई सय रुपैयाँ हो।"),
    ("numbers_money", "Wake me up at six.", "मलाई छ बजे उठाउनुहोस्।", "मलाई छ बजे उठा।"),
    # code_switch / names
    ("code_switch_names", "I love Kathmandu.", "म काठमाडौंलाई माया गर्छु।", "म काठमाडौंलाई माया गर्छु।"),
    ("code_switch_names", "Is Wi-Fi free here?", "के यहाँ वाइफाइ निःशुल्क छ?", "यहाँ वाइफाइ फ्री छ?"),
    ("code_switch_names", "My name is Cooper.", "मेरो नाम कुपर हो।", "मेरो नाम कुपर हो।"),
    # asr_noise (clean targets; noisy variants added at expand time)
    ("asr_noise", "I do not understand.", "मैले बुझिनँ।", "मैले बुझिनँ।"),
    ("asr_noise", "Please help me.", "कृपया मलाई मद्दत गर्नुहोस्।", "मलाई मद्दत गर।"),
    ("asr_noise", "Say that again.", "फेरि भन्नुहोस्।", "फेरि भन।"),
    # conversation
    ("conversation_long", "I am looking for a room with a view.", "म भ्यू भएको कोठा खोज्दै छु।", "म भ्यू भएको कोठा खोज्दै छु।"),
    ("conversation_long", "What would you like to eat?", "तपाईं के खान चाहनुहुन्छ?", "तिमी के खान चाहन्छौ?"),
    ("conversation_long", "Are you feeling better today?", "के तपाईं आज राम्रो महसुस गर्दै हुनुहुन्छ?", "के तिमी आज राम्रो महसुस गर्दै छौ?"),
    # Extra priority coverage (travel / health / honorifics / shopping)
    ("travel", "Which bus goes to Patan?", "कुन बस पाटन जान्छ?", "कुन बस पाटन जान्छ?"),
    ("travel", "How long does it take?", "कति समय लाग्छ?", "कति समय लाग्छ?"),
    ("travel", "Is there a cheaper hotel nearby?", "नजिकै सस्तो होटल छ?", "नजिकै सस्तो होटल छ?"),
    ("travel", "Please stop here.", "कृपया यहाँ रोक्नुहोस्।", "यहाँ रोक।"),
    ("travel", "Where can I buy a SIM card?", "सिम कार्ड कहाँ किन्न सकिन्छ?", "सिम कार्ड कहाँ किन्न सकिन्छ?"),
    ("travel", "The flight is delayed.", "उडान ढिलो भयो।", "उडान ढिलो भयो।"),
    ("health", "I feel dizzy.", "मलाई टाउको घुमेको छ।", "मलाई टाउको घुमेको छ।"),
    ("health", "I need medicine for a headache.", "मलाई टाउको दुखाइको औषधि चाहियो।", "मलाई टाउको दुखाइको औषधि चाहियो।"),
    ("health", "Does it hurt here?", "के यहाँ दुख्छ?", "के यहाँ दुख्छ?"),
    ("health", "I am pregnant.", "म गर्भवती छु।", "म गर्भवती छु।"),
    ("health", "Please call a nurse.", "कृपया नर्स बोलाउनुहोस्।", "नर्स बोला।"),
    ("pronouns_honorifics", "Please come in.", "कृपया भित्र आउनुहोस्।", "भित्र आ।"),
    ("pronouns_honorifics", "Would you like some tea?", "के तपाईं चिया खानुहुन्छ?", "के तिमी चिया खान्छौ?"),
    ("pronouns_honorifics", "Excuse me.", "माफ गर्नुहोस्।", "माफ गर।"),
    ("pronouns_honorifics", "After you.", "तपाईं पहिले।", "तिमी पहिले।"),
    ("shopping", "Can I try this on?", "के म यो लगाएर हेर्न सक्छु?", "म यो लगाएर हेर्न सक्छु?"),
    ("shopping", "Do you have a smaller size?", "साना साइज छ?", "साना साइज छ?"),
    ("shopping", "I will pay in cash.", "म नगद तिर्छु।", "म नगद तिर्छु।"),
    ("family", "This is my brother.", "यो मेरो भाइ हो।", "यो मेरो भाइ हो।"),
    ("family", "Congratulations.", "बधाई छ।", "बधाई छ।"),
    ("numbers_money", "It is half past three.", "साढे तीन बज्यो।", "साढे तीन बज्यो।"),
    ("numbers_money", "One thousand rupees.", "एक हजार रुपैयाँ।", "एक हजार रुपैयाँ।"),
    ("code_switch_names", "Meet me at Durbar Square.", "दरबार स्क्वायरमा भेटौं।", "दरबार स्क्वायरमा भेटौं।"),
    ("code_switch_names", "Open Google Maps.", "गुगल म्याप्स खोल्नुहोस्।", "गुगल म्याप्स खोल।"),
    ("questions_requests", "Could you write it down?", "के तपाईं लेखिदिन सक्नुहुन्छ?", "के तिमी लेखिदिन सक्छौ?"),
    ("questions_requests", "Is that okay?", "के त्यो ठिक छ?", "के त्यो ठिक छ?"),
]


def guess_surface(en: str, ne: str) -> str:
    t = f"{en} {ne}".lower()
    rules = [
        ("health", r"doctor|hospital|fever|pain|ambulance|medicine|ज्वरो|डाक्टर|अस्पताल|औषधि"),
        ("travel", r"airport|hotel|taxi|bus|bathroom|toilet|lost|station|विमान|होटल|ट्याक्सी|शौचालय"),
        ("shopping", r"cost|price|expensive|bill|card|buy|महँगो|मूल्य|बिल"),
        ("government", r"visa|passport|form|reservation|commission|भिसा|पासपोर्ट|फारम"),
        ("numbers_money", r"rupee|time|o'clock|change|रुपैयाँ|बज्यो|पैसा"),
        ("family", r"family|mother|father|welcome|thank|परिवार|आमा|स्वागत|धन्यवाद"),
        ("questions_requests", r"please|can you|could you|कृपया|\?"),
        ("pronouns_honorifics", r"how are you|your name|तपाईं|तिमी"),
    ]
    for surface, pat in rules:
        if re.search(pat, t, re.I):
            return surface
    if len(en) > 80:
        return "conversation_long"
    return "core_grammar"


def add_meaning(bank: dict[str, dict], m: dict, blocked: set[str]) -> None:
    if norm(m["english"]) in blocked or norm(m["ne_formal"]) in blocked:
        return
    if not DEVANAGARI.search(m["ne_formal"]):
        return
    if len(m["english"]) < 3 or len(m["ne_formal"]) < 2:
        return
    # Dedupe by english+formal
    key = hashlib.sha1(f"{norm(m['english'])}|{norm(m['ne_formal'])}".encode()).hexdigest()[:12]
    if key in bank:
        return
    bank[key] = m


def build_bank() -> list[dict]:
    blocked = load_blocklist()
    bank: dict[str, dict] = {}
    counters = {s: 0 for s in SURFACES}

    for surface, en, nf, ni in HAND_SEEDS:
        counters[surface] += 1
        add_meaning(
            bank,
            meaning(surface, counters[surface], en, nf, ni, "hand_priority_seed"),
            blocked,
        )

    # User CSV conversation + gov UI
    if USER_CSV.exists():
        with USER_CSV.open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                en = (row.get("english") or "").strip()
                ne = (row.get("nepali") or "").strip()
                if not en or not ne:
                    continue
                domain = row.get("domain") or "core_grammar"
                surface = (
                    "government"
                    if domain == "government_ui"
                    else guess_surface(en, ne)
                )
                counters[surface] += 1
                reg = (row.get("register") or "neutral").strip()
                if reg == "informal":
                    nf, ni = to_informal(ne) if "तपाईं" in ne or "तपाईँ" in ne else ne, ne
                    # if already informal-looking, keep both same
                    if "तिमी" in ne:
                        nf = ne.replace("तिमी", "तपाईं").replace("तिम्रो", "तपाईंको")
                        ni = ne
                    else:
                        nf, ni = ne, ne
                else:
                    nf, ni = ne, to_informal(ne)
                add_meaning(
                    bank,
                    meaning(
                        surface,
                        counters[surface],
                        en,
                        nf,
                        ni,
                        row.get("source") or "user_csv",
                    ),
                    blocked,
                )

    # Short high-signal rows from gold_domain / GV / law
    extras = [
        (OUT / "train_user_conversation_seeds.jsonl", "user_conv_seed"),
        (OUT / "train_law_gov_en_ne.jsonl", "law_gov"),
        (OUT / "train_global_voices_en_ne.jsonl", "global_voices"),
        (OUT / "train_gold_domain.jsonl", "gold_domain_short"),
    ]
    surface_counts = {s: 0 for s in SURFACES}
    for m in bank.values():
        surface_counts[m.get("surface", "core_grammar")] = (
            surface_counts.get(m.get("surface", "core_grammar"), 0) + 1
        )

    for path, prov in extras:
        if not path.exists():
            continue
        n_take = 800 if "global_voices" in prov else 1200 if "gold_domain" in prov else 500
        taken = 0
        for line in path.open(encoding="utf-8"):
            if taken >= n_take:
                break
            r = json.loads(line)
            en = (r.get("eng_Latn") or "").strip()
            ne = (r.get("npi_Deva") or "").strip()
            if not en or not ne or not DEVANAGARI.search(ne):
                continue
            # Prefer short conversational / formal gov; skip very long journalism for meaning bank core
            if prov == "global_voices" and (len(en) > 160 or len(ne) > 200):
                continue
            if len(en) > 140 or len(ne) > 160:
                continue
            surface = guess_surface(en, ne)
            if prov == "law_gov":
                surface = "government"
            cap = SURFACE_CAPS.get(surface)
            if cap is not None and surface_counts.get(surface, 0) >= cap:
                continue
            counters[surface] += 1
            formality = r.get("formality") or "neutral"
            if formality == "informal" or "तिमी" in ne:
                ni = ne
                nf = ne
                for a, b in [("तिमीहरू", "तपाईंहरू"), ("तिम्रो", "तपाईंको"), ("तिमीलाई", "तपाईंलाई"), ("तिमी", "तपाईं")]:
                    nf = nf.replace(a, b)
            else:
                nf = ne
                ni = to_informal(ne)
            before = len(bank)
            add_meaning(
                bank,
                meaning(surface, counters[surface], en, nf, ni, prov),
                blocked,
            )
            if len(bank) > before:
                surface_counts[surface] = surface_counts.get(surface, 0) + 1
                taken += 1

    meanings = list(bank.values())
    # Stable order by surface priority then id
    surface_rank = {s: i for i, s in enumerate(SURFACES)}
    meanings.sort(key=lambda m: (surface_rank.get(m["surface"], 99), m["meaning_id"]))
    # Re-id densely per surface for cleanliness
    per: dict[str, int] = {s: 0 for s in SURFACES}
    cleaned = []
    for m in meanings:
        s = m["surface"] if m["surface"] in per else "core_grammar"
        per[s] += 1
        m = dict(m)
        m["meaning_id"] = f"{s}_{per[s]:05d}"
        m["surface"] = s
        cleaned.append(m)
    return cleaned


def expand_train(meanings: list[dict], max_ex: int = MAX_TRAIN_EX) -> list[dict]:
    """Expand meanings → controlled seq2seq examples (cap max_ex).

    Product-facing notation is <en><ne><formal>; IndicTrans2 tokenizer rejects
    bare <en> as a language tag, so model strings use:
      <formal> / <informal>  for EN→NE
      plain Devanagari/roman for NE→EN (direction implied by checkpoint)
    Runtime maps product tokens → these model prefixes.
    """
    examples: list[dict] = []
    surface_rank = {s: i for i, s in enumerate(SURFACES)}
    ordered = sorted(meanings, key=lambda m: surface_rank.get(m["surface"], 99))

    def add_ex(
        src: str,
        tgt: str,
        direction: str,
        meaning_id: str,
        surface: str,
        register: str,
        product_prefix: str,
    ):
        examples.append(
            {
                "src": src,
                "tgt": tgt,
                "direction": direction,
                "meaning_id": meaning_id,
                "surface": surface,
                "register": register,
                "product_prefix": product_prefix,
            }
        )

    for m in ordered:
        mid, surface = m["meaning_id"], m["surface"]
        en, nf, ni = m["english"], m["ne_formal"], m["ne_informal"]
        rf = m["roman_formal"]
        add_ex(f"<formal> {en}", nf, "en-ne", mid, surface, "formal", "<en><ne><formal>")
        add_ex(f"<informal> {en}", ni, "en-ne", mid, surface, "informal", "<en><ne><informal>")
        add_ex(nf, en, "ne-en", mid, surface, "formal", "<ne><en>")
        if ni != nf:
            add_ex(ni, en, "ne-en", mid, surface, "informal", "<ne><en>")
        if surface in ("travel", "health", "questions_requests", "pronouns_honorifics"):
            add_ex(rf, en, "ne-en", mid, surface, "roman_formal", "<ne><en>")
        if len(examples) >= max_ex:
            break

    examples = examples[:max_ex]
    random.Random(42).shuffle(examples)
    return examples


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    meanings = build_bank()
    bank_path = OUT / "meaning_bank.jsonl"
    bank_path.write_text(
        "\n".join(json.dumps(m, ensure_ascii=False) for m in meanings) + "\n",
        encoding="utf-8",
    )
    by_surface: dict[str, int] = {}
    for m in meanings:
        by_surface[m["surface"]] = by_surface.get(m["surface"], 0) + 1

    train = expand_train(meanings, MAX_TRAIN_EX)
    # Split train/val
    n_val = max(200, int(len(train) * 0.05))
    val, tr = train[:n_val], train[n_val:]
    (OUT / "train_meanings_controlled.jsonl").write_text(
        "\n".join(json.dumps(x, ensure_ascii=False) for x in tr) + "\n", encoding="utf-8"
    )
    (OUT / "val_meanings_controlled.jsonl").write_text(
        "\n".join(json.dumps(x, ensure_ascii=False) for x in val) + "\n", encoding="utf-8"
    )

    # Direction splits for IT2 dual checkpoints
    for direction, name in (("en-ne", "train_meanings_en_ne.jsonl"), ("ne-en", "train_meanings_ne_en.jsonl")):
        rows = [x for x in tr if x["direction"] == direction]
        (OUT / name).write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n", encoding="utf-8"
        )
    for direction, name in (("en-ne", "val_meanings_en_ne.jsonl"), ("ne-en", "val_meanings_ne_en.jsonl")):
        rows = [x for x in val if x["direction"] == direction]
        (OUT / name).write_text(
            "\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n", encoding="utf-8"
        )

    meta = {
        "meanings_n": len(meanings),
        "train_ex": len(tr),
        "val_ex": len(val),
        "max_train_ex_cap": MAX_TRAIN_EX,
        "by_surface": by_surface,
        "schema": [
            "meaning_id",
            "english",
            "ne_formal",
            "ne_informal",
            "roman_formal",
            "roman_informal",
        ],
        "control_tokens": {
            "product": ["<en><ne><formal>", "<en><ne><informal>", "<ne><en>"],
            "model": ["<formal>", "<informal>", "(direction via en-indic / indic-en checkpoint)"],
            "note": "IndicTrans2 tokenizer treats <en> as a language tag; runtime maps product → model prefixes.",
        },
        "architecture": "one_mt_devanagari_canonical_plus_roman_layers",
        "bank_path": str(bank_path),
    }
    (OUT / "meaning_bank_manifest.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(meta, indent=2, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
