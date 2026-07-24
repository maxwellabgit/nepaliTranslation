# TestFlight

Offline iOS builds ship through Expo EAS → App Store Connect → TestFlight.

**Current target:** **1.4.5 → 1.5 track** — Honesty labels, paired Gold Review, Jest unit suite. **2.0 reserved for neural MT.**

**What this binary runs today:** offline **phrasebook + lexicon** MT + Apple speech recognition. IndicTrans2 LoRA adapters train offline and only ship after gold gates pass (see `mobile/docs/V2_FLEET_DECISION.md`).

## Build & submit

```powershell
cd mobile
npx eas build --platform ios --profile production --auto-submit
```

## On your iPhone

1. TestFlight → refresh **NepTranslate** → Update  
2. Confirm Settings → About: `v1.4.5`

App Store Connect: https://appstoreconnect.apple.com/apps/6792574384/testflight/ios

## What to verify

- **Auto** — type/speak; Formal/Informal; Devanagari/Roman; result label shows register+script  
- **Conversation** — Pass the phone; Roman toggle on Nepali originals  
- **Settings** — gear → About; Advanced → Gold Review  
- **Gold Review** — password `1234` → paired formal/informal or Deva/Roman → Correct both / Save & complete both / Undo / Export  
- **Benchmark strip** — chrF snapshot below the editors  
- **Keyboard** — tap outside fields dismisses; Devanagari needs globe-key (iOS cannot force script)  
- **Offline** — airplane mode; phrasebook still works  

## Gold → train loop

1. Gold Review → **Export** (Share/save JSON)  
2. `python benchmarks/apply_app_reviews.py reviews.json`  
3. `python benchmarks/pack_gold_for_app.py`  
4. Bump version → EAS build → submit  

## After overnight FT

```powershell
# Or let training/run_overnight_pipeline.py finish
python benchmarks/eval_it2_gold.py --systems it2_base,it2_big,it2_overnight --tag overnight_post
```

Ship adapters only if gates in `training/OVERNIGHT_FT_PLAN.md` pass.
