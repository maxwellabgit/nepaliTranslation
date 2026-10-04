# C6 explicit-purpose private support

Owner asked for support through Supabase without a public email/domain. Settings
now provides Support and routes inappropriate-ad reports to the same form.
It sends only the entered message, category, app version and authenticated guest
identity after a separate visible support disclosure/choice. No history, audio,
photos, contribution consent or contact email is attached. Messages stay outside
contribution/training/public-review exports. General support is not model consent.

Private SQL functions derive ownership from auth.uid(), limit payloads and
request volume, serialize per-guest submissions and preserve idempotency.
Guest list/delete cannot select another subject. Operators require existing
service-only admin assertions; reads/replies are audited without raw content.
Stable (created_at,id) pagination preserves access to older requests. Users read
replies and explicitly confirm immediate support-message/reply deletion in app.
Support is separate from contribution withdrawal/Delete shared data, whose text
specifically promises contributed text/audio deletion. It creates no review credits.

Drafts are local and keyed by the original guest/category. Hydration gates edits;
same-message retries preserve client IDs, including after app updates. Failed
requests retain drafts, successful delivery is not reported failed if reply refresh
fails, and owner/list-generation guards discard stale snapshots. No account UI.

Validation: support9 focused tests PASS; admin10 tests/typecheck/build PASS;
Edge69 tests PASS; mobile lint/typecheck PASS. Fullverify:ci passed beta, unchanged
coverage and web export before the final list-order patch; final focused/lint/type
checks passed afterward. Remote exact-source mobile/fresh/upgraded SQL CI is
required before deployment. Initial full beta failure was a stale Nepali literal
test expectation; corrected it to check publication/help semantics without email.
Local Docker daemon is unavailable; no local SQL execution is invented.

Fresh independent reviewer initially found pagination, hydration, app-update
retry, unsupported-email and late-list races. All repaired with regressions;
final source verdict PASS, no material findings. Hosted SQL/admin-api, new support
copy owner/bilingual sign-off and native capture/UX remain pending. Existing owner
approval of contribution disclosures does not invent approval of this new copy.
