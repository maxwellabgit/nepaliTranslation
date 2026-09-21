# Scenario blockers (native / device)

These scenarios are **not** proven on Windows Playwright. Do not treat TG fixtures as iOS parity.

## 11 — Live mic STT

**Blocked.** Product speech recognition uses the on-device STT stack on iPhone. The testing-ground bridge can deny mic permission and drive recorded transcripts only via Jest/`createTestRuntime` helpers — it does **not** prove live microphone → transcript → translate on Windows Chrome.

Prove on: physical iPhone (Maestro / manual), not `npm run test:scenarios`.

## 12 — Live camera capture + on-device OCR

**Blocked.** Production camera uses `expo-camera` + ML Kit on device. Scenario 07 only loads a **Jest/TG OCR fixture** (`ocrFixture: 'inscription'`) so the result UI is reachable. That is **not** native capture geometry, ML Kit script models, or permission UX parity.

Prove on: physical iPhone with CocoaPods ML Kit, not Windows Playwright.

## Honesty

- Automated scenarios use Expo **web** export + `createTestRuntime` / recorded fixtures.
- `local-neural` remains a Windows stub (no IndicTrans2 ONNX claim).
- Device Maestro / TestFlight remain human-gated (Slice 12 / Slice 13).
