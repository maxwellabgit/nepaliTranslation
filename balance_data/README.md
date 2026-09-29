# Rewarded review prompts

`review_pool/for_review.jsonl` is the Today's 10 lineup. It has one row for each English sample in `datasets/sheets/review_pool.csv`, repeated for formal Devanagari, informal Devanagari, formal roman, and informal roman. The previous 200-prompt, 20-day lineup is replaced by this file. Gold and FLORES+ are not in it. The old 40-row blind split is retired: none of these prompts or later reviewer responses may be used for training or ship evaluation. `base_vs_e1_val.jsonl` remains an evaluation-only diagnostic and is never imported into public review.

`prompts.jsonl` and `candidates.jsonl` keep the retired 200-prompt archive and its old suggestions. The importer reads only `review_pool/for_review.jsonl`. A rewarded review is a user submission, not an approved training reference.

The corpus is declared as `balance-public-review-prompts` in `datasets/corpus-registry.json`. The importer rejects PII, hashes source and target, imports only this file for this corpus, and respects exposure exclusions. Submissions go through the owner-authenticated RPC; callers cannot insert their own credit snapshots. The release flag, contribution consent, rights inventory, 14-day lookahead, and hosted scheduler still govern visibility and credits.
