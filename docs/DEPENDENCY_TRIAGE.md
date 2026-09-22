# Dependency triage (F8)

Recorded **2026-09-22** against Expo SDK **57** (`mobile/`) and the admin Vite SPA (`admin/`).

**Policy:** Prefer transitive bumps that preserve Expo 57. Do **not** run `npm audit fix --force` when it proposes downgrading Expo packages (e.g. `expo-splash-screen@55`). Owners must re-check on each Expo patch train.

Commands:

```text
cd mobile && npm audit
cd admin && npm audit
```

## Summary

| Workspace | npm audit vulnerability count (this run) | Disposition |
|-----------|------------------------------------------|-------------|
| `mobile/` | **13** (11 moderate, 2 high per `npm audit`; multiple GHSA IDs under `@xmldom/xmldom`) | Triaged below — accept or wait for Expo-compatible upstream; no forced Expo break |
| `admin/` | **2** moderate (Vitest mocker family) | Triaged — upgrade Vitest on admin schedule |

---

## Mobile (`mobile/`)

Owners: **mobile runtime** = app-runtime / F8 store slice; **Expo toolchain** = founder + Expo SDK upgrade lane (not F8).

### `@xmldom/xmldom` (via `plist` / Expo config tooling) — 14 GHSAs

| Advisory | Severity | Disposition |
|----------|----------|-------------|
| [GHSA-6gmq-8vp8-gcm6](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6) | moderate | **Accept / monitor** — build-time XML (`plist`) path, not shipped product network parser for user content. `npm audit fix` may bump when Expo lock allows; do not force Expo downgrade. Owner: Expo toolchain. |
| [GHSA-6mj3-qw4j-hgrw](https://github.com/advisories/GHSA-6mj3-qw4j-hgrw) | high | Same as above. |
| [GHSA-g53g-w8rj-fmg7](https://github.com/advisories/GHSA-g53g-w8rj-fmg7) | high | Same as above (ReDoS on malicious plist). |
| [GHSA-w2rr-34g9-rvrj](https://github.com/advisories/GHSA-w2rr-34g9-rvrj) | high | Same as above. |
| [GHSA-4w3w-2rp5-g8jm](https://github.com/advisories/GHSA-4w3w-2rp5-g8jm) | high | Same as above. |
| [GHSA-c7q8-3ch8-vqpv](https://github.com/advisories/GHSA-c7q8-3ch8-vqpv) | high | Same as above. |
| [GHSA-27p8-2357-5qqv](https://github.com/advisories/GHSA-27p8-2357-5qqv) | high | Same as above. |
| [GHSA-3px3-54cx-rmw9](https://github.com/advisories/GHSA-3px3-54cx-rmw9) | high | Same as above. |
| [GHSA-vr34-hp96-76pp](https://github.com/advisories/GHSA-vr34-hp96-76pp) | high | Same as above. |
| [GHSA-6h8r-xr42-gp59](https://github.com/advisories/GHSA-6h8r-xr42-gp59) | moderate | Same as above. |
| [GHSA-8344-3jmq-59r6](https://github.com/advisories/GHSA-8344-3jmq-59r6) | high | Same as above. |
| [GHSA-x4fp-j954-r2f4](https://github.com/advisories/GHSA-x4fp-j954-r2f4) | high | Same as above. |
| [GHSA-965w-775f-mr7g](https://github.com/advisories/GHSA-965w-775f-mr7g) | high | Same as above. |
| [GHSA-93r5-fhx6-vmg9](https://github.com/advisories/GHSA-93r5-fhx6-vmg9) | high | Same as above. |

**Why accept for V1 ship gate:** Exposure is Expo/plist tooling during prebuild/config, not the on-device translate path. Prefer Expo SDK 57 patch / `@expo/config-plugins` bump over a manual override that breaks the lockfile.

### `brace-expansion` — 2 GHSAs

| Advisory | Severity | Disposition |
|----------|----------|-------------|
| [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | high | **Accept / monitor** — transitive; DoS via crafted glob patterns in tooling. Apply non-force `npm audit fix` when lockfile permits. Owner: Expo toolchain / CI. |
| [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | high | Same as above. |

### `uuid` (via `xcode` → `@expo/config-plugins`) — 1 GHSA

| Advisory | Severity | Disposition |
|----------|----------|-------------|
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | moderate | **Defer** — `npm audit fix --force` proposes `expo-splash-screen@55` (breaks SDK 57). Wait for Expo 57-compatible upstream of `xcode`/`uuid`. Owner: Expo toolchain. |

---

## Admin (`admin/`)

Owners: **admin console** = F7 maintainers / founder.

| Advisory | Package | Severity | Disposition |
|----------|---------|----------|-------------|
| [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | `@vitest/mocker` / `vitest` | moderate | **Plan upgrade** — Vitest mocker path traversal in test tooling only (not production admin SPA bundle). Upgrade Vitest when compatible; avoid `--force` if it breaks Vite/admin scripts. Owner: admin console. |

(Audit reports the Vitest tree as two related vulnerability nodes; treat as one advisory family with a single owned upgrade action.)

---

## CI expectations (F8)

| Check | Location | Notes |
|-------|----------|-------|
| Secret scan | `.github/workflows/agent-gates.yml` `secret-scan` | Blocks JWT/service-role / live payment / AdMob secret patterns |
| Model-hash | `mobile/scripts/check_model_hash.mjs` + `model-hash` job + `npm run check:model-hash` in `verify:beta` | Validates IT2 manifest pins; optional `VERIFY_MODEL_FILES=1` when weights present |
| npm audit | Human / this doc | Not a hard fail gate (Expo-transitive noise); refresh triage before F10 |

## Non-goals

- Do not upgrade Expo SDK in this slice.
- Do not claim production risk eliminated for build-tool advisories until Expo ships patched transitive deps.
