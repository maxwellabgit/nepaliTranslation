# companion-tools: Traveler exchange rates + EN/NE alphabet learning

## Goal

Add two companion overlays to NepTranslate, without changing Auto / Conversation as the only translation modes:

1. **Rates** — NPR-centric converter using Nepal Rastra Bank quotes, usable offline from a bundled seed, with optional refresh when the phone has a network.
2. **Learn** — English A–Z and Nepali varnamala (स्वर + व्यञ्जन). Every Nepali letter has a Play button under it that sounds the letter out.

This lane does not touch gold, IndicTrans2, phrase overlay, or STT.

## Context (paths, commands, constraints)

### Product facts

- v1 UI today: Auto + Conversation on the tab bar; History / Settings / Meaning Review are full-screen overlays from Auto (`mobile/App.tsx`).
- Core loop must stay on-device. A live FX fetch is **not** translation inference, but it is still optional network. Translation, STT, and MT must keep working with airplane mode.
- iPhones generally have **no Nepali TTS voice**. Settings already reports this. `Speech.speak(..., { language: 'ne-NP' })` is not a reliable Play button for Devanagari letters. Nepali letter audio must be **bundled clips**.
- English letter audio can use `expo-speech` (`en-US`).
- Informal Nepali in any example word is **तिमी**, never तँ.
- Expo SDK **57** only: https://docs.expo.dev/versions/v57.0.0/

### Paths to add (implementation PR, not this plan PR)

| Path | Role |
|------|------|
| `mobile/src/screens/RatesScreen.tsx` | Converter + rate table overlay |
| `mobile/src/screens/AlphabetScreen.tsx` | English / नेपाली segmented Learn overlay |
| `mobile/src/rates/types.ts` | Quote, unit, as-of, source |
| `mobile/src/rates/seedRates.json` | Last-known NRB snapshot shipped in the binary |
| `mobile/src/rates/convert.ts` | Per-unit NPR math (INR is quoted per 100) |
| `mobile/src/rates/fetchNrb.ts` | Optional `GET` of NRB `/rates`; weekend walk-back |
| `mobile/src/storage/ratesCache.ts` | AsyncStorage cache of last successful fetch |
| `mobile/src/learn/englishLetters.ts` | A–Z + example word + `en-US` speak text |
| `mobile/src/learn/nepaliLetters.ts` | Vowels, consonants, roman, audio key |
| `mobile/src/learn/playLetter.ts` | Stop other audio; play clip or English TTS |
| `mobile/assets/audio/letters/ne/<id>.m4a` | One short clip per Nepali letter |
| `mobile/scripts/verify_companion_tools.mjs` | Alphabet completeness + FX unit math |

Wire-up only: `mobile/App.tsx` (new overlay keys), `mobile/src/screens/SettingsScreen.tsx` (entry rows), `mobile/src/screens/HomeScreen.tsx` only if a header entry is added. Prefer Settings so the Auto header stays History | brand | Settings.

### Commands

```bash
cd mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit
cd mobile && npm run verify:translate
# after scripts exist:
cd mobile && node ./scripts/verify_companion_tools.mjs
```

### Official rate source

Nepal Rastra Bank FOREX API v1:

- Base: `https://www.nrb.org.np/api/forex/v1/`
- Docs: https://www.nrb.org.np/api-docs-v1/
- `GET /rates?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&per_page=100`
- Quotes are NPR per `currency.unit` (INR and KRW often `unit: 100`, JPY often `unit: 10`). Always divide buy/sell by `unit` before converting.
- Published once per business day. Weekends/holidays often have an empty payload — walk back up to 7 calendar days and keep the last good day.
- Attribute on screen: “Nepal Rastra Bank · as of {date}”. Disclaimer: indicative mid rate, not a bank or money-changer quote.

Do not add a third-party FX SDK. Do not send translation text to any rate host.

## Done when (copy the lane checklist from DONE.md)

- [ ] INTENT lists Rates + Learn as companion overlays; Auto + Conversation remain the only translation modes
- [ ] Rates converter works from bundled seed with no network
- [ ] Optional NRB refresh updates cache; failure leaves seed/cache on screen with a clear as-of line
- [ ] INR / JPY `unit` is applied (no 100× INR bug)
- [ ] English alphabet: A–Z, example word, Play via `expo-speech`
- [ ] Nepali alphabet: vowels + consonants listed below; each letter has a Play control under it
- [ ] Nepali Play uses bundled audio, not `ne-NP` TTS as the primary path
- [ ] Overlay open/close calls `hardStopAudio()`; letter playback stops on close and on Auto ↔ Conversation
- [ ] Informal example words use तिमी, not तँ
- [ ] Shared mobile gates: lexicon export + `tsc --noEmit`, `verify:translate`, no gold edits
- [ ] `/independent-reviewer` walked Settings → Rates and Settings → Learn in source

