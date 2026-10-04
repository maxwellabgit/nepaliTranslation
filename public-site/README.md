# Bola public pages and private support

Status: owner-approved copy **published and HTTPS content verified** at
https://maxwellabgit.github.io. Private support backend is deployed. Real guest
API ownership/retry/deletion tests pass; operator-browser reply/retrieval passes.
Native support UX requires a build newer than25. Browser deletion confirmation
in the local preview requires the recorded human handoff to finish.

Build from repository root: `node public-site/build.cjs`.
Regression tests: `node public-site/support.test.cjs`.
Loopback review: `node public-site/preview.cjs`, then
`http://127.0.0.1:5180/`. No screenshots or recordings are created.

The generated `site/` directory contains only public static files and the
Supabase publishable key. No owner contact details, passwords, service keys,
contributions, recordings, or admin sessions are included. The browser form
creates/reuses its own guest only after explicit opening. Entered messages and
retry IDs stay bound to that identity; identity changes isolate them. Support
content is private, distinct from contributions and excluded from training.

After specific owner approval, `node public-site/publish.cjs --owner-approved`
publishes the exact allowlist to `maxwellabgit/maxwellabgit.github.io`, using
the existing GitHub CLI authentication. It refuses unexpected source settings,
unrelated destination files, additional local files, secret values and mismatched
publisher IDs. Updates use a normal fast-forward, never force. The resulting
publication manifest records a commit; it does **not** prove HTTP availability.

Before configuring the app/store/AdMob, verify HTTPS200 for `/privacy.html`,
`/terms.html`, `/support.html`, `/deletion.html`, and root `/app-ads.txt`;
verify exact reviewed page content and publisher line. GitHub Pages must serve
legacy `main` root. Keep the owner approvals, hosted proof, URL verification and
native tests distinct. No App Store release or revenue is asserted by this site.
