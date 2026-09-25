# V1 requirement ledger

Candidate SHA: recorded in `.agent/V1_FINAL_CONTRACT_STATE.md`.
A PASS requires a run against that SHA. Source presence is not a PASS.
Internal TestFlight: NO-GO. Public V1: NO-GO.

| ID | Area | Status | Evidence |
| --- | --- | --- | --- |
| 1 | First launch, guest core | NOT RUN | No guest device capture |
| 2 | Bilingual UI | NOT RUN | No bilingual device pass |
| 3 | Legal URLs live | BLOCKED | URLs are not a hosted proof |
| 4 | EN→NE model quality | FAIL | `docs/MODEL_CERT.md` formal chrF 0.4468 < 0.55; not re-run |
| 5 | NE→EN model quality | NOT RUN | Exact-weight certificate not re-run |
| 6 | Register floors | FAIL | Same certificate: both register-rate floors failed |
| 7 | Offline model availability | NOT RUN | No low-storage or interrupted-download device run |
| 8 | English on-device speech | BLOCKED | No physical iPhone or iPad |
| 9 | Nepali on-device speech | BLOCKED | No physical device; local Nepali model is not the wired runtime |
| 10 | Camera OCR and temp files | BLOCKED | No native device proof |
| 11 | Camera layout | BLOCKED | No iPad proof |
| 12 | Learn alphabet | NOT RUN | No bilingual reviewer or device audio check |
| 13 | History stays local for guests | NOT RUN | No device proof |
| 14 | Startup consent subject | PASS | Fresh and upgrade `supabase test db`, including test 26, at the candidate that contains `20260924120000` |
| 15 | Sharing toggles per account | PASS | Same SQL suite; pre-fix profile kept its row and sharing defaulted off |
| 16 | Media queue owner | NOT RUN | Mobile unit tests only. No signed-URL race or private-bucket round trip |
| 17 | 30-day deletion | NOT RUN | Server completion timestamp is in source. No hosted receipt |
| 18 | Today's 10 one route | NOT RUN | No two-user review day |
| 19 | Rights deny-by-default | PASS | Node `reviewEligibility.test.mjs` and pgTAP 19 / 22 on fresh and upgrade databases |
| 20 | Lookahead 14/28 and DST | PASS | Node `reviewLookahead.test.mjs` and pgTAP 24. Fourteen days do not enable public review |
| 21 | Credits 2 / 4 and no clawback | PASS | Node `sourceWordCount.test.mjs` and pgTAP 23. No concurrent-close device proof |
| 22 | Source and target exclusions | PASS | pgTAP 19 asserts both hashes on confirm/edit. Export filter unit test drops an exposed source and target. Live corpus scan still has zero committed exposures |
| 23 | Ad-free time display | NOT RUN | Gauge unit test only. No hosted entitlement proof |
| 24 | Rewarded video 30 minutes | NOT RUN | Deno SSV signature tests passed earlier. No hosted callback |
| 25 | Interstitial 15 minutes, no daily cap | NOT RUN | No native impression proof |
| 26 | Subscription price and restore | BLOCKED | StoreKit and NPR 199 price point are not configured |
| 27 | Ads suppressed while entitled | NOT RUN | No device ad run |
| 28 | Privacy of optional services | NOT RUN | Flags default off. No hosted secret or RLS audit on a deployed project |
| 29 | Exact model certificate | FAIL | Weights absent or certificate below the English-to-Nepali floors |
| 30 | Release operations | BLOCKED | No EAS build, staging jobs, or physical-device matrix |
