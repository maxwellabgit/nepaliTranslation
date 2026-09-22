# Data classification — public review, training, benchmarks

**Frozen:** 2026-09-22 (Gate 0)  
**Authority:** [`.governance/INTENT.md`](./INTENT.md), [`.governance/V1_G0_DECISIONS.md`](./V1_G0_DECISIONS.md)

## Classes

| Class | Meaning | May enter public review? | May train? | May evaluate ship quality? |
|-------|---------|--------------------------|------------|----------------------------|
| `benchmark_frozen` | Private gold / eval holdout | **No** (unless permanently retired from every manifest first) | **No** | **Yes** (only while in manifests) |
| `benchmark_copy` | Derivative of frozen gold (e.g. review packs that mirror gold) | **No** | **No** | Treat as frozen contamination risk |
| `license_hold` | Explicit provenance/license block | **No** until remediated | **No** until remediated | N/A |
| `pii_sensitive` | PII or unsafe content | **No** | **No** | N/A |
| `training_candidate` | Licensed train/val/source pool | Only if `public_review_eligible=true` after de-ID + dedupe | If `training_eligible=true` | **No** as evaluator |
| `public_review` | Actively assignable correction pool | Yes while `available`/`leased` | **No** once reviewed | **No** |
| `reviewed_retired` | Submitted public review | Terminal | **No** | **No** |
| `synthetic_qc` | Hidden known checks | Separate pool; does not consume daily ten | **No** (not from gold) | **No** |

## Hard rules

1. **Never** build contributor known-check sets from `benchmarks/gold/`, training holdouts, or private evaluation answers.
2. **Never** expose active frozen benchmark text for public correction.
3. If a benchmark item is made public, it must be **permanently retired** from every benchmark manifest first and **cannot** later return to training.
4. On public-review submission, atomically clear eligibility: `public_review_eligible=false`, `training_eligible=false`, `benchmark_eligible=false`.
5. Enforce exclusions in **SQL views / export jobs / CI**, not only client filters.
6. Importer must reconcile every source row to **included** or an **explicit exclusion reason** (idempotent dry-run manifest).

## Preliminary inventory (audit, tip `43f9bc6`)

Informational only — not a ship claim. Gate 1 importer must recompute.

| Source | Raw rows (approx.) |
|--------|-------------------:|
| Train/val clean + law/gov + conversation seeds + external candidates | 3,365 |
| Unique (direction, source, target, register) | ~773 |
| Overlap frozen evaluation text | 64 |
| License/provenance hold | 60 |
| Preliminary public-review candidates (pre PII/final license) | ~649 |
| `datasets/gold/` source/trusted rows (need normalize/dedupe) | 718 |
| Frozen `benchmarks/gold/` samples (must stay private) | 543 |

At ~649 preliminary items, runway is on the order of **tens of reviewer-days** at ten items/day if each item retires once. Continuous replenishment is required for scale. Product promise remains **up to 10**, not guaranteed inventory.
