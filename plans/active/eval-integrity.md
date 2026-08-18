# eval-integrity: Keep the gold gate honest

## Goal
Make `benchmarks/gold/` a trustworthy holdout: schema-valid, register-pure, not used for training, freeze story intact.

## Context
- Paths: `benchmarks/gold/`, `benchmarks/README.md`, `benchmarks/gold/README.md`, eval scripts under `benchmarks/`
- Constraints: never train on gold; do not use FLORES as the ship gate; EN↔NE only
- Related: lane 3 consumes scores; this lane owns the measuring stick

## Done when
Lane 1 checklist in `.agent/DONE.md`.

## Milestones
- [ ] Inventory gold classes, manifests, freeze/baseline files
- [ ] Check training docs/scripts for gold leakage
- [ ] Spot-check register purity (तपाईं vs तिमी) on a sample of each EN→NE class
- [ ] Confirm schema + curation rules still match INTENT
- [ ] Independent review
- [ ] Record commands and remaining risks

## Progress
Not started. First run should begin at milestone 1.

## Surprises & discoveries

## Decision log

## Commands that actually ran (paste)

## Remaining work
All milestones.

## Blockers
