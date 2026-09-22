# Data classification — public review, training, benchmarks

**Frozen:** 2026-09-22 (Gate 0; amended per owner directive)
**Authority:** [`.governance/INTENT.md`](./INTENT.md), [`.governance/V1_G0_DECISIONS.md`](./V1_G0_DECISIONS.md)

## Classes

| Class | Meaning | May enter public review? | May train? | May evaluate ship quality? |
|-------|---------|--------------------------|------------|----------------------------|
| `training_source` | Row imported from `datasets/` or `training/` | **Yes** (V1: all eligible) | Only after separate verification migration | **No** as evaluator |
| `benchmark_source` | Row imported from `benchmarks/` (including `gold/`) | **Yes** for V1 review; **not** used to grade the model while it is also in the eval manifest | **No** | **Yes**, until it is also assigned as a review item; then treat its evaluator value as compromised for the amended eval |
| `pii_sensitive` | PII or unsafe content | **No** | **No** | N/A |
| `public_review` | Active pool row (`available` / `leased`) | **Yes** | **No** | **No** |
| `reviewed_terminal` | Submitted / rewarded row | Terminal | Only after separate verification migration | **No** |
| `synthetic_qc` | Hidden known checks | Separate pool; does not consume the daily ten | **No** (not from gold) | **No** |

## V1 rules

1. Import **every** row from `datasets/`, `training/`, and `benchmarks/` into `review_source_items`. Redact PII, dedupe by content hash, record license/provenance metadata, then set `public_review_eligible=true` unless flagged `pii_sensitive`.
2. At each 5:00 PM America/New_York rotation, choose **10 items at random** from eligible rows for the next global window.
3. Snapshot **length-tier** on each assignment: items in the top 50% of `source_char_length_rank` at assignment time earn **2 credits**; the rest earn **1 credit**. 1 credit = 15 minutes ad-free.
4. **Do not** promote submissions back into training corpora or benchmarks. The importer is one-way for V1; a later verified export gate (out of scope for G1) decides what may re-enter training / evaluation.
5. Contributor known checks remain **separately curated synthetic** rows. Never copy them from `benchmarks/gold/`, training holdouts, or private evaluation answers.
6. Enforce exclusions (PII, duplicate content hash) in **SQL views / export jobs / CI**, not only client filters.
7. Importer must reconcile every source row to **included** or an **explicit exclusion reason** (idempotent dry-run manifest).

## Preliminary inventory (audit, tip `43f9bc6`)

Informational only — the Gate 1 importer recomputes counts.

| Source | Raw rows (approx.) |
|--------|-------------------:|
| Train/val clean + law/gov + conversation seeds + external candidates | 3,365 |
| Unique (direction, source, target, register) | ~773 |
| `datasets/gold/` source/trusted rows | 718 |
| Frozen `benchmarks/gold/` samples | 543 |

Under D2, every one of those rows is a candidate for `public_review_eligible=true` after PII/dedup.
