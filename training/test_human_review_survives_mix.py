"""A reviewed edit must survive mix prep and appear in the train rows.

Does not read or rewrite training/data/meaning_bank.jsonl.
"""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import training.prepare_cpu_mix as mix


class HumanReviewSurvivesMix(unittest.TestCase):
    def test_reviewed_edit_reaches_train_file(self) -> None:
        row = {
            "meaning_id": "review_fixture_0001",
            "english": "Please hold this blue ticket at the side window.",
            "ne_formal": "कृपया यो निलो टिकट छेउको झ्यालमा समात्नुहोस्।",
            "ne_informal": "यो निलो टिकट छेउको झ्यालमा समात्नुहोस्।",
            "roman_formal": "kripya yo nilo tikat cheuko jhyalama samatnuhos.",
            "roman_informal": "yo nilo tikat cheuko jhyalama samatnuhos.",
            "surface": "travel",
            "provenance": "human_meaning_review",
            "unit": "sentence",
        }
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp)
            (data / "meaning_bank.jsonl").write_text(
                json.dumps(row, ensure_ascii=False) + "\n", encoding="utf-8"
            )
            original = mix.DATA
            mix.DATA = data
            try:
                meanings = mix.clean_bank(mix.load_blocklist())
            finally:
                mix.DATA = original

        self.assertEqual([m["meaning_id"] for m in meanings], ["review_fixture_0001"])
        self.assertEqual(meanings[0]["provenance"], "human_meaning_review")
        examples = mix.expand_train(meanings)
        formal = [ex for ex in examples if ex["register"] == "formal" and ex["direction"] == "en-ne"]
        self.assertEqual(len(formal), 1)
        self.assertIn("blue ticket", formal[0]["src"])
        self.assertEqual(formal[0]["provenance"], "human_meaning_review")
        self.assertIn("निलो", formal[0]["tgt"])


if __name__ == "__main__":
    unittest.main()
