# eval-integrity: Keep the gold gate honest

## Goal
Make `benchmarks/gold/` a trustworthy holdout: schema-valid, register-pure, not used for training, freeze story intact.

## Context
- Paths: `benchmarks/gold/`, `benchmarks/README.md`, `benchmarks/gold/README.md`, eval scripts under `benchmarks/`
- Constraints: never train on gold; do not use FLORES as the ship gate; EN↔NE only; never rewrite gold references to raise a score
- Related: lane 3 consumes scores; this lane owns the measuring stick
- Gold-domain FT (`finetune_it2_gold.py`, `train_gold_domain.jsonl`) is domain data with holdout blocked — not leakage

## Done when
Lane 1 checklist in `.agent/DONE.md`.

## Milestones
- [x] Inventory gold classes, manifests, freeze/baseline files
- [x] Check training docs/scripts for gold leakage
- [x] Spot-check register purity (तपाईं vs तिमी) on each EN→NE class (full set, not a tiny sample)
- [x] Confirm schema + curation rules still match INTENT
- [x] Add no-GPU integrity script; run it; paste output
- [x] Refresh freeze + blocklist after a clean audit; one freeze story in docs
- [x] Independent review (round 1 FAIL → छस् stick + fill_gold guard; round 2 PASS)
- [x] Record commands and remaining risks

## Progress
Lane 1 implementation complete pending re-review. Round-1 independent review **FAIL** (तिमी+छस्; fill_gold could wipe freeze). Both fixed. Integrity script PASSes. GPU `eval_it2_gold.py` not run (weights missing).

## Surprises & discoveries

### Inventory (verified, not assumed)
Every class: `n sources == n references == manifest n_filled`; ids join; no duplicate ids; no duplicate `source|||reference` pairs.

| Class | Live n | Premium | Freeze 2026-07-20 n | Delta |
|-------|-------:|--------:|--------------------:|------:|
| `en_ne_formal` | 137 | 35 | 135 | +2 |
| `en_ne_informal` | 139 | 37 | 137 | +2 |
| `ne_en_deva` | 133 | 32 | 132 | +1 |
| `ne_en_roman` | 134 | 33 | 133 | +1 |
| **Total** | **543** | | **537** | **+6** |

### +6-row drift (exact)
Commit `81cdbb4` (2026-07-25, “love/like Kathmandu gold”) added these ids after `gold_freeze.json` (`frozen_at` 2026-07-20T16:52:34Z):

| Id | Source | Reference |
|----|--------|-----------|
| `en_ne_formal-136` | I love Kathmandu. | मलाई काठमाडौं मन पर्छ। |
| `en_ne_formal-137` | I like Kathmandu. | मलाई काठमाडौं मन पर्छ। |
| `en_ne_informal-138` | I love Kathmandu. | मलाई काठमाडौं मन पर्छ। |
| `en_ne_informal-139` | I like Kathmandu. | मलाई काठमाडौं मन पर्छ। |
| `ne_en_deva-133` | मलाई काठमाडौं मन पर्छ। | I like Kathmandu. |
| `ne_en_roman-134` | malai kathmandu man parcha | I like Kathmandu. |

Same English with two wordings (`love` / `like`) sharing one Nepali reference is intentional (word-choice stick). Not a duplicate pair.

SHA256 (pre-refresh) all mismatched vs freeze for sources/references/manifest in every class.

### Doc drift (reconciled)
Three incompatible “gates” existed:

1. `schema.json` `n_target: 100`
2. `gold_baseline.md` **400/400** and n=100
3. Live gold 543 / freeze 537

**Decision:** they are two gates. Phrasebook floor (v1.4.0, n=100) stays labeled historical. IT2 ship-gate freeze is SHA+counts of the live holdout. Schema now has `n_target_base: 100` and `n_target` = frozen class size.

### Leakage
- `prepare_cpu_mix.py` used only the stale freeze blocklist (no live gold scan). `build_meaning_bank.py` / `prepare_ft_data.py` already scanned live gold.
- Real leak: `code_switch_names_00001` English **I love Kathmandu.** in meaning_bank + CPU train jsonl + review packs + datasets gold copies. Nepali in train was `म काठमाडौंलाई माया गर्छु।` (the calque gold is designed to catch) — still a holdout **source** leak.
- Removed that meaning from train artifacts. Hand seed in `build_meaning_bank.py` retargeted to **I love Pokhara.**
- `train_gold_domain.jsonl` is gitignored / deleted junk — not treated as leakage.
- Traveler seed CSV / `train_user_conversation_seeds.jsonl` still contain everyday phrases that overlap gold (WARN). Prepare scripts drop them at ingest. Not deleted from the input pools.

### Register (full EN→NE set)
- Formal: 29 तपाईं-class, 0 तिमी, 0 तँ, 0 तिमी+नुहोस् mixes. 108 lines have neither pronoun (impersonal / कृपया+honorific verb).
- Informal: 29 तिमी-class, 0 तपाईं, 0 तँ, 0 mixes after the stick fix below. 110 neither-pronoun.
- Round-1 review found two **तिमी + तँ-copula छस्** measuring-stick errors (not तिमी+नुहोस्):
  - `en_ne_informal-014` के तिमी भोकाएको छस्? → **छौ?**
  - `en_ne_informal-105` तिमी कति बेरदेखि पर्खिरहेको छस्? → **छौ?**
- Integrity now flags `छस्` / `गर्छस्`. **Mixed-register ids after fix: none.**
- False friend: `en_ne_informal-132` contains **हजुरआमा** (kinship term), not honorific हजुर. Not flagged.

