# Done is expensive

“I edited the files” is never Done. Use the checklist for **your lane only**.

Shared (every lane that touches `mobile/`):

- [ ] `cd mobile && npm ci`
- [ ] `cd mobile && npm run lint` (once Slice 01 scripts exist; until then `npx tsc --noEmit` + existing verify)
- [ ] `cd mobile && npm run typecheck` (or `npx tsc --noEmit` before Slice 01)
- [ ] `cd mobile && npm run test:unit -- --runInBand` (Slice 01+)
- [ ] `cd mobile && npm run verify:translate` — **mandatory even when the feature seems unrelated**
- [ ] `cd mobile && npx expo-doctor` (Slice 01+)
- [ ] Diff contains no unrelated files and no gold-reference edits under `benchmarks/gold/`
- [ ] Contributor known checks / seeds were **not** copied from `benchmarks/gold/`
- [ ] ExecPlan updated (`plans/active/<lane>.md`)
- [ ] `/independent-reviewer` reported no material findings

## Beta-wide gates (App Store / TestFlight program)

Apply on every beta slice PR. Slice-specific extras are below.

- [ ] Only **one** beta slice in the PR; branch name `cursor/beta-XX-short-name`
- [ ] `plans/active/beta-release.md` Progress / Commands / Remaining work updated
- [ ] Core translate path still has **no** hard dependency on Supabase, AdMob, RevenueCat, or admin
- [ ] No production secret, tunnel URL, test password (`1234`), service role, or embedded review-sync secret introduced
- [ ] Optional-service failure leaves Auto, Conversation, History, Settings, and Learn alphabet usable
- [ ] No claim of physical-device / airplane-mode / StoreKit / AdMob proof from source-only tests
- [ ] Human blockers (Apple, Supabase, AdMob, RevenueCat, legal, bilingual, device) recorded honestly when reached

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
- [ ] Playwright (or labeled CI) for triage/export paths when those pages exist
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
- [ ] Auto and Conversation: mode switch still hard-stops audio (`App.tsx`)
- [ ] Formal / Informal and देवनागरी toggles still match INTENT
- [ ] Loading, empty, error, and “MT not ready” states still exist
- [ ] Independent reviewer walked Home, Conversation, History, Settings, Meaning Review in source

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
- [ ] Conversation pass rules still match `src/conversation/passLogic.ts`
- [ ] Phrasebook / fallback path still works when neural is not ready
- [ ] `npx tsc --noEmit` + `npm run verify:translate`

## Lane 5 — model-ship

- [ ] Still one IT2 family; LoRA not `merge_and_unload`
- [ ] INT8-first; gold register/names survive any quant discussion
- [ ] Export path still ends at `mobile/assets/models/` (see `docs/OFFLINE_IOS.md`)
- [ ] Gold eval vs frozen baseline if weights exist; otherwise explicit GPU/artifact blocker
- [ ] No new PC/cloud inference in the product path

---

## Beta slices (dependency order — do not combine)

### Slice 00 — product contract

- [ ] `plans/active/beta-release.md` exists with PLANS.md sections
- [ ] INTENT / AGENTS / DONE describe offline core + optional services + known-check ban on gold
- [ ] Baseline commit + proof commands recorded
- [ ] **No runtime code changed**

### Slice 01 — test harness / UI primitives

- [ ] Standard mobile gate scripts exist and CI runs them
- [ ] Tab persistence / hard-stop / History clear / Mark incorrect entry tests exist
- [ ] `verify:translate` output unchanged vs baseline expectations

### Slice 02 — Supabase schema / RLS / API skeleton

- [ ] Backend gate green (local or CI Docker)
- [ ] pgTAP: anon cannot touch private; user A ≠ user B; no client ledger inserts
- [ ] Leased known-check API JSON exposes no known/reference fields
- [ ] Similarity fixtures cover Devanagari, punctuation, Roman case, empty/short, register, negation

### Slice 03 — Apple auth / consent / deletion

- [ ] Guest launch has no mandatory login wall
- [ ] Contribution actions require sign-in; translate/Learn do not
- [ ] Delete-account path implemented with resumable failure; Apple revoke recorded or human-gated
- [ ] Physical device results recorded honestly (or listed as blocker)

### Slice 04 — correction sheet / outbox

- [ ] Mark incorrect + To training share one sheet; no silent history upload
- [ ] Idempotent sync; legacy queue → local drafts tagged `legacy-v1` until explicit consent
- [ ] Temporary review endpoint/secret and `1234` reviewer path removed from production bundle

### Slice 05 — contribution queue / consensus

- [ ] Assignment ratio / lease / ownership tests with seeded RNG
- [ ] Consensus never uses model similarity alone
- [ ] Client cannot identify known tasks before submit

### Slice 06 — reward ledger / entitlements

- [ ] Grants atomic, capped, idempotent; stack from `max(now, expiry)`
- [ ] Trusted-time policy; clock skew cannot mint time
- [ ] `decideAdPresentation` tests (ads still mocked/off OK)

### Slice 07 — Learn alphabet

- [ ] Third mounted tab; hard-stop + lesson position preserved
- [ ] Alphabet schema/quiz tests; works with Supabase down / offline mocks
- [ ] Missing Nepali voice handled honestly; bilingual human sign-off recorded or blocked

### Slice 08 — AdMob

- [ ] Policy table tests; zero AdMob calls offline
- [ ] No ads in Conversation / keyboard / audio / under entitlement
- [ ] SSV verification fixtures; physical device proof or honest blocker

### Slice 09 — RevenueCat / StoreKit

- [ ] Fake purchases adapter covers paywall states
- [ ] Webhook auth + idempotency tests
- [ ] Sandbox/TestFlight matrix recorded or human-gated

### Slice 10 — admin console

- [ ] Server-side allowlist; revoked admin loses access next request
- [ ] Export hash stability; known-reference versioning
- [ ] Deploy / callback URL human-gated

### Slice 11 — privacy / security / store surfaces

- [ ] Live Privacy / Terms / support / deletion / app-ads.txt URLs or explicit blockers
- [ ] Secret scan clean; log redaction test with sensitive fixtures
- [ ] Account deletion reachable within three Settings taps

### Slice 12 — E2E / performance / polish

- [ ] Required Maestro flows exist; defects fixed with regression + review
- [ ] Performance targets measured before claimed

### Slice 13 — TestFlight / App Store

- [ ] Marketing version / build bumped; release DoD entirely checked
- [ ] Seven consecutive external-TestFlight days with no open P0/P1 (human evidence)
