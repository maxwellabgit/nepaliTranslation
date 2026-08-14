# Local automatic training (this machine)

Train the **edge IndicTrans2 dist-200M** LoRA here overnight — do not use HF Jobs for this loop.

## Getting reviews onto this machine

**Automatic (recommended):** run `python training/review_sync_server.py` and use
**Settings → Advanced → Data review** on the phone. Details: `training/REVIEW_SYNC.md`.

**Manual fallback:** export JSON from Meaning Review, then:

```powershell
python training/route_corrections.py path\to\export.json
```

## When training fires

After reviews are routed (sync or manual export), the router increments
`edited_since_train`. When that counter hits **100**, it writes
`training/artifacts/auto_train_ready.json`.

## Run overnight

```powershell
# One-shot if ready
python training/local_auto_train.py --if-ready

# Or leave a daemon running (poll every 5 minutes)
python training/local_auto_train.py --daemon --poll-seconds 300
```

Optional Windows Task Scheduler (daily 1:00 AM):

```
Program: python
Arguments: C:\Users\maxwe\.cursor\nepaliTranslation\training\local_auto_train.py --if-ready
Start in: C:\Users\maxwe\.cursor\nepaliTranslation
```

## Pipeline steps

1. `prepare_cpu_mix.py` — clean bank + CPU jsonl (keeps `human_meaning_review`)
2. `finetune_it2_cpu.py --directions en-ne,ne-en`
3. `benchmarks/eval_it2_gold.py --systems it2_base,it2_cpu`
4. Reset `edited_since_train` to 0

Logs: `training/artifacts/auto_train_runs.jsonl`

## Founder skip queue

Skipped meanings land in `training/data/founder_review_queue.jsonl` for your later pass.