Honest limit: a cloud agent cannot record native letter audio or TestFlight. Missing `.m4a` files are a **blocker**, not a silent Play button.

## Product shape

### Navigation

Do **not** add a third tab. The dock stays Auto | Conversation.

Add two Settings rows under a **Traveler tools** section (above Advanced):

- **Exchange rates** → `RatesScreen`
- **Alphabet** → `AlphabetScreen`

Overlay union in `App.tsx` becomes:

`'history' | 'settings' | 'meaning' | 'rates' | 'learn' | null`

Rates / Learn close back to Settings (same pattern as Meaning Review). Opening either overlay runs `hardStopAudio()`.

Conversation has no Settings chrome today. v1 of this lane is Auto → Settings → tool. Do not add a Conversation tab or a third dock button in the first implementation PR.

### Rates screen

Layout (top → bottom):

1. Back + title **Rates**
2. Amount field (numeric, default `1`)
3. From / To chips + a swap control. Default **USD → NPR**.
4. Big result (localized number, 2–4 fraction digits)
5. One-line rate used: `1 USD = {n} NPR` (mid)
6. Traveler table for: **NPR, INR, USD, EUR, GBP, AUD, CAD, CNY, JPY** (NPR row is 1)
7. Footer: source, as-of date, buy/sell note, **Refresh** (disabled while in flight)

Converter rules:

- Store each quote as `{ iso3, name, unit, buy, sell, date }`.
- `perNpr(iso) = mid / unit` where `mid = (buy + sell) / 2`. NPR is `1`.
- `toNpr(amount, from) = amount * perNpr(from)`
- `fromNpr(npr, to) = npr / perNpr(to)`
- Cross (USD→INR): `fromNpr(toNpr(amount, 'USD'), 'INR')`
- Parse NRB `buy`/`sell` strings with `Number`; if either is missing, skip that currency rather than guessing.

Offline:

- Ship `seedRates.json` with a real NRB snapshot and `asOf` date (captured at implementation time).
- On launch: show `max(seed, cache)` by `asOf`.
- Refresh: fetch today; if empty, walk back day by day (max 7). On success, write cache. On failure, keep current quotes and show “Couldn’t refresh · still showing {asOf}”.

Empty/error: amount empty → result empty, not `NaN`. Unknown pair → “No rate for this currency”.

### Learn screen

Segmented control: **English** | **नेपाली**. Default नेपाली (the feature the user called out).

Each letter is a card:

```
[  क  ]
[  ka ]
[  ▶ Play ]
```

- Letter: large Devanagari / Latin (about 36pt).
- Roman (Nepali only) under the letter, IAST-simple (`ka`, `kha`, `nga`, `aa`).
- **Play** under that, full-width inside the card, min 44pt hit target, `accessibilityLabel` like `Play ka` / `Play क`.
- English cards: letter + example word (`A` / Apple) + Play.

Grid: 3 columns on phone. Sections on Nepali: **स्वर**, then **व्यञ्जन**. English is a single A–Z list.

Do not run the translation engine from this screen. Example words are static.

#### English inventory (26)

A Apple, B Ball, C Cat, D Dog, E Egg, F Fish, G Goat, H Hat, I Ink, J Jug, K Kite, L Lion, M Moon, N Nest, O Orange, P Pen, Q Queen, R Rain, S Sun, T Tree, U Umbrella, V Van, W Water, X X-ray, Y Yak, Z Zebra.

Play: `Speech.stop(); Speech.speak(letter, { language: 'en-US', rate: 0.85 })`. Optional second tap pattern (letter then word) is out of scope for v1 of this lane.

#### Nepali inventory (must match `nepaliLetters.ts` and audio files 1:1)

**स्वर (13)**

| Letter | id | roman |
|--------|----|-------|
| अ | a | a |
| आ | aa | aa |
| इ | i | i |
| ई | ii | ii |
| उ | u | u |
| ऊ | uu | uu |
| ऋ | ri | ri |
| ए | e | e |
| ऐ | ai | ai |
| ओ | o | o |
| औ | au | au |
| अं | am | am |
| अः | ah | ah |

Skip ॠ ऌ ॡ in v1 (not taught in the school varnamala).

**व्यञ्जन (36 + 3 conjuncts)**

क ka, ख kha, ग ga, घ gha, ङ nga,
च cha, छ chha, ज ja, झ jha, ञ nia,
ट ta, ठ tha, ड da, ढ dha, ण na-retroflex (`ana` / `ṇa` — use `na.` in `id` `tta` style: `tta, ttha, dda, ddha, nna`),
त ta, थ tha, द da, ध dha, न na,
प pa, फ pha, ब ba, भ bha, म ma,
य ya, र ra, ल la, व wa,
श sha, ष ssa, स sa, ह ha,
क्ष ksha, त्र tra, ज्ञ gya.

Stable `id` values (audio filenames):

