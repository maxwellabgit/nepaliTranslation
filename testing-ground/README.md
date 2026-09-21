# NepTranslate Testing Ground

**Engineering-only.** This is a private Windows harness for offline scenario work against the real Expo web UI. It is **not** an App Store product, **not** a consumer Windows app, and **not** a substitute for on-device iOS TestFlight proof.

## What it does

- Hosts `mobile/dist` (from `npx expo export --platform web`) inside a phone-stage iframe with viewport presets.
- Right-hand developer console: Overview, Timeline, State, Fixtures (tables / event rows).
- Injects fixture config via `window.__NEPTRANSLATE_TG__` (and host `window.__NEPTRANSLATE_TG_HOST__`) so the web app can boot `createTestRuntime` adapters.
- Translation modes (honest labels):
  - **fast fallback** — deterministic test adapter / lexicon-style path
  - **recorded** — fixture translations only
  - **local-neural** — stub on Windows; does **not** claim IndicTrans2 / native iOS parity
- Scenario controls: load, step, run, cancel, reset, seed, export (export downloads a JSON bundle in the browser; Node writer creates the on-disk layout).

## Artifact paths

| Environment | Path |
|-------------|------|
| Windows desktop (preferred) | `%LOCALAPPDATA%\NepTranslateTestingGround\runs\<run-id>\` |
| Node / Vite when Tauri FS is unavailable | `testing-ground/runs/<run-id>/` (`TG_FORCE_LOCAL_RUNS=1`) |

Each run directory contains:

- `manifest.json`
- `events.jsonl`
- `final-snapshot.json`
- `summary.json`

## Quick start (Vite frontend — no Rust required)

```powershell
# From repo root
.\testing-ground\scripts\Ready-TestingGround.ps1

cd testing-ground
npm run prepare:hosted   # copies ../mobile/dist → public/hosted-app (rewrites asset URLs)
npm run dev              # http://localhost:5173
```

Build the Vite UI only:

```powershell
cd testing-ground
npm run prepare:hosted
npm run build
```

Artifact smoke (Node fallback):

```powershell
cd testing-ground
npm run test:artifacts
```

## Tauri 2 shell (optional)

Requires the Rust toolchain (`cargo`, `rustc`) and Windows build tools for `tauri build`.

```powershell
cd testing-ground
npm run tauri:dev      # needs cargo
npm run tauri:build    # needs cargo + icon assets
```

If `cargo` is missing, the Vite frontend and readiness script still work. Document the blocker; do not claim a packaged `.exe` without Rust.

## Mobile bridge (minimal)

- `mobile/src/runtime/resolveBootRuntime.ts` — native no-op
- `mobile/src/runtime/resolveBootRuntime.web.ts` — reads `__NEPTRANSLATE_TG__`, returns `createTestRuntime(...)`
- `mobile/App.tsx` — uses `resolveBootRuntime()` on the default export (web only resolves the `.web` module)

Re-export the web app after changing the bridge:

```powershell
cd mobile
npx expo export --platform web
cd ..\testing-ground
npm run prepare:hosted
```

## Out of scope (later slices)

- Full Playwright scenario suite (slice 7)
- Claiming neural parity with iPhone ONNX
- Shipping this shell to end users
