# Launch (copy one)

Paste **exactly one** of these into a new Cursor agent. Do not combine.

## 1 — Eval integrity (start here)

```
Run line of effort 1 only (/eval-steward).
Read AGENTS.md and plans/active/eval-integrity.md.
Follow .agent/LOOP.md. Do not touch UI, MT decode, or training weights.
Stop at Done in .agent/DONE.md lane 1, or a concrete blocker.
Use /independent-reviewer before claiming complete.
```

## 2 — UI bugs

```
Run line of effort 2 only (/ui-hunter).
Read AGENTS.md and plans/active/ui-bugs.md.
Follow .agent/LOOP.md. Do not edit gold or training.
Stop at Done in .agent/DONE.md lane 2, or a concrete blocker.
Use /independent-reviewer before claiming complete.
```

## 3 — Translation accuracy (decode path)

```
Run line of effort 3 only (/mt-accuracy).
Read AGENTS.md and plans/active/mt-accuracy.md.
Follow .agent/LOOP.md. Do not edit gold references. Do not fine-tune.
Stop at Done in .agent/DONE.md lane 3, or a concrete blocker.
Use /independent-reviewer before claiming complete.
```

## 4 — App runtime / efficiency

```
Run line of effort 4 only (/app-runtime).
Read AGENTS.md and plans/active/app-runtime.md.
Follow .agent/LOOP.md. No visual redesign. No gold edits.
Stop at Done in .agent/DONE.md lane 4, or a concrete blocker.
Use /independent-reviewer before claiming complete.
```

## 5 — Model / on-device ship

```
Run line of effort 5 only (/model-ship).
Read AGENTS.md and plans/active/model-ship.md.
If GPU or model artifacts are missing, record the blocker and stop.
Do not invent eval numbers. Do not edit gold references.
Use /independent-reviewer before claiming complete.
```