## Decision log
- Do not rewrite gold refs for score inflation (none rewritten).
- Do not treat gold-domain FT as leakage.
- Refresh freeze only after inventory + register + train-leak were clean.
- Include roman `deva` fields in the train blocklist (previously missing; 91 live strings absent from the old list, mostly punctuation-stripped roman Devanagari).
- Phrasebook floor and IT2 freeze remain two labeled artifacts.
- Do not run `eval_it2_gold.py` without weights.
- Round-1 review FAIL: treat तिमी+छस् as a stick error; guard `fill_gold.py`.

## Commands that actually ran (paste)

Pre-refresh (expected FAIL on freeze drift + stale blocklist):

```
python3 benchmarks/check_gold_integrity.py
```

```
gold integrity
  freeze_file: benchmarks/results/gold_freeze.json
  freeze.frozen_at: 2026-07-20T16:52:34.129062+00:00
  inventory:
    en_ne_formal: sources=137 refs=137 n_filled=137 n_premium=35
    en_ne_informal: sources=139 refs=139 n_filled=139 n_premium=37
    ne_en_deva: sources=133 refs=133 n_filled=133 n_premium=32
    ne_en_roman: sources=134 refs=134 n_filled=134 n_premium=33
  freeze vs live:
    en_ne_formal: live_n=137 freeze_n=135 delta=2 sha_ok=False
      +2 ids: ['en_ne_formal-136', 'en_ne_formal-137']
    en_ne_informal: live_n=139 freeze_n=137 delta=2 sha_ok=False
      +2 ids: ['en_ne_informal-138', 'en_ne_informal-139']
    ne_en_deva: live_n=133 freeze_n=132 delta=1 sha_ok=False
      +1 ids: ['ne_en_deva-133']
    ne_en_roman: live_n=134 freeze_n=133 delta=1 sha_ok=False
      +1 ids: ['ne_en_roman-134']
  blocklist: n=669 live_gold=760 missing=91
  register:
    en_ne_formal: n=137 तपाईं=29 तिमी=0 neither=108 flagged=0
    en_ne_informal: n=139 तपाईं=0 तिमी=29 neither=110 flagged=0
  mixed-register ids: (none)
  leakage FAIL paths: (none)
  IT2 weights: MISSING — do not run benchmarks/eval_it2_gold.py. Integrity script is the lane-1 gate.
  issues: 5
    [freeze_drift] ... +6 rows ...
    [blocklist_incomplete] blocklist missing 91 live gold strings
  result: FAIL
```

Refresh (after audit clean):

```
python3 benchmarks/check_gold_integrity.py --update-freeze
```

```
updated freeze .../gold_freeze.json frozen_at=2026-08-18T07:38:03.370149+00:00 blocklist sources=493 refs=394
...
  result: PASS
```

Post-refresh after register stick fix (CI-style; this is the lane gate):

```
python3 benchmarks/check_gold_integrity.py
python3 benchmarks/fill_gold.py   # must refuse
```

```
gold integrity
  freeze_file: benchmarks/results/gold_freeze.json
  freeze.frozen_at: 2026-08-18T07:48:20.181204+00:00
  inventory:
    en_ne_formal: sources=137 refs=137 n_filled=137 n_premium=35
    en_ne_informal: sources=139 refs=139 n_filled=139 n_premium=37
    ne_en_deva: sources=133 refs=133 n_filled=133 n_premium=32
    ne_en_roman: sources=134 refs=134 n_filled=134 n_premium=33
  freeze vs live:
    en_ne_formal: live_n=137 freeze_n=137 delta=0 sha_ok=True
    en_ne_informal: live_n=139 freeze_n=139 delta=0 sha_ok=True
    ne_en_deva: live_n=133 freeze_n=133 delta=0 sha_ok=True
    ne_en_roman: live_n=134 freeze_n=134 delta=0 sha_ok=True
  blocklist: n=760 live_gold=760 missing=0
  register:
    en_ne_formal: n=137 तपाईं=29 तिमी=0 neither=108 flagged=0
    en_ne_informal: n=139 तपाईं=0 तिमी=29 neither=110 flagged=0
  mixed-register ids: (none)
  leakage FAIL paths: (none)
  leakage WARN (ingest pools, filtered by prepare_*):
    training/data/train_user_conversation_seeds.jsonl: n=93
    training/data/external/nepali_translation_gold_candidates.csv: n=93
  IT2 weights: MISSING — do not run benchmarks/eval_it2_gold.py. Integrity script is the lane-1 gate.
  issues: 0
  result: PASS
```

`fill_gold.py` without `--force-overwrite-scaffold` exits 1: refuses to overwrite live 137/139/133/134 with the 100-row scaffold.

`python3 -m py_compile` on the touched Python files: ok.

Not run: `benchmarks/eval_it2_gold.py` — no IT2 weights under `training/artifacts/` (only `.gitkeep`).

## Remaining work
- Human: overnight GPU `eval_it2_gold.py` vs the new freeze once weights exist.
- Optional later: re-run `prepare_cpu_mix.py` so `cpu_mix_manifest.json` `gold_blocklist_n` matches 760 (current file still records 599 from 2026-08-13). Not required for holdout honesty; bank already scrubbed.
- WARN ingest pools still contain gold-overlapping traveler phrases; ingest filters them. Could scrub the pools in a later pass if we want belt-and-suspenders.
- `.agent/DONE.md` lives on the harness branch, not this lane PR. Lane 1 checklist was applied from that file.

## Blockers
- **IT2 weights missing** on this machine. Lane 1 Done does not require GPU eval; the no-GPU integrity script is the gate. Recorded so lane 5 / lane 3 do not invent IT2 scores.
