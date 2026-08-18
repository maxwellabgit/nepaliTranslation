#!/usr/bin/env python3
"""No-GPU gold-holdout integrity checker.

Fails (exit 1) unless every check passes:

  * per-class n sources == n references == manifest n_filled
  * every id joins across sources / references / manifest
  * no duplicate ids; no duplicate source|||reference pairs
  * freeze SHA256 + counts match live files (unless --update-freeze)
  * train blocklist contains every live gold source / reference / deva string
    (unless --update-freeze, which rewrites freeze + blocklist)
  * EN→NE register mix heuristics (तिमी+नुहोस्, तँ, wrong-class pronouns)
  * meaning_bank and CPU train/val jsonl do not contain live gold strings

Does not run GPU eval. Prints an IT2-weights blocker if artifacts are missing.

  python benchmarks/check_gold_integrity.py
  python benchmarks/check_gold_integrity.py --update-freeze
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))

from gold_holdout import (  # noqa: E402
    BLOCKLIST_PATH,
    CLASSES,
    FREEZE_PATH,
    GOLD,
    POST_FREEZE_IDS,
    SCHEMA_PATH,
    freeze_norm,
    it2_weights_present,
    live_block_strings,
    load_class,
    load_jsonl,
    write_freeze,
)

CONTROL_PREFIX = re.compile(
    r"^(?:<(?:formal|informal|en|ne|en-ne|ne-en)>\s*)+",
    re.IGNORECASE,
)
FORMAL_VERB = re.compile(r"नुहोस्|नुहुन्छ|नुभएको|नुभयो")
TAAN = re.compile(r"(?:^|[^\u0900-\u097F])तँ")
# तँ-class 2sg copula/verbs; must not pair with तिमी
TAAN_VERB = re.compile(r"छस्|गर्छस्")

TRAIN_FAIL_PATHS = [
    REPO / "training" / "data" / "meaning_bank.jsonl",
    REPO / "training" / "data" / "train_clean_en-ne.jsonl",
    REPO / "training" / "data" / "train_clean_ne-en.jsonl",
    REPO / "training" / "data" / "val_clean_en-ne.jsonl",
    REPO / "training" / "data" / "val_clean_ne-en.jsonl",
    REPO / "mobile" / "assets" / "data" / "meaning_bank.jsonl",
    REPO / "training" / "data" / "meaning_review_pack.json",
    REPO / "mobile" / "assets" / "meaning" / "review_pack.json",
    REPO / "datasets" / "gold" / "sources" / "nepali_trusted" / "from_meaning_bank.jsonl",
    REPO / "datasets" / "gold" / "sources" / "parallel_trusted" / "meaning_bank_hand.jsonl",
]

# Input pools filtered at ingest — report, do not fail CI on leftover overlap.
TRAIN_WARN_PATHS = [
    REPO / "training" / "data" / "train_user_conversation_seeds.jsonl",
    REPO / "training" / "data" / "external" / "nepali_translation_gold_candidates.csv",
]

GOLD_DOMAIN_NAME_HINTS = (
    "train_gold_domain",
    "val_gold_domain",
    "gold_domain_manifest",
)

TEXT_KEYS = (
    "source",
    "reference",
    "src",
    "tgt",
    "english",
    "eng_Latn",
    "npi_Deva",
    "ne_formal",
    "ne_informal",
    "roman_formal",
    "roman_informal",
    "deva",
    "nepali",
    "text",
    "en",
    "ne",
    "english_anchor",
)


def strip_control(s: str) -> str:
    return CONTROL_PREFIX.sub("", (s or "").strip())


def gold_norm_set() -> set[str]:
    src, ref = live_block_strings()
    return src | ref


def fail(issues: list[dict], code: str, msg: str, **extra) -> None:
    rec = {"code": code, "msg": msg}
    rec.update(extra)
    issues.append(rec)


def check_inventory(issues: list[dict]) -> list[dict]:
    rows = []
    for cls in CLASSES:
        packed = load_class(cls)
        sources, refs, man = packed["sources"], packed["references"], packed["manifest"]
        src_ids = [r["id"] for r in sources]
        ref_ids = [r["id"] for r in refs]
        man_ids = [it["id"] for it in man.get("items") or []]
        n_src, n_ref, n_man = len(src_ids), len(ref_ids), len(man_ids)
        n_filled = man.get("n_filled")
        rec = {
            "class": cls,
            "n_sources": n_src,
            "n_references": n_ref,
            "n_manifest_items": n_man,
            "n_filled": n_filled,
            "n_target": man.get("n_target"),
            "n_premium": man.get("n_premium"),
        }
        rows.append(rec)
        if not (n_src == n_ref == n_man == n_filled):
            fail(
                issues,
                "count_mismatch",
                f"{cls}: sources={n_src} refs={n_ref} manifest_items={n_man} n_filled={n_filled}",
                class_id=cls,
            )
        dup_src = [i for i, c in Counter(src_ids).items() if c > 1]
        dup_ref = [i for i, c in Counter(ref_ids).items() if c > 1]
        dup_man = [i for i, c in Counter(man_ids).items() if c > 1]
        if dup_src or dup_ref or dup_man:
            fail(
                issues,
                "duplicate_ids",
                f"{cls}: duplicate ids src={dup_src} ref={dup_ref} man={dup_man}",
                class_id=cls,
            )
        src_set, ref_set, man_set = set(src_ids), set(ref_ids), set(man_ids)
        if src_set != ref_set or src_set != man_set:
            fail(
                issues,
                "id_mismatch",
                f"{cls}: id sets do not join",
                class_id=cls,
                src_only=sorted(src_set - ref_set - man_set),
                ref_only=sorted(ref_set - src_set),
                man_only=sorted(man_set - src_set),
            )
        src_by = {r["id"]: r for r in sources}
        ref_by = {r["id"]: r for r in refs}
        pairs: list[str] = []
        for i in src_ids:
            s = src_by[i].get("source") or ""
            r = (ref_by.get(i) or {}).get("reference") or ""
            if not s.strip() or not r.strip():
                fail(issues, "empty_text", f"{cls} {i} has empty source or reference", class_id=cls, id=i)
            pairs.append(f"{s}|||{r}")
        dups = [k for k, c in Counter(pairs).items() if c > 1]
        if dups:
            fail(
                issues,
                "duplicate_pairs",
                f"{cls}: {len(dups)} duplicate source|||reference pairs",
                class_id=cls,
                pairs=dups[:20],
            )
    return rows


def check_freeze(issues: list[dict], update: bool) -> dict:
    if not FREEZE_PATH.exists():
        fail(issues, "freeze_missing", f"missing {FREEZE_PATH}")
        return {}
    freeze = json.loads(FREEZE_PATH.read_text(encoding="utf-8"))
    drift = []
    for cls in CLASSES:
        packed = load_class(cls)
        fr = (freeze.get("classes") or {}).get(cls) or {}
        live_n = len(packed["sources"])
        fr_n = fr.get("n")
        sha_live = packed["sha256"]
        sha_fr = fr.get("sha256") or {}
        rec = {
            "class": cls,
            "live_n": live_n,
            "freeze_n": fr_n,
            "delta_n": (live_n - fr_n) if isinstance(fr_n, int) else None,
            "post_freeze_ids": POST_FREEZE_IDS.get(cls, []),
            "sha_match": {
                k: sha_live.get(k) == sha_fr.get(k) for k in ("sources", "references", "manifest")
            },
            "live_sha256": sha_live,
            "freeze_sha256": sha_fr,
        }
        drift.append(rec)
        mismatched = [k for k, ok in rec["sha_match"].items() if not ok]
        if live_n != fr_n or mismatched:
            extra = ""
            if rec["delta_n"]:
                extra = f" live-freeze n delta={rec['delta_n']:+d} ids={rec['post_freeze_ids']}"
            fail(
                issues,
                "freeze_drift",
                f"{cls}: freeze n={fr_n} live n={live_n}; sha mismatch {mismatched}.{extra}",
                class_id=cls,
                update_freeze=update,
            )
    return {"frozen_at": freeze.get("frozen_at"), "classes": drift}


def check_blocklist(issues: list[dict]) -> dict:
    if not BLOCKLIST_PATH.exists():
        fail(issues, "blocklist_missing", f"missing {BLOCKLIST_PATH}")
        return {}
    bl = json.loads(BLOCKLIST_PATH.read_text(encoding="utf-8"))
    have = set(bl.get("sources") or []) | set(bl.get("references") or [])
    src_need, ref_need = live_block_strings()
    need = src_need | ref_need
    missing = sorted(need - have)
    if missing:
        fail(
            issues,
            "blocklist_incomplete",
            f"blocklist missing {len(missing)} live gold strings",
            missing_sample=missing[:30],
            missing_n=len(missing),
        )
    return {
        "blocklist_n": len(have),
        "live_gold_strings_n": len(need),
        "missing_n": len(missing),
        "frozen_at": bl.get("frozen_at"),
    }


def register_flags(cls: str, ref: str) -> list[str]:
    t = (ref or "").replace("तपाईँ", "तपाईं")
    has_tapai = "तपाईं" in t
    has_timi = "तिमी" in t or "तिम्रो" in t
    has_taan = bool(TAAN.search(t))
    has_formal_verb = bool(FORMAL_VERB.search(t))
    has_taan_verb = bool(TAAN_VERB.search(t))
    flags: list[str] = []
    if has_timi and has_formal_verb:
        flags.append("timi+formal_verb")
    if has_timi and has_taan_verb:
        flags.append("timi+taan_verb")
    if has_taan:
        flags.append("taan")
    if has_taan_verb:
        flags.append("taan_verb")
    if cls == "en_ne_formal" and has_timi:
        flags.append("formal_has_timi")
    if cls == "en_ne_informal" and has_tapai:
        flags.append("informal_has_tapai")
    return flags


def check_register(issues: list[dict]) -> dict:
    report: dict[str, dict] = {}
    mixed_ids: list[dict] = []
    for cls in ("en_ne_formal", "en_ne_informal"):
        packed = load_class(cls)
        src_by = {r["id"]: r for r in packed["sources"]}
        n_tapai = n_timi = n_neutral = 0
        flagged = []
        for row in packed["references"]:
            rid = row["id"]
            ref = row.get("reference") or ""
            src = (src_by.get(rid) or {}).get("source") or ""
            t = ref.replace("तपाईँ", "तपाईं")
            has_tapai = "तपाईं" in t
            has_timi = "तिमी" in t or "तिम्रो" in t
            if has_tapai:
                n_tapai += 1
            if has_timi:
                n_timi += 1
            if not has_tapai and not has_timi:
                n_neutral += 1
            flags = register_flags(cls, ref)
            if flags:
                item = {"id": rid, "class": cls, "source": src, "reference": ref, "flags": flags}
                flagged.append(item)
                mixed_ids.append(item)
                fail(
                    issues,
                    "register_mix",
                    f"{rid}: {', '.join(flags)}",
                    id=rid,
                    class_id=cls,
                    flags=flags,
                    source=src,
                    reference=ref,
                )
        report[cls] = {
            "n": len(packed["references"]),
            "tapai": n_tapai,
            "timi": n_timi,
            "neither_pronoun": n_neutral,
            "flagged": flagged,
        }
    report["mixed_register_ids"] = mixed_ids
    return report


def extract_texts(obj, acc: list[tuple[str, str]]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in TEXT_KEYS and isinstance(v, str) and v.strip():
                acc.append((k, v))
            else:
                extract_texts(v, acc)
    elif isinstance(obj, list):
        for x in obj:
            extract_texts(x, acc)


def scan_file_for_gold(path: Path, gold: set[str]) -> list[dict]:
    hits: list[dict] = []
    if not path.exists():
        return hits
    name = path.name
    if any(h in path.as_posix() for h in GOLD_DOMAIN_NAME_HINTS):
        return hits
    if path.suffix.lower() == ".csv":
        import csv

        with path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader, 1):
                for k, v in row.items():
                    if not v:
                        continue
                    n = freeze_norm(strip_control(v))
                    if n in gold:
                        hits.append({"line": i, "field": k, "text": v, "norm": n})
        return hits
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        obj = json.loads(text)
        acc: list[tuple[str, str]] = []
        extract_texts(obj, acc)
        for k, v in acc:
            n = freeze_norm(strip_control(v))
            if n in gold:
                hits.append({"line": 0, "field": k, "text": v, "norm": n})
        return hits
    for i, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        acc = []
        extract_texts(obj, acc)
        for k, v in acc:
            n = freeze_norm(strip_control(v))
            if n in gold:
                hits.append({"line": i, "field": k, "text": v, "norm": n, "meaning_id": obj.get("meaning_id")})
    return hits


def check_leakage(issues: list[dict]) -> dict:
    gold = gold_norm_set()
    fail_hits = {}
    warn_hits = {}
    for path in TRAIN_FAIL_PATHS:
        rel = str(path.relative_to(REPO)) if path.is_relative_to(REPO) else str(path)
        hits = scan_file_for_gold(path, gold)
        if hits:
            fail_hits[rel] = hits[:50]
            fail(
                issues,
                "train_gold_leak",
                f"{rel}: {len(hits)} gold-string field hits",
                path=rel,
                n=len(hits),
                sample=hits[:8],
            )
    for path in TRAIN_WARN_PATHS:
        if not path.exists():
            continue
        rel = str(path.relative_to(REPO))
        hits = scan_file_for_gold(path, gold)
        if hits:
            warn_hits[rel] = {"n": len(hits), "sample": hits[:5]}
    return {"fail": fail_hits, "warn_input_pools": warn_hits}


def check_schema_story(issues: list[dict]) -> dict:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8")) if SCHEMA_PATH.exists() else {}
    by_id = {c["id"]: c for c in schema.get("classes") or []}
    n_target = {cid: (by_id.get(cid) or {}).get("n_target") for cid in CLASSES}
    for cid in CLASSES:
        packed = load_class(cid)
        live_n = len(packed["sources"])
        schema_n = n_target.get(cid)
        if schema_n != live_n:
            fail(
                issues,
                "schema_n_target",
                f"schema.json n_target for {cid} is {schema_n}, live n is {live_n}",
                class_id=cid,
            )
    return {
        "schema_n_target": n_target,
        "schema_description": schema.get("description"),
    }


def print_report(payload: dict, issues: list[dict]) -> None:
    print("gold integrity")
    print(f"  freeze_file: {FREEZE_PATH.relative_to(REPO)}")
    fr = payload.get("freeze") or {}
    print(f"  freeze.frozen_at: {fr.get('frozen_at')}")
    print("  inventory:")
    for row in payload.get("inventory") or []:
        print(
            f"    {row['class']}: sources={row['n_sources']} refs={row['n_references']} "
            f"n_filled={row['n_filled']} n_premium={row['n_premium']}"
        )
    print("  freeze vs live:")
    for row in (fr.get("classes") or []):
        sha = row.get("sha_match") or {}
        ok = all(sha.values()) and row.get("live_n") == row.get("freeze_n")
        print(
            f"    {row['class']}: live_n={row['live_n']} freeze_n={row['freeze_n']} "
            f"delta={row.get('delta_n')} sha_ok={ok}"
        )
        if row.get("delta_n"):
            print(f"      +{row['delta_n']} ids: {row.get('post_freeze_ids')}")
    bl = payload.get("blocklist") or {}
    print(
        f"  blocklist: n={bl.get('blocklist_n')} live_gold={bl.get('live_gold_strings_n')} "
        f"missing={bl.get('missing_n')}"
    )
    reg = payload.get("register") or {}
    print("  register:")
    for cls in ("en_ne_formal", "en_ne_informal"):
        r = reg.get(cls) or {}
        print(
            f"    {cls}: n={r.get('n')} तपाईं={r.get('tapai')} तिमी={r.get('timi')} "
            f"neither={r.get('neither_pronoun')} flagged={len(r.get('flagged') or [])}"
        )
    mixed = reg.get("mixed_register_ids") or []
    if mixed:
        print("  mixed-register ids:")
        for item in mixed:
            print(f"    {item['id']} {item['flags']}: {item['source']!r} → {item['reference']!r}")
    else:
        print("  mixed-register ids: (none)")
    leak = payload.get("leakage") or {}
    if leak.get("fail"):
        print("  leakage FAIL:")
        for path, hits in leak["fail"].items():
            print(f"    {path}: {len(hits)} shown")
    else:
        print("  leakage FAIL paths: (none)")
    if leak.get("warn_input_pools"):
        print("  leakage WARN (ingest pools, filtered by prepare_*):")
        for path, info in leak["warn_input_pools"].items():
            print(f"    {path}: n={info['n']}")
    w = payload.get("it2_weights") or []
    if w:
        print(f"  IT2 weights on disk: {w}")
    else:
        print(
            "  IT2 weights: MISSING — do not run benchmarks/eval_it2_gold.py. "
            "Integrity script is the lane-1 gate."
        )
    print(f"  issues: {len(issues)}")
    for iss in issues:
        print(f"    [{iss['code']}] {iss['msg']}")
    print("  result:", "PASS" if not issues else "FAIL")


def main() -> int:
    ap = argparse.ArgumentParser(description="No-GPU gold holdout integrity")
    ap.add_argument(
        "--update-freeze",
        action="store_true",
        help="Rewrite gold_freeze.json + gold_train_blocklist.json from live gold. "
        "Refused if inventory, register, or train-leak checks fail.",
    )
    ap.add_argument("--json", action="store_true", help="Print full JSON report")
    args = ap.parse_args()

    issues: list[dict] = []
    inventory = check_inventory(issues)
    register = check_register(issues)
    leakage = check_leakage(issues)
    schema_info = check_schema_story(issues)
    blocking = [i for i in issues if i["code"] in {"count_mismatch", "id_mismatch", "duplicate_ids", "duplicate_pairs", "empty_text", "register_mix", "train_gold_leak", "schema_n_target"}]

    freeze_info: dict
    block_info: dict
    if args.update_freeze:
        if blocking:
            fail(
                issues,
                "update_freeze_refused",
                "--update-freeze refused: inventory/register/leakage must be clean first",
            )
            freeze_info = check_freeze(issues, update=True)
            block_info = check_blocklist(issues)
        else:
            freeze = write_freeze()
            print(
                f"updated freeze {FREEZE_PATH} frozen_at={freeze['frozen_at']} "
                f"blocklist sources={len(freeze['blocklist_norm_sources'])} "
                f"refs={len(freeze['blocklist_norm_refs'])}"
            )
            freeze_info = check_freeze(issues, update=False)
            block_info = check_blocklist(issues)
    else:
        freeze_info = check_freeze(issues, update=False)
        block_info = check_blocklist(issues)

    payload = {
        "inventory": inventory,
        "freeze": freeze_info,
        "blocklist": block_info,
        "register": register,
        "leakage": leakage,
        "schema": schema_info,
        "it2_weights": it2_weights_present(),
        "issues": issues,
        "pass": not issues,
        "update_freeze": args.update_freeze,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print_report(payload, issues)
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
