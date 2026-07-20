# Everyday Roman Nepali — house style (v1)

Roman output is **not** scholarly IAST. It is everyday chat Roman that Nepali speakers type.

## Rules

1. No diacritics (`ā ī̃` → `a` / `i` / `n`).
2. Prefer common spellings: `tapai`, `timi`, `kaha`, `garnuhos`, `chha`/`cha`, `dhanyabad`, `kripya`.
3. Word boundaries follow Devanagari spaces; do not invent camelCase.
4. Punctuation: keep `. ? !` ; map `।` → `.`
5. Formal vs informal Roman must come from the **same** Devanagari register string (never invent a different meaning).

## Pipeline

```
MT model → Devanagari (canonical)
              ↓
     everyday_roman() renderer → UI Roman
```

## Input (noisy Roman)

```
tapai / tapaai / tapayi
    ↓ spelling normalizer (house map)
tapai
    ↓ roman→Devanagari (small layer / lexicon)
तपाईं
    ↓ <ne><en> translation model
English
```

Publish expansions of the spelling map in `mobile/src/mt/romanize.ts` and `training/build_meaning_bank.py` (`everyday_roman`).
