# benchmarks/ — model history (fresh)

Each run is an immutable folder:

```
benchmarks/runs/<timestamp>_<tag>/
  meta.json       # model id, gold snapshot hash, git commit
  metrics.json    # chrF / exact / per-class
  predictions.jsonl  # optional sample preds
```

## Protocol

| Tag | When |
|-----|------|
| `prereview` | Current student vs **unreviewed** gold (start here) |
| `postreview` | Same student vs **fully reviewed** gold |
| `posttrain` | New LoRA / export vs reviewed gold |

```powershell
python datasets/scripts/run_baseline_bench.py --tag prereview
```

Do not overwrite old runs. Compare only runs that share the same `gold_snapshot` or explicitly re-bench both models on the new gold.
