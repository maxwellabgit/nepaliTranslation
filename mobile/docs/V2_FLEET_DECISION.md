# NepTranslate v2 — Fleet Decision Report

**Date:** 2026-07-23  
**Fleet:** 6 autonomous agents (Product/UX · MT Quality · STT/Conversation · Gold Data · Governance · QA)  
**Current binary:** 1.4.5 (phrasebook + Apple STT)  
**Branch work:** automated unit tests + honesty fixes + this decision record

---

## Executive verdict

**Do not brand 2.0 until on-device neural MT ships and clears gold gates.**  
Today’s product is a strong **v1.4 traveler shell**. Calling it 2.0 without IndicTrans2-class ONNX would oversell capability (phrasebook gold ≈12% chrF vs IT2 ≈50%).

| Track | Ship as | Gate |
|-------|---------|------|
| Honesty + tests + Conversation reliability | **1.5.x** | Unit tests green + TestFlight checklist |
| On-device neural MT (ONNX IT2) + gold pass | **2.0.0** | Beat frozen `it2_base` / overnight gates on-device |
| whisper.rn fully offline STT | **2.1** | Airplane-mode STT works; Apple as fallback OK |

---

## Fleet consensus (what to upgrade)

### Must for 2.0 (all agents agree)

1. **Wire ONNX IndicTrans2** into `TranslationEngine` — phrasebook becomes fallback only.
2. **Pass gold gates** on the **same INT8 graphs** that ship in the IPA (overall ≥ beat base ~50.8%; formal floor; roman not ~0%).
3. **Honest UI modes:** `saved phrase` · `word guess` · `on-device model` — never label lexicon as neural.
4. **Register that works** — model control tokens / adapters; stop pronoun-only rewrite as the primary path.
5. **Sentence-chunk parity** — Auto and Conversation use the same sentence pipeline.
6. **Docs match binary** — README / OFFLINE_IOS / INTENT align with TestFlight truth.

### Should land in 1.5 (before 2.0)

1. Trust copy: no “fully offline on this device” while STT is Apple network-capable.
2. Surface phrase vs lexicon in result chrome.
3. Conversation: Retry last turns; Settings reachable from Conversation; TTS↔STT mutex.
4. Single `listenSession` owner for Auto + Conversation.
5. Gold: explicit pair ids; don’t hide NE→EN paraphrase collisions; exclude split parents from eval.
6. Automated Jest suite (this PR) + CI.

### Later (2.1+)

- whisper.rn offline STT  
- First-launch model download UX  
- Separate formal/informal ONNX graphs  
- Android production surface  

### Explicitly do NOT do

Camera/OCR · extra languages · PC hybrid · glasses · promote Gold Review into traveler chrome · claim neural in App Store until gates pass.

---

## Agent scorecards (abbreviated)

| Agent | Top finding |
|-------|-------------|
| **A UX** | Biggest risk is authoritative-looking lexicon mashups + offline overclaim |
| **B MT** | No models in IPA; overnight FT has not cleared formal floor; roman hard |
| **C STT** | `listenSession` unused; Auto locale remount mid-utterance; TTS echo on Pass |
| **D Gold** | Paired UI productivity win; NE→EN English-key collisions hide rows |
| **E Scope** | 2.0 = neural MT; stay 1.5 until then |
| **F QA** | Zero tests → jest-expo wave-1 on pure helpers |

---

## Quality gates added this cycle

- `npm test` / `npm run test:ci` in `mobile/`
- GitHub Action: `.github/workflows/mobile-unit-tests.yml`
- Device checklist: `mobile/docs/V2_DEVICE_CHECKLIST.md`

---

## Recommended roadmap

```
1.5.x  honesty · Jest · listen FSM · Conversation retry
  │
  ├─ export ONNX + on-device gold re-score
  │
2.0.0  neural default · honest badges · gold gates green
  │
2.1    whisper.rn · model download · formal/informal graphs
```
