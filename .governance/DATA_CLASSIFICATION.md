# Data classification — public review, training, benchmarks

**Living contract:** 2026-09-23
**Authority:** [`.governance/INTENT.md`](./INTENT.md), [`.governance/V1_G0_DECISIONS.md`](./V1_G0_DECISIONS.md), [`plans/active/v1-final-contract-reconciliation.md`](../plans/active/v1-final-contract-reconciliation.md)

## Living rules (deny by default)

Public-review eligibility is deny-by-default. Unresolved rights are `admin_only`.

| Class | Meaning | Public review | Train | Evaluate ship quality |
|-------|---------|---------------|-------|------------------------|
| `training_source` | Training or dataset row | Only when rights are `cleared_public_display`, license and provenance are recorded, and every other eligibility predicate below passes | Not from public-review exposure. Exposed hashes are excluded from future training exports | No |
| `benchmark_source` | Benchmark row, including gold | Same rights bar. Importing into review does not edit gold files | No | Compromised for future eval once the source or target hash is publicly exposed |
| `collected_user` | Account-linked or user-collected text | Only after an anonymization certificate (`certified`) plus cleared public-display rights | No, unless a certified irreversible derivative says otherwise | No |
| `raw_media` | Speech recordings, Camera photos | **No** in V1. Private buckets only | No | No |
| `pii_sensitive` / `prohibited` | PII, unsafe, or rights-prohibited | No | No | No |
| `planned_private` | Assigned to a future window | Not publicly readable | No | No |
| `exposed` | Window opened or item served | Already public; terminal for re-selection after a substantive review; no-review items may recycle | **Excluded** by source and target hash | **Excluded** by source and target hash |
| `synthetic_qc` | Separately curated known checks | Separate pool; never copied from gold | No | No |

Rights values: `cleared_public_display`, `admin_only`, `unresolved`, `prohibited`.

Anonymization values: `not_required`, `pending`, `certified`, `failed`.

A collected row is publicly eligible only when all of these hold:

- explicit eligible flag;
- `cleared_public_display`;
- anonymization `certified` when the row is collected/user data;
- not previously substantively reviewed;
- not quarantined;
- not already planned or open;
- not export-excluded for a conflicting reason.

`unresolved` rights are stored and treated as `admin_only`. Do not label audio or photos anonymous because EXIF or `user_id` was removed. A certification record for an anonymized derivative states processor version, fields transformed or removed, re-identification assessment, reviewer, and timestamp.

Every train and eval exporter must use one fail-closed exclusion boundary. An empty exclusion manifest is not proof. Direct raw-table export is unsupported.

The inventory snapshot below is a **historical audit at `43f9bc6`**. It is not a claim that those rows are publicly eligible. Gate C2 re-inventories every source and records rights. Do not rewrite these counts.

## Historical rules (2026-09-22 Gate 0)

The section below recorded an earlier owner directive that marked training and benchmark rows eligible after PII/dedup only, and that paid a length percentile. That directive is superseded. The text is kept as history.

**Frozen:** 2026-09-22 (Gate 0; amended per owner directive then in force)
**Authority at that date:** INTENT and V1_G0_DECISIONS as they stood on 2026-09-22

## Classes

| Class | Meaning | May enter public review? | May train? | May evaluate ship quality? |
|-------|---------|--------------------------|------------|----------------------------|
| `training_source` | Row imported from `datasets/` or `training/` | **Yes** (V1: all eligible) | Only after separate verification migration | **No** as evaluator |
| `benchmark_source` | Row imported from `benchmarks/` (including `gold/`) | **Yes** for V1 review; **not** used to grade the model while it is also in the eval manifest | **No** | **Yes**, until it is also assigned as a review item; then treat its evaluator value as compromised for the amended eval |
| `pii_sensitive` | PII or unsafe content | **No** | **No** | N/A |
| `public_review` | Active pool row (`available` / `leased`) | **Yes** | **No** | **No** |
| `reviewed_terminal` | Submitted / rewarded row | Terminal | Only after separate verification migration | **No** |
| `synthetic_qc` | Hidden known checks | Separate pool; does not consume the daily ten | **No** (not from gold) | **No** |

## Historical V1 rules (superseded 2026-09-23)

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

Historical D2 statement, superseded on 2026-09-23: under that old directive, every one of those rows was treated as a candidate for `public_review_eligible=true` after PII/dedup. The living rules above do not. Unresolved rights stay `admin_only`.
