Task: Reduce drift with the smallest patch.

Inputs:
- .governance/INTENT.md
- .governance/reports/drift_latest.md

Rules:
- Touch only files required to resolve drift reasons.
- Avoid unrelated cleanup.
- If you must change behavior, add/update tests only if they already exist in the project.

Process:
1) Restate which drift reasons you are fixing.
2) Implement minimal patch.
3) Run: python scripts/steward.py
4) Confirm drift_score decreased.
5) Report: files changed + new drift_score.
