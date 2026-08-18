# mt-accuracy: Better translations on the decode path

## Goal
Improve on-device EN↔NE output via phrase overlay, lexicon, romanize, and mashup refusal — without touching gold answers or training weights unless lane 5 is explicitly in play (it is not).

## Context
- Paths: `mobile/src/mt/`, `mobile/scripts/verify_translate_fix.mjs`, `mobile/scripts/verify_romanize.mjs`, `mobile/scripts/export_meaning_lexicon.mjs`
- Gate: `cd mobile && npm run verify:translate`
- Architecture: `training/ARCHITECTURE.md` — one IT2 family; informal = तिमी
- Gold is read-only. If `eval_it2_gold.py` cannot run, no quality claim.

## Done when
Lane 3 checklist in `.agent/DONE.md`.

## Milestones
- [ ] Map decode path: phrase overlay → lexicon → neural → romanize
- [ ] Confirm mashup refusal still holds (`verify_translate_fix.mjs` cases)
- [ ] Fix the smallest accuracy bug that scripts or gold *would* catch
- [ ] Re-run verify scripts
- [ ] Independent review

## Progress
Not started.

## Surprises & discoveries

## Decision log

## Commands that actually ran (paste)

## Remaining work
All milestones.

## Blockers
