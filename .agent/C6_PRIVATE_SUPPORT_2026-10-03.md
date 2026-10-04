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
checks passed afterward. Exact source6f30ccf CI is green: branch backend37169269458 proves375SQL
on fresh and upgraded schemas, real Auth/storage/export/purge, concurrency and
admin10; agent37169269492 proves583unit+30integration=613mobile, unchanged
coverage, Doctor/export/browser/exclusions/pins/secrets. This is source proof,
not hosted support deployment. Initial full beta failure was a stale Nepali literal
test expectation; corrected it to check publication/help semantics without email.
Local Docker daemon is unavailable; no local SQL execution is invented.

Fresh independent reviewer initially found pagination, hydration, app-update
retry, unsupported-email and late-list races. All repaired with regressions;
final source verdict PASS, no material findings. Hosted SQL/admin-api, new support
copy owner/bilingual sign-off and native capture/UX remain pending. Existing owner
approval of contribution disclosures does not invent approval of this new copy.

Public-page continuation: bilingual policy/support/delete pages and root
app-ads.txt prepared in public-site/. Fresh review found unbound browser retry
and stale deletion acknowledgements plus an unscoped18+ Terms line. Repaired
with original-owner tokens/envelopes, auth-generation guards, explicit opening
before editing and contribution-only18+ context. Durable synthetic browser
regressions pass; public publication, new-copy owner sign-off and hosted support
submit/reply/delete proof remain pending. Exact6f30 backend source is packaged
in guest-hosted-deployment/support-manifest.json; package is not deployment.

Final fresh public-site/publisher review PASS, no material findings.14/14
synthetic regressions pass, including exact asset allowlist, existing Pages
preflight and no-force publication guards. Owner approved the bilingual support
and public copy plus publication at https://maxwellabgit.github.io on2026-10-03.
Live support rollout and synthetic support deletion confirmation remain pending;
publication is not yet performed. Hosted/new native support proof remains open.

Later current result: owner approved live rollout and synthetic support test.
SQL/admin-api deployed with source/permissions readback, real guest ownership/
retry/deletion and operator reply/retrieval PASS. Approved pages published and
9HTTPS assets byte-verified. See C6_PUBLIC_SUPPORT_HOSTED_2026-10-03.md; it
supersedes earlier pending-deployment/publication statements, while native proof
and the browser confirmation handoff remain separately open.
