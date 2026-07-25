# Automatic Meaning Review sync

Reviews can land on this PC **as you Accept / Skip** (batched), without Share → AirDrop.

## How it works

1. Phone queues each completed review locally.
2. When **1** review is ready (or after **~3s** idle), it POSTs a batch to your PC.
3. `training/review_sync_server.py` writes the batch under
   `training/artifacts/review_sync_inbox/` and runs `route_corrections.py`.
4. Dedup by `event_id` so retries / re-exports do not double-count `edited_since_train`.

Manual **Export** in Meaning Review still works as a backup.

## On this PC

```powershell
cd C:\Users\maxwe\.cursor\nepaliTranslation
$env:REVIEW_SYNC_SECRET = "pick-a-long-random-secret"
python training/review_sync_server.py --host 0.0.0.0 --port 8765
```

Leave that window open while reviewing.

Same Wi‑Fi: `http://YOUR-PC-LAN-IP:8765` (local networking is allowed in the app).

### Reachable from TestFlight (cellular / away from home Wi‑Fi)

Use a temporary HTTPS tunnel:

```powershell
# install once: winget install Cloudflare.cloudflared
cloudflared tunnel --url http://127.0.0.1:8765
```

Copy the `https://….trycloudflare.com` URL.
## In the app

Settings → Advanced → **Review sync**

1. Turn **Sync enabled** on  
2. Paste endpoint URL (tunnel or LAN)  
3. Paste the same secret as `REVIEW_SYNC_SECRET`  
4. Optional: tap **Sync now** to flush the queue  

While reviewing, batches upload in the background. Pending count shows under Review sync.

## Overnight train (unchanged)

Keep the auto-train daemon running separately:

```powershell
python training/local_auto_train.py --daemon --poll-seconds 300
```

When routed edits hit 100, `auto_train_ready.json` still triggers training.
