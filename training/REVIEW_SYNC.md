# Meaning Review sync (retired for product)

The temporary Cloudflare / LAN review-sync path (`reviewSync.ts`, baked
`reviewSyncEndpoint` / `reviewSyncSecret`, and Meaning Review password `1234`)
was removed in beta Slice 04.

Product corrections use the in-app correction sheet + offline outbox and
Supabase `submit-translation-report` / `sync-contribution-outbox`.

`training/review_sync_server.py` may still exist for founder experiments on a
dev machine. Do not bake its URL or secret into the App Store / TestFlight
bundle.
