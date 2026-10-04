# C5 private export usability

The owner approved controlled production synthetic collection on 2026-10-03.
The signed-in operator console retrieved four actual hosted records: typed
feedback, two independent Today's 10 answer revisions, and generated speech.
The private audio preview loaded with duration 1 second, readyState 4 and no error.

Added **Show JSON export**, which refetches through the same audited export
endpoint and displays portable JSON for browsers that do not deliver Blob
downloads. The synthetic hosted view returned all four IDs, original/revised
answers and speech linkage metadata; every row is private_review_only with
training_eligible=false and public_display_eligible=false. No token or signed
media URL appears in the JSON. Close clears the visible export; navigation and
unmount discard late responses. Download attaches the anchor and defers Blob
revocation until the browser has a chance to read it.

Validation: admin tests 8/8, typecheck and production build PASS. Sandbox esbuild
resolution initially failed; approved escalation passed. Fresh read-only
`/independent-reviewer` export_final_review independently ran all 8 tests and
typecheck, verdict PASS with no material findings. Native proof and downloaded
file-byte proof are separate; the actual hosted JSON export view is verified.
