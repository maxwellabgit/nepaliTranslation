# Phone → this PC data review

Review **gold benchmarks first**, then training meanings. Each card is edit-or-confirm, then **Send to PC**.

## On this PC (keep running while you review)

```powershell
cd C:\Users\maxwe\.cursor\nepaliTranslation
python training\review_sync_server.py
```

The server prints a Wi-Fi address such as `192.168.1.42`. Phone and laptop must be on the same network. Windows may ask to allow Python on port 8765 — allow it.

## On the phone

1. Settings → Advanced → **Data review**
2. Password `1234`
3. First time: paste the laptop address (IP is enough, e.g. `192.168.1.42`)
4. **Benchmark** deck: source + reference. **Send to PC** (as-is or after edits)
5. **Training** deck: same button for meaning-bank pairs
6. **Send pending** retries anything that failed to land

Mark incorrect / History → To training still use this same pipe; they land in `founder_review_queue.jsonl` for a later pass.

## What the PC does

| Send | File updated |
|------|----------------|
| Gold bench | `benchmarks/gold/{class}/sources.jsonl` + `references.jsonl`, then gold blocklist + in-app pack |
| Training meaning | `training/data/meaning_bank.jsonl` (provenance `human_meaning_review`) |
| Live / history flag | `training/data/founder_review_queue.jsonl` |

Gold never enters the LoRA mix. After gold is trusted, train + `eval_it2_gold.py` is a fair comparison.

Secret is baked (`neptranslate-sync-test-2026`) and must match the server. This is a home-LAN lock, not a public API.
