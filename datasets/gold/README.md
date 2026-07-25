# gold/ — trusted sources

Primary English prompts, trusted Nepali, and high-trust parallel pairs.

```
gold/
  sources/
    english_seeds/     # short EN sentences by domain (*.jsonl)
    nepali_trusted/    # trusted NE-only or NE-primary docs
    parallel_trusted/  # high-trust EN↔NE pairs (human / meaning-bank hand seeds)
  manifests/
    inventory.json     # counts by domain (maintainer only)
```

**Train-eligible** after human or teacher approval.  
**Not** the eval holdout — that stays in repo `benchmarks/gold/` until freeze.
