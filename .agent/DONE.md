# Done is expensive

“I edited the files” is never Done. Use the checklist for **your lane only**.

Shared (every lane that touches `mobile/`):

- [ ] `cd mobile && npm ci`
- [ ] `cd mobile && npm run lint`
- [ ] `cd mobile && npm run typecheck`
- [ ] `cd mobile && npm run test:unit -- --runInBand`
- [ ] `cd mobile && npm run verify:translate` — **mandatory even when the feature seems unrelated**
- [ ] `cd mobile && npx expo-doctor`
- [ ] Prefer `cd mobile && npm run verify:ci` when the slice owns the full mobile gate
- [ ] Diff contains no unrelated files and no gold-reference edits under `benchmarks/gold/`
- [ ] Contributor known checks / seeds were **not** copied from `benchmarks/gold/`
- [ ] ExecPlan updated (`plans/active/<lane>.md` or `plans/active/beta-release.md`)
- [ ] `/independent-reviewer` reported no material findings

## V1-wide gates (Production finalization F0–F10)

Apply on every V1 finalization PR. Slice-specific extras are below.

- [ ] Only **one** V1 slice in the PR; branch name `cursor/v1-fN-short-name`
- [ ] `plans/active/beta-release.md` Progress / Commands / Remaining work updated
- [ ] Core translate path still has **no** hard dependency on Supabase, AdMob, RevenueCat, or admin
- [ ] No production secret, tunnel URL, test password (`1234`), service role, or embedded review-sync secret introduced
- [ ] Optional-service failure leaves Translate, Camera, History, Settings, and Learn usable
- [ ] Contract matches INTENT: $0.99/month; banners idle Translate + Learn only; interstitial 15 min / ≤3 NY day; rewarded 15 min; credit = 5 min; >20 words = 2 credits; 5 PM America/New_York close; no clawback; 18+ media consent; 30-day deletion
- [ ] Feature flags remain independently disableable (text/speech/photo contributions, banners, rewarded, interstitial, paywall, telemetry, deletion processing)
- [ ] No claim of physical-device / airplane-mode / StoreKit / AdMob / interstitial proof from source-only tests
- [ ] Human blockers (Apple, Supabase, AdMob, RevenueCat, legal, bilingual, device, iPad) recorded honestly when reached

### Standard backend gate (slices that touch `supabase/`)

```text
npx supabase start
npx supabase db reset
npx supabase db lint --level error
npx supabase test db
deno test --allow-env supabase/functions/_shared supabase/functions/tests
```

If Docker cannot run locally, the same gate must run in GitHub Actions and the local limitation must be recorded — do not omit the gate.

### Standard admin gate (slices that touch `admin/`)

- [ ] Unit/Vitest (or equivalent) green
- [ ] Non-admin JWT receives 403 from every admin operation
- [ ] Playwright (or labeled CI) for triage/export/deletion paths when those pages exist
- [ ] No service key in browser code

---

## Lane 1 — eval-integrity

- [ ] Gold schema still valid (`benchmarks/gold/schema.json` + each class `manifest.json`)
- [ ] No training script or docs now tell anyone to train on gold
- [ ] Register mix rejected: informal rows are तिमी-class, formal rows are तपाईं-class (spot-check + any probe you ran)
- [ ] Holdout freeze story still true (see `benchmarks/gold/README.md`)
- [ ] Commands pasted in the ExecPlan

## Lane 2 — ui-bugs

- [ ] Each finding is either **fixed** with a repro note, or **won't-fix** with a device-only blocker
- [ ] Translate, Camera, and Learn: leaving a tab still hard-stops audio (`App.tsx`)
- [ ] Formal / Informal and देवनागरी toggles still match INTENT
- [ ] Loading, empty, error, and “MT not ready” states still exist
- [ ] Independent reviewer walked Translate, Camera, Learn, History, and Settings in source

Honest limit: a cloud agent cannot TestFlight. Do not claim airplane-mode device proof unless a human did it.

## Lane 3 — mt-accuracy

- [ ] `npm run verify:translate` passes
- [ ] Gold references were **not** edited
- [ ] Informal remains तिमी, not तँ
- [ ] Roman input is still normalized before NE→EN where that path exists
- [ ] If gold eval ran: meet or beat frozen baseline, or revert
- [ ] If gold eval could not run: blocker recorded; no quality claim

## Lane 4 — app-runtime

- [ ] Warm-up still does not brick the UI when neural is slow/failing
- [ ] Cancel / hard-stop still stops STT + TTS + in-flight MT
- [ ] Pass-the-phone rules still match `src/translate/passLogic.ts`
- [ ] Phrasebook / fallback path still works when neural is not ready
- [ ] `npx tsc --noEmit` + `npm run verify:translate`

## Lane 5 — model-ship

- [ ] Still one IT2 family; LoRA not `merge_and_unload`
- [ ] INT8-first; gold register/names survive any quant discussion
- [ ] Export path still ends at `mobile/assets/models/` (see `docs/OFFLINE_IOS.md`)
- [ ] Gold eval vs frozen baseline if weights exist; otherwise explicit GPU/artifact blocker
- [ ] No new PC/cloud inference in the product path
- [ ] Release artifacts pinned by revision + SHA-256 when shipping

---

## Production V1 slices (dependency order — do not combine)

### F0 — product contract

