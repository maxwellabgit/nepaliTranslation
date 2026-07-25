# Automatic Meaning Review sync

Reviews land on this PC **as testers Accept / Skip**, without Share → AirDrop.

## How it works

1. Phone queues each completed review locally.
2. When **1** review is ready (or after **~3s** idle), it POSTs a batch to your PC.
3. `training/review_sync_server.py` writes the batch under
   `training/artifacts/review_sync_inbox/` and runs `route_corrections.py`.
4. Dedup by `event_id` so retries / re-exports do not double-count `edited_since_train`.

Manual **Export** in Meaning Review still works as a backup.

## In the app (testers)

TestFlight builds ship with sync **already on**. Endpoint + secret are baked into
`mobile/app.json` → `extra.reviewSync*`. Reviewers only:

1. Settings → Advanced → Meaning Review  
2. Password `1234`  
3. Accept / Skip  

No URL or secret entry. Advanced → Review sync is status + Sync now only.

## On this PC

Keep the server (and tunnel) running while people review:

```powershell
cd C:\Users\maxwe\.cursor\nepaliTranslation
$env:REVIEW_SYNC_SECRET = "neptranslate-sync-test-2026"
python training/review_sync_server.py --host 0.0.0.0 --port 8765

# separate terminal — URL must match app.json extra.reviewSyncEndpoint
.\tools\cloudflared.exe tunnel --url http://127.0.0.1:8765
```

If the Cloudflare quick-tunnel URL changes, update `app.json` `reviewSyncEndpoint`
and ship a new TestFlight build.

## Overnight train

```powershell
python training/local_auto_train.py --daemon --poll-seconds 300
```

When routed edits hit 100, `auto_train_ready.json` still triggers training.
