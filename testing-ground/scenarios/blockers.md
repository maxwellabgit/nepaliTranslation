# Scenario blockers (native / device)

These scenarios are **not** proven on Windows Playwright. Do not treat TG fixtures as iOS parity.

## 11 — Live mic STT

**Blocked.** Product speech recognition uses the on-device STT stack on iPhone. The testing-ground bridge can deny mic permission and drive recorded transcripts only via Jest/`createTestRuntime` helpers — it does **not** prove live microphone → transcript → translate on Windows Chrome.

Prove on: physical iPhone (Maestro / manual), not `npm run test:scenarios`.

## 12 — Live camera capture + on-device OCR

**Blocked.** Production camera uses `expo-camera` + ML Kit on device. Scenario 07 only loads a **Jest/TG OCR fixture** (`ocrFixture: 'inscription'`) so the result UI is reachable. That is **not** native capture geometry, ML Kit script models, or permission UX parity.

Prove on: physical iPhone with CocoaPods ML Kit, not Windows Playwright.

## F9 native counterparts (Maestro stubs exist; still human-gated)

| Surface | Playwright (TG web) | Maestro / device |
|---------|---------------------|------------------|
| UI language toggle | Automated | `.maestro/ui-lang-toggle.yaml` |
| Consent age/save gated | Automated (no Apple session) | `.maestro/settings-consent.yaml` — save needs Sign in with Apple |
| Rewards strip | Automated | `.maestro/learn-rewards.yaml` |
| Ads house / flag-off | Automated via TG `featureFlags` | Live AdMob = device blocker |
| IAP soft-fail | Automated fake adapter | StoreKit purchase/restore = device blocker |
| Deletion messaging | Consent copy + link | `.maestro/deletion-messaging.yaml` — purge Alert needs signed-in Apple |
| Dark mode | `prefers-color-scheme` | `.maestro/dark-mode-smoke.yaml` — set iOS Appearance Dark first |
| iPad chrome | Playwright `ipad-*` projects | Physical iPad matrix = F10 |

See `mobile/.maestro/README.md` for the full blocker table.

## Honesty

- Automated scenarios use Expo **web** export + `createTestRuntime` / recorded fixtures + optional TG `featureFlags`.
- `local-neural` remains a Windows stub (no IndicTrans2 ONNX claim).
- Device Maestro / TestFlight remain human-gated (F10).
- Exact ONNX gold ship floors: `docs/MODEL_CERT.md` + `python benchmarks/certify_ship_artifacts.py` (weights may be a BLOCKER).
