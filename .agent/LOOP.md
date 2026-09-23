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

- A pushed SHA, a clean merge, or a green TypeScript compile does not close C0–C15.
- Keep going through every code-owned gate whose proof can run in this environment. Do not stop after one gate.
- Do not stop because the progress file says WAITING_HUMAN while code, tests, or docs can still move.
- Internal TestFlight and public V1 stay NO-GO until the plan's proofs pass. The model certificate is one of those proofs.
- Treat reviewer findings as new work items in the ExecPlan.
- If the lane's proof command cannot run (missing weights, no iPhone, no GPU), write the blocker and stop. Do not skip the gate and call it Done.