- [ ] INTENT / AGENTS / DONE / ExecPlan / CERTIFICATION / DEVICE_PROOF / RELEASE_RUNBOOK describe the V1 boundary in section 1 of the finalization plan
- [ ] $0.99/month, ad placements, interstitial rules, 15-minute rewarded grant, 18+ media consent, automatic post-consent upload, indefinite retention until withdrawal/deletion, 30-day purge, 5 PM NY reward close, one/two-credit rule, no clawback, bilingual UI, iPhone+iPad
- [ ] Independent feature flags listed with defaults off until gates pass
- [ ] Repository rules no longer contradict implementation (no $0.49, no 13+-only contribution story as the media rule, no “never auto-upload” absolute for consented adults)
- [ ] **No runtime code changed**

### F1 — privacy / offline-core repair

- [ ] STT routed through RuntimePorts with `requiresOnDeviceRecognition: true`; fail closed on missing locales
- [ ] Typed translation proven when speech unsupported
- [ ] No raw source/output console logging; diagnostics banned-key + sensitive-fixture tests green
- [ ] Model downloads pinned (immutable revision + SHA-256 manifest); EAS fails on mismatch
- [ ] Camera preview downsampled; generation cancel; distinct error states
- [ ] Mobile shared gate + focused tests green

### F2 — bilingual UI / theme / layouts

- [ ] Persisted UI language English | नेपाली changes entire UI immediately (guest OK)
- [ ] Production strings catalogued; uncatalogued-string test for targeted screens
- [ ] `userInterfaceStyle` automatic; light/dark coherent on major screens
- [ ] Phone + iPad size classes; Camera portrait capture/result preserved
- [ ] Playwright iPad viewports; Dynamic Type visibility checks or honest blockers

### F3 — contribution consent + media ingestion

- [ ] Forward-only migration: consent/adult/deletion fields + media table/storage
- [ ] Private buckets; signed upload; RLS denies cross-user media reads
- [ ] Guests / under-18 / declined / flag-off upload nothing
- [ ] Post-consent auto upload with offline retry; core translate never waits
- [ ] Consent copy covers required topics; backend + client tests green

### F4 — reward close / alerts / deletion jobs

- [ ] Reward window from America/New_York 5:00 PM boundaries (DST tests)
- [ ] >20 words → 2 credits; ≤20 → 1; immutable pre-edit count
- [ ] Pending/approved at close grant once; pre-close reject → zero; late reject → alert, no clawback
- [ ] Rewarded video schedule = 15 minutes; SSV expectations updated
- [ ] Deletion job: disable uploads, purge within 30 days, admin alert, user-visible status
- [ ] Backend gate green

### F5 — advertising complete

- [ ] Banner / rewarded / interstitial unit IDs; prod rejects Google test IDs
- [ ] `decideInterstitialPresentation` covers all forbidden states + 15 min + 3/NY day
- [ ] Banners only idle Translate + Learn landing
- [ ] SDK owns interstitial dismiss; remote emergency disable
- [ ] Policy tests + physical-device or honest blocker

### F6 — RevenueCat / StoreKit

- [ ] $0.99/month product + Expo-compatible SDK; public key only in app
- [ ] PurchaseService port; fake + production adapters
- [ ] Webhook verified + idempotent (no 501)
- [ ] Bilingual paywall; Restore; Manage; offline cache; deletion warns about Apple billing
- [ ] Sandbox / TestFlight matrix recorded or human-gated

### F7 — admin console

- [ ] Dashboard, review queue (incl. media preview), alerts, deletion queue, dataset staging, flags
- [ ] Server allowlist; revoked admin loses access next request
- [ ] Non-admin 403 everywhere; no service key in browser; media access audited

### F8 — observability / legal / security

- [ ] Telemetry schema + scrubber tests (no raw content)
- [ ] Live Privacy / Terms / support / deletion / app-ads.txt or explicit blockers
- [ ] App Store privacy labels match runtime
- [ ] 13 dependency advisories triaged SDK-57-compatibly with owners
- [ ] Secret scan / audit / model-hash checks in CI as specified

### F9 — model certification + automation

- [ ] Exact release artifacts evaluated on frozen gold (four classes); thresholds pre-declared
- [ ] Playwright extended for UI lang, consent, rewards, ads, IAP adapters, deletion, iPad, dark mode
- [ ] Playwright browser install cached in CI
- [ ] Maestro expanded for native counterparts or honest blockers

### F10 — device / TestFlight / release

- [ ] iPhone + iPad matrix filled in DEVICE_PROOF
- [ ] Internal then external TestFlight (25–50); interstitial go/no-go explicit
- [ ] Seven consecutive external days with no open P0/P1
- [ ] Freeze build / hashes / flags / privacy / rollback rehearsal
- [ ] Public submission only after go/no-go checklist in RELEASE_RUNBOOK

---

## Release go/no-go (public App Store)

Production V1 is Done only when:

- [ ] F0–F10 merged with green CI and independent review
- [ ] Exact model artifacts pass frozen evaluation and physical-device performance gates
- [ ] iPhone and iPad matrices pass on the same TestFlight build
- [ ] RevenueCat, StoreKit, AdMob, UMP, Apple Sign-In, Supabase media storage, deletion, and admin operations pass with production-like configuration
- [ ] Privacy/Terms/support URLs and App Store privacy answers are live and accurate
- [ ] Bilingual UI and alphabet content receive human sign-off
- [ ] No P0/P1 defects remain and external TestFlight completes seven clean consecutive days
- [ ] Rollback rehearsed using remote flags without disabling the offline core
