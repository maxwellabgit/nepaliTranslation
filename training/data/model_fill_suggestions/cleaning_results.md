# Model fill suggestions cleaning

Source: Untitled spreadsheet - model_fill_suggestions.csv
Input rows: 2681
Kept: 2044
Dropped: 637

## Drop reasons

- incomplete_translation: 280
- gold_exact_match: 267
- ui_or_format_string: 88
- latin_in_devanagari: 1
- markup: 1

Dropped UI and format strings (printf placeholders, {0} slots, menu mnemonics such as F_orward As), incomplete rows, mixed scripts, तँ/तैं, and exact gold source or reference matches.

Kept percentages such as 88% and prose ampersands in full sentences such as Arts & Sciences.

First independent review was NOT CLEAN: 12 rows remained ({0} slots, seven menu mnemonics, one Devanagari field with Latin letters). The rules were widened and the file was rebuilt from the original spreadsheet. Prose ampersands in long sentences were put back.

Short software labels without those patterns, such as Delete Thread, remain for human review.
