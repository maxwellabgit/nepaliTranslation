#!/usr/bin/env python3
"""
Seed domain-balanced short English sentences into:
  datasets/gold/sources/english_seeds/
  datasets/synthetic/english_pool/

Maintainer inventory (counts) goes to gold/manifests/inventory.json —
reviewer UI must not show totals.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GOLD_SEEDS = REPO / "datasets" / "gold" / "sources" / "english_seeds"
POOL = REPO / "datasets" / "synthetic" / "english_pool"
INV = REPO / "datasets" / "gold" / "manifests" / "inventory.json"

# Short traveler / daily sentences. Formality is applied at translate time.
SEEDS: dict[str, list[str]] = {
    "travel": [
        "Where is the bus stop?",
        "How much is a taxi to the airport?",
        "Please take me to Thamel.",
        "Is this the way to the temple?",
        "What time does the flight leave?",
        "I need a ticket to Pokhara.",
        "Can you show me on the map?",
        "How long will it take?",
        "Is there a restroom nearby?",
        "I am lost.",
        "Which way to the hotel?",
        "Does this bus go to Bhaktapur?",
        "Please stop here.",
        "I will wait outside.",
        "Is the road open today?",
        "Where can I buy a SIM card?",
        "How far is the station?",
        "I need change for a hundred.",
        "Is breakfast included?",
        "What time is checkout?",
    ],
    "health": [
        "I need a doctor.",
        "Where is the nearest pharmacy?",
        "I have a fever.",
        "My stomach hurts.",
        "I feel dizzy.",
        "I am allergic to peanuts.",
        "Please call an ambulance.",
        "Does this medicine need a prescription?",
        "I have a headache.",
        "I cannot breathe well.",
        "Is there a hospital nearby?",
        "I cut my hand.",
        "I need water.",
        "I feel sick.",
        "How often should I take this?",
        "I have high blood pressure.",
        "My child has a cough.",
        "Is this safe during pregnancy?",
        "I need a bandage.",
        "Can you help me?",
    ],
    "emergencies": [
        "Call the police.",
        "There has been an accident.",
        "I lost my passport.",
        "Someone stole my bag.",
        "I need the embassy.",
        "Please help me now.",
        "Where is the police station?",
        "I am in danger.",
        "Fire!",
        "I cannot find my child.",
        "My phone was stolen.",
        "I need to report a theft.",
        "Please stay with me.",
        "Do you speak English?",
        "I need a lawyer.",
        "This is an emergency.",
        "Call my hotel.",
        "I am locked out.",
        "I lost my wallet.",
        "Please translate for me.",
    ],
    "food": [
        "I would like tea.",
        "Is this spicy?",
        "No meat, please.",
        "I am vegetarian.",
        "The bill, please.",
        "Is water free?",
        "What do you recommend?",
        "I am allergic to dairy.",
        "Can I get this without onion?",
        "How much is this?",
        "One more plate, please.",
        "Is this fresh?",
        "I do not eat beef.",
        "Coffee with milk.",
        "That was delicious.",
        "Too spicy for me.",
        "Can we sit outside?",
        "Do you have rice?",
        "I will take the set meal.",
        "Please pack this to go.",
    ],
    "lodging": [
        "Do you have a room for tonight?",
        "I have a reservation.",
        "Is there Wi‑Fi?",
        "The key does not work.",
        "Can I leave my luggage?",
        "Is there hot water?",
        "Please clean the room.",
        "The air conditioning is broken.",
        "I need an extra towel.",
        "What time is breakfast?",
        "Can I extend my stay?",
        "Is parking available?",
        "The room is too noisy.",
        "I need a quiet room.",
        "Is there a safe in the room?",
        "Please call a taxi.",
        "Where is the elevator?",
        "I locked myself out.",
        "Can I pay by card?",
        "Thank you for your help.",
    ],
    "shopping": [
        "How much does this cost?",
        "Can you go lower?",
        "I will take it.",
        "Do you have a smaller size?",
        "Can I try this on?",
        "Do you accept dollars?",
        "I need a bag.",
        "Is this handmade?",
        "Where was this made?",
        "I am just looking.",
        "Do you have change?",
        "Too expensive.",
        "What is your best price?",
        "I will come back later.",
        "Can you wrap this as a gift?",
        "Is there a warranty?",
        "I need batteries.",
        "Where is the market?",
        "Open later today?",
        "Thank you.",
    ],
    "family": [
        "This is my wife.",
        "This is my husband.",
        "These are my children.",
        "How old are you?",
        "I miss my family.",
        "My parents are visiting.",
        "We are on holiday.",
        "She is my sister.",
        "He is my brother.",
        "We have two kids.",
        "My son is sick.",
        "Can the children play here?",
        "We need a family room.",
        "My daughter loves momos.",
        "Please meet my friend.",
        "We are traveling together.",
        "I am here alone.",
        "My mother does not speak English.",
        "Please speak slowly.",
        "They are tired.",
    ],
    "government": [
        "Where is the immigration office?",
        "I need a visa extension.",
        "Where do I pay the fee?",
        "What documents do I need?",
        "Is this form correct?",
        "How long will it take?",
        "I need a stamp.",
        "Where is the tourist police?",
        "I lost my documents.",
        "Can I get a receipt?",
        "Is the office open today?",
        "Who should I talk to?",
        "I have an appointment.",
        "Please check this passport.",
        "I need a copy.",
        "Where is the bank?",
        "I need to exchange money.",
        "Is there a queue?",
        "Please wait here.",
        "Thank you for your patience.",
    ],
    "questions_requests": [
        "Can you help me?",
        "Could you repeat that?",
        "Please speak slowly.",
        "What does this mean?",
        "Where can I find that?",
        "May I sit here?",
        "Would you like tea?",
        "Can we meet tomorrow?",
        "Please wait a moment.",
        "Is that okay?",
        "Could you write it down?",
        "Can you show me?",
        "Please tell me again.",
        "Do you understand?",
        "I do not understand.",
        "One moment, please.",
        "After you.",
        "Excuse me.",
        "Sorry.",
        "You are welcome.",
    ],
    "pronouns_honorifics": [
        "How are you?",
        "What is your name?",
        "Where are you from?",
        "Please come in.",
        "Please sit down.",
        "Please give me water.",
        "Please wait.",
        "Are you busy?",
        "Do you work here?",
        "Can you come with me?",
        "Please listen.",
        "Please look at this.",
        "Where do you live?",
        "What do you do?",
        "Please take this.",
        "Please open the door.",
        "Please close the window.",
        "Are you ready?",
        "Please call me.",
        "Please tell him.",
    ],
    "numbers_money": [
        "How much is twenty?",
        "I need five hundred rupees.",
        "That is too much.",
        "Can you break a thousand?",
        "I only have a card.",
        "Is cash okay?",
        "Half price?",
        "Two tickets, please.",
        "Three people.",
        "Room for four.",
        "It costs fifty.",
        "Give me ten.",
        "I paid already.",
        "Keep the change.",
        "I need a receipt for one thousand.",
        "What is the total?",
        "Add twenty percent.",
        "Minus fifty.",
        "Around two hundred.",
        "Exactly one hundred.",
    ],
    "core_grammar": [
        "This is good.",
        "That is not right.",
        "I am fine.",
        "It is raining.",
        "He is coming.",
        "She is waiting.",
        "We are ready.",
        "They are late.",
        "I do not know.",
        "I understand.",
        "I agree.",
        "I disagree.",
        "It is possible.",
        "It is impossible.",
        "This is mine.",
        "That is yours.",
        "Here it is.",
        "There it is.",
        "Not now.",
        "Maybe later.",
    ],
}


def main() -> None:
    GOLD_SEEDS.mkdir(parents=True, exist_ok=True)
    POOL.mkdir(parents=True, exist_ok=True)
    INV.parent.mkdir(parents=True, exist_ok=True)

    inventory: dict[str, int] = {}
    pool_rows: list[dict] = []
    n = 0
    for domain, sentences in SEEDS.items():
        out_path = GOLD_SEEDS / f"{domain}.jsonl"
        lines = []
        for i, en in enumerate(sentences, 1):
            en = en.strip()
            if not en:
                continue
            row = {
                "id": f"{domain}_{i:04d}",
                "domain": domain,
                "english": en,
                "unit": "sentence",
                "source": "hand_seed_v1",
            }
            lines.append(json.dumps(row, ensure_ascii=False))
            pool_rows.append(row)
            n += 1
        out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        inventory[domain] = len(lines)

    pool_path = POOL / "en_pool_v1.jsonl"
    pool_path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in pool_rows) + "\n",
        encoding="utf-8",
    )
    INV.write_text(
        json.dumps(
            {
                "packed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "n_english_seeds": n,
                "by_domain": inventory,
                "pool": str(pool_path.relative_to(REPO)),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {n} English seeds across {len(inventory)} domains")
    print(f"  gold: {GOLD_SEEDS}")
    print(f"  pool: {pool_path}")


if __name__ == "__main__":
    main()
