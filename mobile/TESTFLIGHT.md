# TestFlight

Offline iOS builds ship through Expo EAS → App Store Connect → TestFlight.

**Current target:** **1.5.0** — First traveler release. Honest phrasebook UX, Formal/Roman chip stability, suggested phrases, Gold Review lane chips fixed.

**What this binary runs today:** offline **phrasebook + lexicon** MT + Apple speech recognition. It is **not** a full on-device neural model yet. IndicTrans2 ships later after gold gates pass.

## Build & submit

```powershell
cd mobile
npx eas build --platform ios --profile production --auto-submit
```

## On your iPhone

1. TestFlight → refresh **NepTranslate** → Update  
2. Confirm Settings → About: `v1.5.0`

App Store Connect: https://appstoreconnect.apple.com/apps/6792574384/testflight/ios

## What to verify

- **Auto** — type/speak; Formal/Informal; Devanagari/Roman; result label shows `saved phrase` or `word guess`  
- **Misses** — free chat without a phrase shows “No saved phrase yet” + quick suggestions (not a blank model failure)  
- **Conversation** — Pass the phone; empty Pass blocked; Roman toggle on Nepali originals  
- **Tabs** — switching Auto ↔ Conversation stops mic/TTS cleanly  
- **Settings** — About honesty copy; Advanced → Gold Review  
- **Gold Review** — password `1234` → compact lane chips → targets visible  
- **Offline** — airplane mode; phrasebook still works (Apple voice may not)

## Gold → train loop

1. Gold Review → **Export** (Share/save JSON)  
2. `python benchmarks/apply_app_reviews.py reviews.json`  
3. `python benchmarks/pack_gold_for_app.py`  
4. Bump version → EAS build → submit  
