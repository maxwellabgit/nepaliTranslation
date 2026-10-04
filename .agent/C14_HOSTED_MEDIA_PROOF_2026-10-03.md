# C14 controlled hosted contribution round trip

Project: jcrpxoojxixoieqqfgzo. Owner explicitly approved a temporary project-wide
text/speech flag window for synthetic capture, retrieval and deletion, followed
by restoration. No human recording or real contributed content was used.

The reproducible staged probe is `guest-hosted-deployment/prove-hosted-media.mjs`.
Only the public publishable client key is used. Synthetic guest credentials live
in an OS temporary private file and are never printed or committed.

Observed:
- Real anonymous guest Auth; general acceptance alone denied text upload403.
- Current specific contribution consent, speech initially false; speech upload
  denied403 until the separate synthetic speech choice was recorded.
- Typed feedback inserted once; retry409 returned the same report ID.
- Two independent Today's10 answers retained original and revised corrections.
- A generated one-second PCM WAV,16044 bytes, uploaded and completed privately;
  owner download was byte-exact, SHA256
  `56d4af65701c26df20bd4021eda95b6e830348ce3a746086079fe89285548dc9`.
- Another guest could not read the profile or binary; guest admin access403.
- Actual signed-in owner console showed all4records. Signed preview loaded1second,
  readyState4/noerror. Fresh audited JSON export displayed all4IDs, both revisions
  and speech linkage; training/public-display eligibility false on every record.
- Text/speech flags restored off (config version12); photos/public-review stayedoff.
- Deletion requested2026-10-04T01:35:31.239841Z; retry retained original due date.
  Subsequent text upload403. Purge completed01:36:00.508663Z (~29.3seconds).
- Owner endpoint confirmed cleared consent/speech, preserved UUID and unchanged
  credit rows. Post-purge private binary retrieval failed.
- Privileged read-only SQL independently returned reports0/media rows0/storage
  objects0/identity1/export audits2/any collection-enabled=false.
- Operator reload returned0eligible records. No new screenshots/recordings.

This proves hosted synthetic capture/export/storage-first purge, not native
microphone capture, cohort consent UX, certification of anonymization, live ads,
StoreKit or public release. Private guest-linked raw content is not anonymous.

Independent review found that the first probe accepted any failed storage read
as denial/removal. Repaired it to require HTTP400/404 with Storage statusCode404,
and persist IDs after each mutation for cleanup on failure. A second complete
synthetic capture/deletion run passed: cross-owner HTTP400/storage404; request
01:38:49.270499Z, purge01:39:00.340504Z (~11.1seconds), fresh post-purge lookup
HTTP400/storage404. Final collection flags are off at version16.
Final privileged SQL covering both cohorts returned reports0/media rows0/storage
objects0/identities2/any collection-enabled=false. Temporary credentials were
removed after both runs. Fresh independent reviewer rechecked the repaired probe
and evidence, verdict PASS with no material findings.

One previously successful owner URL returned a cached200 after backend purge.
The corrected probe uses a fresh no-cache URL for the authoritative object lookup.
This record claims actual database/object purge, not revocation of bytes already
cached by clients or immediate invalidation of every cached URL. Existing signed
preview lifetimes and the30-day deletion commitment still require native checks.

Credentials are removed after final status checks. No automatic training or
public display was enabled. Full C14/native/public gates remain open.
