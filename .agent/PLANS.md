# ExecPlan contract

Every lane keeps one living plan at `plans/active/<lane>.md`. Another stateless agent must be able to open that file and continue.

## Required sections

```markdown
# <lane-id>: <one-line goal>

## Goal
## Context (paths, commands, constraints)
## Done when (copy the lane checklist from DONE.md)
## Milestones
- [ ] ...
## Progress
## Surprises & discoveries
## Decision log
## Commands that actually ran (paste)
## Remaining work
## Blockers (concrete; cannot be solved from this repo)
```

## Rules

- Update Progress after every milestone. Do not leave a stale plan.
- Record the exact commands you ran, including failures.
- If you change a design choice, append a Decision log line. Do not silently reverse INTENT.
- When the lane is actually Done, move the file to `plans/completed/` and leave a one-line stub in `plans/active/` pointing at the completed plan.
