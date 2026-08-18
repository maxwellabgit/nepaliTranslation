# Independent review

The implementer does not get to certify its own work.

## How

1. Implementer finishes a milestone and updates the ExecPlan.
2. Parent launches `/independent-reviewer` with: lane id, diff summary, commands run, claimed Done items.
3. Reviewer reads the diff and the proof output. It does not trust the implementer's narrative.
4. Material findings go back into `plans/active/<lane>.md` as unchecked work.
5. Repeat until the reviewer has no material findings **or** a listed blocker.

## Material vs nit

- **Material:** wrong product behavior vs INTENT, gold contamination, register bugs, broken fallback, silent audio/MT cancel, eval gate skipped, scope creep (camera, extra languages, server MT).
- **Nit:** style, comments, optional refactors. Do not block Done on nits.

## Specialized extras

- UI lane: empty/loading/error, hit targets, Devanagari size, keyboard covering controls.
- MT / model lanes: gold leakage, four-model fragmentation, तँ slipping in, FLORES used as ship gate.