```
a aa i ii u uu ri e ai o au am ah
ka kha ga gha nga
cha chha ja jha nya
tta ttha dda ddha nna
ta tha da dha na
pa pha ba bha ma
ya ra la wa
sha ssa sa ha
ksha tra gya
```

v1 does not teach matras (का, कि, …) or a full barakhari. That is a later milestone, not this PR.

#### Sound-out (the requirement)

Primary path for Nepali: `expo-av` (SDK 57) plays `mobile/assets/audio/letters/ne/<id>.m4a`.

`playLetter.ts`:

1. Stop STT (`hardStopRecognition`) and `Speech.stop()` and any previous `Audio.Sound`.
2. Load and play the clip for that `id`.
3. Unload on finish / overlay close / unmount.

If the clip is missing: disable Play and show “Sound not installed” — never a dead button that looks enabled.

Do **not** use English TTS to pronounce “ka” as the shipping Nepali path. That teaches the wrong voice.

English Play stays on `expo-speech`.

**Human-gated:** someone with a native Nepali voice records ~52 short clips (letter name with inherent अ on consonants: क = “ka”). Store uncompressed or AAC `.m4a`, ~0.4–0.8s each, peak-normalized. Until those files exist, the screen and wiring can land, but the lane is **not Done**.

## Milestones

- [ ] **M0** Amend `.governance/INTENT.md` + `mobile/README.md` Modes table: companion overlays, optional NRB fetch, still no cloud MT/STT. (This plan PR does not change INTENT.)
- [ ] **M1** Overlay plumbing: Settings rows, `App.tsx` overlay keys, `hardStopAudio` on open/close.
- [ ] **M2** Rates: types, seed JSON, `convert.ts`, `RatesScreen` offline converter + table.
- [ ] **M3** Rates: `fetchNrb.ts` + cache + Refresh + weekend walk-back + failure copy.
- [ ] **M4** Learn English: data + grid + `expo-speech` Play.
- [ ] **M5** Learn Nepali: data + स्वर/व्यञ्जन cards + Play under every letter, wired to `playLetter.ts`.
- [ ] **M6** Bundled Nepali `.m4a` for every `id` (human recording). Verify 1:1 with `nepaliLetters.ts`.
- [ ] **M7** `verify_companion_tools.mjs` + shared mobile gates + independent review.

Ship M1–M5 without claiming Done if M6 is blocked. Do not fake clips with silence or English TTS.

## Progress

Plan written (2026-08-20). No implementation yet. Branch `cursor/companion-tools-plan-dbe6` is on origin. GitHub PR create from this agent is blocked (`must be a collaborator`).

## Surprises & discoveries

- Auto header is already History | brand | Settings. A third header link would crowd it; Settings is the entry.
- `hasNepaliVoice()` is usually false. Any plan that “just calls expo-speech for क” will fail on the devices this app ships to.
- NRB `unit` is the classic FX bug for Nepal apps (INR per 100). Converter must divide.
- Conversation cannot reach Settings today. First slice does not fix that; record it rather than adding a third tab.

## Decision log

- Companion overlays, not a third translation mode and not a new bottom tab.
- NRB is the only rate host; bundled seed + cache so airplane mode still converts.
- Mid rate for the converter; show buy/sell in the table.
- Nepali letter audio is bundled clips; English letters use `expo-speech`.
- Nepali inventory is school varnamala (13 vowels + 36 consonants + क्ष त्र ज्ञ). No matra chart in v1.
- One lane / one PR for implementation; this document is the plan-only first PR.
- Do not mix with eval, MT, or model-ship work.

## Proposed INTENT delta (apply in M0, not in this PR)

Add under **Modes (v1 UI)**:

```
3. Companion overlays (from Settings, not the tab bar)
   - Rates — NPR converter from Nepal Rastra Bank quotes. Bundled last-known
     rates always work offline. Refresh is optional network, never required
     for translation.
   - Learn — English A–Z and Nepali varnamala. Nepali letters play bundled
     audio. Not a translation surface.
```

Add under **Constraints**:

```
- May: fetch NRB public forex JSON when the user taps Refresh on Rates
- Must not: call any network API for STT or MT in the product path
- Must not: add a third Auto/Conversation-style tab for tools
```

Add under **Not Doing (v1)**:

```
- Live multi-bank FX, alerts, or charts
- Full Nepali barakhari / matra trainer
- Cloud TTS for Devanagari letters
```

## Commands that actually ran (paste)

```
# plan-only PR; no mobile gates required
```

## Remaining work

All implementation milestones M0–M7.

## Blockers (concrete; cannot be solved from this repo)

- Native-speaker recordings for `mobile/assets/audio/letters/ne/*.m4a` (M6). Without them, Nepali Play cannot be marked Done.
- Device proof of NRB fetch + letter playback on a real iPhone / TestFlight. A cloud agent can unit-test convert math and inventory counts only.
