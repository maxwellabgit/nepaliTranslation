# C10 iOS production configuration

Owner-approved public pages are live and byte-verified. EAS preview/production
now store all five matching legal/support/app-ads URLs, approved iOS owner app
and three ad-unit IDs, and the same Bola Supabase project/publishable key.
Sanitized exact CLI readback: C10_EAS_PRODUCTION_CONFIG_2026-10-03.json.
RevenueCat key and enrolled-device entries remain absent. Live ad mode is not
enabled by this preparation; testflight explicitly forces Google demo units.

Found an actual iOS build blocker: app.config required an unrelated owned
Android app ID for live iOS builds. The unused Expo Android plugin field now
uses a safe demo placeholder; owned iOS app/units remain required.
Fresh review caught a corresponding runtime validator rejecting that Android
placeholder and disabling requests. Repaired runtime validation and replaced
the canned live-bundle fixture with real app.config output → runtime resolution.
Independent tests verify each iOS app/unit still rejects demo/missing values,
normal TestFlight stays demo, and SSV requires a registered physical test device.
No Android product or native live-serving proof is claimed.

Validation: final full mobile verify:ci PASS613mobile,4configtests, translation
checks,18modelpins,21Doctorchecks, unchanged coverage and web export. Fresh
independent reviewer final PASS after the runtime repair; focused11tests/4config
tests and five local legal-URL bindings PASS. Remote exact-source CI follows
the scoped commit; the earlier cabf7d6 C6 backend/agent runs37172010881/37172010893
are both SUCCESS, including the new public-support job14tests.

Actual AdMob console: payment setup incomplete; its notice explicitly says app
reviews remain blocked until payment information is added. App-store details
are unlinked; exact Apple ID6792574384 lookup returned no listing. Payment page
opened for owner handoff. These are real revenue prerequisites, not code fixes.
Root app-ads hosting is complete, but store developer-website linkage, crawl
approval, UMP configuration and actual native impressions/receipts remain open.
Apple and RevenueCat tabs currently remain at sign-in; no console configuration
or private credential completion is invented. Existing project-wide service
flags are unchanged and optional collection/paywall remainoff.
