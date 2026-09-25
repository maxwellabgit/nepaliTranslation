# balance_data

The 59-row base-versus-E1 file only shows that the adapter changes outputs. It does not show that the adapter translates better. Those held-out lines are mostly short labels, so missing तपाईं, तपाईँ, and तिमी there does not settle register. The second-person prompts are the place to check register, including verb agreement when no pronoun is written.

Nothing here is part of the 543-row ship gold set. Do not run the ship certificate on this folder. An ONNX export is not required to review these prompts or to compare base and E1.

## Training candidates

`training_candidates/for_review.jsonl` is the 160 prompts not reserved below. A Nepali reviewer compares the suggestions with the source and writes `accepted_text`. Keep the original prompt, the chosen wording, `register`, and set `provenance` only after that acceptance. Suggestions stay unapproved until then.

## Blind benchmark

`benchmark_blind/for_reviewers.jsonl` is frozen first. Reviewers write `reference` from the source alone. Model suggestions are not in that file. `benchmark_blind/FREEZE.json` records the ids and source hashes. Do not add these rows to `benchmarks/gold/` in the middle of a ship run. After references exist, check meaning-level overlap with the training mix and with the frozen gold set before any training use.
