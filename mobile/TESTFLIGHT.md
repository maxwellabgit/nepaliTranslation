# TestFlight

**Current target:** **1.6.2 (35)** — Data review: gold bench then training, Send to PC on the same Wi-Fi.

## Data review → this PC

1. On the PC: `python training\review_sync_server.py`
2. Settings → Advanced → Data review (password `1234`)
3. Enter the laptop address printed by the server
4. Benchmark first, then Training · **Send to PC**

See `training/REVIEW_SYNC.md`.

## Build

```powershell
cd mobile
npx eas build --platform ios --profile production --auto-submit --non-interactive
```
