# Quality loop

Mechanical. Not “try harder.”

```
READ INTENT + AGENTS.md + this lane's ExecPlan
        ↓
INSPECT the real files (do not assume)
        ↓
PLAN  (update ExecPlan; pick the smallest next milestone)
        ↓
IMPLEMENT  (this lane only)
        ↓
RUN the lane's commands from DONE.md
        ↓
INSPECT  (output, not just exit code)
        ↓
INDEPENDENT REVIEW  (/independent-reviewer, fresh context)
        ↓
findings? —YES→ FIX → RUN → REVIEW
        ↓ NO
UPDATE ExecPlan + durable docs
        ↓
STOP only if Done or a concrete blocker
```

## Non-negotiable

- Work milestone by milestone. Do not mark a milestone complete because TypeScript compiled.
- Treat reviewer findings as new work items in the ExecPlan.
- If the lane's proof command cannot run (missing weights, no iPhone, no GPU), write the blocker and stop. Do not skip the gate and call it Done.
