"""Mapped sheet rows stay unapproved and out of gold."""
from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from training.improve_sheet_meanings import REVIEW_COLUMNS, improve


def write_sheet(path: Path, rows: list[dict]) -> None:
    fields = [
        "english",
        "devanagari",
        "devanagari_informal",
        "roman",
        "roman_informal",
        "set_name",
        "id",
        "provenance",
        "source_file",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


class ImproveSheetMeanings(unittest.TestCase):
    def test_blank_approvals_and_exclusions(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            sheet = root / "sheet.csv"
            out = root / "improved"
            write_sheet(
                sheet,
                [
                    {
                        "english": "Please give me a receipt.",
                        "devanagari": "मलाई रसिद देऊ न।",
                        "devanagari_informal": "मलाई रसिद देऊ न।",
                        "roman": "malai rasida deu na.",
                        "roman_informal": "malai rasida deu na.",
                        "set_name": "meaning_bank",
                        "id": "questions_requests_00012",
                        "provenance": "assistant_curated",
                        "source_file": "meaning_bank.jsonl",
                    },
                    {
                        "english": "Please give me a receipt.",
                        "devanagari": "कृपया मलाई रसिद दिनुहोस्।",
                        "devanagari_informal": "मलाई रसिद देऊ।",
                        "roman": "kripya malai rasida dinuhos.",
                        "roman_informal": "malai rasida deu.",
                        "set_name": "meaning_bank",
                        "id": "questions_requests_00011",
                        "provenance": "assistant_curated",
                        "source_file": "meaning_bank.jsonl",
                    },
                    {
                        "english": "Could you tell me your name?",
                        "devanagari": "यो निलो कागजको सारस हो।",
                        "devanagari_informal": "यो निलो कागजको सारस हो।",
                        "roman": "yo nilo kagajko saras ho.",
                        "roman_informal": "yo nilo kagajko saras ho.",
                        "set_name": "conversation_seeds",
                        "id": "bal_0001",
                        "provenance": "",
                        "source_file": "",
                    },
                    {
                        "english": "A public benchmark sentence.",
                        "devanagari": "यो वाक्य हो।",
                        "devanagari_informal": "यो वाक्य हो।",
                        "roman": "yo vakya ho.",
                        "roman_informal": "yo vakya ho.",
                        "set_name": "flores101_dev",
                        "id": "fx",
                        "provenance": "",
                        "source_file": "",
                    },
                ],
            )
            manifest = improve(sheet, out)
            self.assertEqual(manifest["accepted_for_training"], 0)
            self.assertEqual(manifest["accepted_for_benchmark"], 0)
            self.assertFalse((out / "train_en-ne.jsonl").exists())
            self.assertFalse((Path("benchmarks") / "gold" / "sheet50").exists())

            with (out / "meaning_review.csv").open(encoding="utf-8", newline="") as handle:
                review = list(csv.DictReader(handle))
            self.assertTrue(review)
            for row in review:
                self.assertEqual(row["reviewer_decision"], "")
                self.assertEqual(row["source_rights"], "")
                self.assertEqual(row["reviewer"], "")
                self.assertEqual(list(row), REVIEW_COLUMNS)
            fixed = next(row for row in review if row["meaning_id"] == "questions_requests_00012")
            self.assertEqual(fixed["ne_formal"], "कृपया मलाई रसिद दिनुहोस्।")
            self.assertEqual(fixed["ne_informal"], "मलाई रसिद देऊ न।")
            self.assertIn("ne_formal taken from", fixed["correction_note"])

            excluded = [
                json.loads(line)
                for line in (out / "excluded.jsonl").read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            reasons = {row["meaning_id"]: row["exclusion_reason"] for row in excluded}
            self.assertEqual(reasons["bal_0001"], "public_review_exposure")
            self.assertEqual(reasons["fx"], "benchmark_match")


if __name__ == "__main__":
    unittest.main()
