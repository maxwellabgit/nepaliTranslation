# Maestro flows (physical iPhone / iPad)

**Status:** YAML stubs for native smoke. They do **not** prove Windows Playwright parity.

Requires: development or TestFlight build installed, Maestro CLI on PATH, `appId: com.neptranslate.app`.

```bash
cd mobile
maestro test .maestro/smoke_tabs.yaml
maestro test .maestro/translate-empty.yaml
maestro test .maestro/camera-tab.yaml
maestro test .maestro/learn-alphabet.yaml
maestro test .maestro/ui-lang-toggle.yaml
maestro test .maestro/settings-consent.yaml
maestro test .maestro/learn-rewards.yaml
maestro test .maestro/dark-mode-smoke.yaml
```

## Honest blockers (native-only / human-gated)

| Flow | Why blocked on Windows / cloud agents |
|------|----------------------------------------|
| Live mic STT → translate | On-device `expo-speech-recognition`; no durable recording URI yet for speech upload |
| Live camera + ML Kit OCR | CocoaPods ML Kit + real shutter geometry |
| House / network ads with AdMob | Needs `network_ads_enabled` + physical AdMob/UMP; TG Playwright uses house adapter only |
| Rewarded video SSV | Device AdMob + server SSV |
| Paywall purchase / restore / expire | StoreKit sandbox + RevenueCat dashboard |
| Sign in with Apple → save consent → delete account | Apple session + Supabase; Alert confirm for delete |
| Interstitial auto-show | Flag off until external-beta go/no-go |
| VoiceOver / Dynamic Type matrix | F10 device proof |

Do not mark F9/F10 Done from Maestro YAML existence alone. Record pass/fail in [`docs/DEVICE_PROOF.md`](../../docs/DEVICE_PROOF.md).
