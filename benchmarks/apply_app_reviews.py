#!/usr/bin/env python3
"""Apply exported in-app Gold Review JSON back onto benchmarks/gold/.

Export from the app (clipboard) looks like:
{
  "exported_at": "...",
  "reviews": {
    "en_ne_formal-001": {
      "id": "...",
      "class_id": "...",
      "source_final": "...",
      "reference_final": "...",
      "action": "accepted"|"edited",
      "completed_at": "...",
      "provenance": {...}
    }
  }
}
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GOLD = ROOT / "gold"
OUT_LOG = ROOT / "results" / "human_gold_apply.json"


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("export_json", type=Path, help="JSON exported from Gold Review")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    payload = json.loads(args.export_json.read_text(encoding="utf-8"))
    reviews = payload.get("reviews") or payload
    if not isinstance(reviews, dict):
        raise SystemExit("expected reviews object")

    applied = []
    by_class: dict[str, list[dict]] = {}
    for rid, rev in reviews.items():
        if not rev.get("completed_at"):
            continue
        cid = rev.get("class_id") or rid.rsplit("-", 1)[0]
        by_class.setdefault(cid, []).append(rev)

    for cid, revs in by_class.items():
        folder = GOLD / cid
        if not folder.exists():
            print("skip missing class", cid)
            continue
        sources = {r["id"]: r for r in load_jsonl(folder / "sources.jsonl")}
        refs = {r["id"]: r for r in load_jsonl(folder / "references.jsonl")}
        for rev in revs:
            rid = rev["id"]
            # Sentence-split children from in-app review (id__s1, id__s2, …)
            if "__s" in rid and rev.get("split_from"):
                parent = rev["split_from"]
                src = {
                    "id": rid,
                    "source": rev.get("source_final", "").strip(),
                    "status": "human_gold",
                    "split_from": parent,
                    "split_index": rev.get("split_index"),
                    "human_review": {
                        "action": rev.get("action"),
                        "completed_at": rev.get("completed_at"),
                        "provenance": rev.get("provenance"),
                    },
                    "unit": "sentence",
                }
                if rev.get("deva"):
                    src["deva"] = rev["deva"]
                sources[rid] = src
                refs[rid] = {
                    "id": rid,
                    "reference": rev.get("reference_final", "").strip(),
                }
                applied.append(
                    {
                        "id": rid,
                        "class_id": cid,
                        "action": "split_child",
                        "split_from": parent,
                        "dataset_id": (rev.get("provenance") or {}).get("dataset_id"),
                    }
                )
                continue

            if rid not in sources:
                print("missing source", rid)
                continue
            src = sources[rid]
            ref = refs.setdefault(rid, {"id": rid})
            if rev.get("action") == "split":
                src["status"] = "human_gold_split_parent"
                src["human_review"] = {
                    "action": "split",
                    "completed_at": rev.get("completed_at"),
                    "provenance": rev.get("provenance"),
                    "note": "Replaced by sentence-split children in export",
                }
            else:
                src["source"] = rev.get("source_final", src.get("source", "")).strip()
                ref["reference"] = rev.get("reference_final", ref.get("reference", "")).strip()
                src["status"] = "human_gold"
                src["human_review"] = {
                    "action": rev.get("action"),
                    "completed_at": rev.get("completed_at"),
                    "provenance": rev.get("provenance"),
                    "multi_sentence_flag": rev.get("multi_sentence_flag"),
                }
                src["unit"] = "sentence"
                if rev.get("deva"):
                    src["deva"] = rev["deva"]
            applied.append(
                {
                    "id": rid,
                    "class_id": cid,
                    "action": rev.get("action"),
                    "dataset_id": (rev.get("provenance") or {}).get("dataset_id"),
                }
            )
        if not args.dry_run:
            write_jsonl(folder / "sources.jsonl", list(sources.values()))
            write_jsonl(folder / "references.jsonl", list(refs.values()))
            man_path = folder / "manifest.json"
            if man_path.exists():
                man = json.loads(man_path.read_text(encoding="utf-8"))
                for it in man.get("items", []):
                    if it.get("id") in {r["id"] for r in revs}:
                        it["status"] = "human_gold"
                man_path.write_text(json.dumps(man, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    log = {
        "applied_at": datetime.now(timezone.utc).isoformat(),
        "n_applied": len(applied),
        "dry_run": args.dry_run,
        "items": applied,
    }
    OUT_LOG.parent.mkdir(parents=True, exist_ok=True)
    OUT_LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"applied {len(applied)} human-gold rows (dry_run={args.dry_run})")
    print("log", OUT_LOG)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
