# Rewarded review prompts

`review_pool/for_review.jsonl` contains the 200 new prompts. The owner authorized public review on 2026-09-25. The old 40-row blind split is retired: none of these prompts or later reviewer responses may be used for training or ship evaluation. `base_vs_e1_val.jsonl` remains an evaluation-only diagnostic and is never imported into public review.

The `prompts.jsonl` and `candidates.jsonl` files on `main` retain the original 200 sources and 370 unapproved model suggestions. `review_pool/for_review.jsonl` is the selected display projection of those sources: it shows at most one machine suggestion per prompt. The importer reads only the registered review-pool file, never the raw candidate file.

Of the 200 prompts, 135 have an **unverified machine suggestion**. The other 65 (including every Roman Nepali prompt) have no suggestion; a reviewer must write a translation. `bal_0004` has no suggestion because its generated target matched a gold blocklist entry. The review UI labels unverified suggestions and disables Confirm on source-only prompts; the database enforces the latter as well. A rewarded review is a user submission, not an approved training reference.

The corpus is declared as `balance-public-review-prompts` in `datasets/corpus-registry.json`. The importer rejects PII, hashes source and target, imports only this file for this corpus, and respects exposure exclusions. Submissions go through the owner-authenticated RPC; callers cannot insert their own credit snapshots. The release flag, contribution consent, rights inventory, 14-day lookahead, and hosted scheduler still govern visibility and credits.
