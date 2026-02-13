Task: Run drift check and interpret it.

Steps:
1) Run: python scripts/steward.py
2) Read: .governance/reports/drift_latest.md
3) Summarize:
   - drift_score
   - reasons
   - top changed areas/files (from report)
4) If drift_score >= 0.60:
   - stop feature work
   - propose a minimal repair plan (max 5 steps)
   - list exact files you would change
Do NOT implement repairs unless the user explicitly says: "go fix it now".
