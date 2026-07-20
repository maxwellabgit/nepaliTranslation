#!/usr/bin/env python3
"""
Build ~1000 EN↔NE training pairs from OPUS GlobalVoices (2018Q4).

Verification strategy:
  - Use cesAlign document pairs (fromDoc ↔ toDoc) so Nepali articles are
    aligned to the corresponding English article, not merely same-topic crawl.
  - Keep only 1↔1 sentence links (skip many-to-many / many-to-one).
  - Require Devanagari on NE, Latin letters on EN, length/ratio sanity checks.
  - Preserve article IDs (EN+NE slugs/paths), URLs, author, translator.

Also ingest Law Commission / UI candidates CSV with provenance flags, and
attempt light government bilingual harvest when the live site is reachable.

Outputs under training/data/:
  train_global_voices_en_ne.jsonl
  train_law_gov_en_ne.jsonl
  sources_manifest_gv_law.json
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import json
import random
import re
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

REPO = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent / "data" / "raw"
OUT = Path(__file__).resolve().parent / "data"
GOLD_BLOCK = REPO / "benchmarks" / "data" / "gold_train_blocklist.json"
USER_CSV = Path(r"c:\Users\maxwe\Downloads\nepali_translation_gold_candidates.csv")

ALIGN_XML = RAW / "gv_moses" / "GlobalVoices.en-ne.xml"
EN_ZIP = RAW / "gv_en_raw.zip"
NE_ZIP = RAW / "gv_ne_raw.zip"

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
LATIN = re.compile(r"[A-Za-z]")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def load_blocklist() -> set[str]:
    blocked: set[str] = set()
    if GOLD_BLOCK.exists():
        g = json.loads(GOLD_BLOCK.read_text(encoding="utf-8"))
        for s in (g.get("sources") or []) + (g.get("references") or []):
            blocked.add(norm(s))
    gold = REPO / "benchmarks" / "gold"
    if gold.exists():
        for cls in gold.iterdir():
            if not cls.is_dir():
                continue
            for name in ("sources.jsonl", "references.jsonl"):
                p = cls / name
                if not p.exists():
                    continue
                for line in p.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    row = json.loads(line)
                    for k in ("source", "reference", "deva"):
                        if row.get(k):
                            blocked.add(norm(str(row[k])))
    return blocked


def zip_read_text(zf: zipfile.ZipFile, name: str) -> str:
    data = zf.read(name)
    if name.endswith(".gz") or data[:2] == b"\x1f\x8b":
        try:
            data = gzip.decompress(data)
        except OSError:
            pass
    return data.decode("utf-8", "replace")


def find_member(zf: zipfile.ZipFile, rel: str) -> str | None:
    """Map cesAlign path like en/2016_....xml.gz to a zip member."""
    rel = rel.replace("\\", "/").lstrip("/")
    candidates = [
        f"GlobalVoices/raw/{rel}",
        f"GlobalVoices/raw/{rel[:-3]}" if rel.endswith(".gz") else None,
        rel,
        rel[:-3] if rel.endswith(".gz") else None,
    ]
    names = set(zf.namelist())
    for c in candidates:
        if c and c in names:
            return c
    # basename fallback
    base = Path(rel).name
    base2 = base[:-3] if base.endswith(".gz") else base
    for n in names:
        if n.endswith("/" + base) or n.endswith("/" + base2):
            return n
    return None


def parse_gv_doc(xml_text: str) -> dict:
    root = ET.fromstring(xml_text)
    url = (root.findtext("URL") or "").strip()
    title_s = root.find("TITLE/s")
    title = "".join(title_s.itertext()).strip() if title_s is not None else ""
    author = ""
    translator = ""
    for a in root.iter("AUTHOR"):
        author = (a.attrib.get("name") or "").strip() or author
    for t in root.iter("TRANSLATOR"):
        translator = (t.attrib.get("name") or "").strip() or translator
    sents: dict[str, str] = {}
    for s in root.iter("s"):
        sid = s.attrib.get("id")
        if not sid:
            continue
        text = "".join(s.itertext()).strip()
        if text:
            sents[sid] = text
    return {
        "url": url,
        "title": title,
        "author": author,
        "translator": translator,
        "sents": sents,
    }


def length_ok(en: str, ne: str) -> bool:
    if len(en) < 25 or len(ne) < 20:
        return False
    if len(en) > 400 or len(ne) > 500:
        return False
    # Rough char ratio for translation (allow wide band for Indic)
    ratio = len(ne) / max(len(en), 1)
    if ratio < 0.35 or ratio > 3.5:
        return False
    if not LATIN.search(en) or not DEVANAGARI.search(ne):
        return False
    # Shared digits should match when present
    en_d = re.findall(r"\d+", en)
    ne_d = re.findall(r"\d+", ne)
    if en_d and ne_d:
        if not set(en_d) & set(ne_d):
            # Allow if only year-like mismatch noise; else reject hard digit clash
            if len(en_d) >= 2:
                return False
    return True


def article_id_from_path(path: str) -> str:
    name = Path(path).name
    if name.endswith(".gz"):
        name = name[:-3]
    if name.endswith(".xml"):
        name = name[:-4]
    return name.rstrip("_")


def extract_global_voices(max_pairs: int = 1000) -> list[dict]:
    blocked = load_blocklist()
    align = ALIGN_XML.read_text(encoding="utf-8")
    # Parse link groups with regex (cesAlign is simple enough)
    groups = re.findall(
        r'<linkGrp[^>]*fromDoc="([^"]+)"[^>]*toDoc="([^"]+)"[^>]*>(.*?)</linkGrp>',
        align,
        flags=re.S,
    )
    en_zf = zipfile.ZipFile(EN_ZIP)
    ne_zf = zipfile.ZipFile(NE_ZIP)

    by_article: dict[str, list[dict]] = defaultdict(list)
    skipped = defaultdict(int)

    for from_doc, to_doc, body in groups:
        links = re.findall(r'<link\s+xtargets="([^"]+)"\s*/>', body)
        en_mem = find_member(en_zf, from_doc)
        ne_mem = find_member(ne_zf, to_doc)
        if not en_mem or not ne_mem:
            skipped["missing_doc"] += 1
            continue
        try:
            en_doc = parse_gv_doc(zip_read_text(en_zf, en_mem))
            ne_doc = parse_gv_doc(zip_read_text(ne_zf, ne_mem))
        except Exception:
            skipped["parse_error"] += 1
            continue

        en_id = article_id_from_path(from_doc)
        ne_id = article_id_from_path(to_doc)
        # Prefer 1-1 links only
        for xt in links:
            left, right = xt.split(";")
            left_ids = left.strip().split()
            right_ids = right.strip().split()
            if len(left_ids) != 1 or len(right_ids) != 1:
                skipped["non_1to1"] += 1
                continue
            en = en_doc["sents"].get(left_ids[0], "").strip()
            ne = ne_doc["sents"].get(right_ids[0], "").strip()
            if not en or not ne:
                skipped["missing_sent"] += 1
                continue
            if not length_ok(en, ne):
                skipped["length_filter"] += 1
                continue
            if norm(en) in blocked or norm(ne) in blocked:
                skipped["gold_block"] += 1
                continue
            # Drop near-duplicates of titles alone
            if en == en_doc["title"] and len(en) < 40:
                skipped["title_only"] += 1
                continue
            row = {
                "eng_Latn": en,
                "npi_Deva": ne,
                "source": "global_voices_opus_2018q4",
                "license": "CC-BY (Global Voices / OPUS redistribution; attribute translators)",
                "formality": "neutral",
                "unit": "sentence",
                "article_id_en": en_id,
                "article_id_ne": ne_id,
                "url_en": en_doc["url"],
                "url_ne": ne_doc["url"],
                "author": en_doc["author"] or ne_doc["author"],
                "translator": ne_doc["translator"] or en_doc["translator"],
                "sent_id_en": left_ids[0],
                "sent_id_ne": right_ids[0],
                "domain": "journalism_global_voices",
            }
            by_article[en_id].append(row)

    # Diversify across articles: round-robin up to max_pairs
    article_ids = sorted(by_article.keys(), key=lambda a: (-len(by_article[a]), a))
    selected: list[dict] = []
    seen = set()
    # Cap per article so one long story doesn't dominate
    per_article_cap = max(3, max_pairs // max(len(article_ids), 1) + 2)
    pools = {a: list(rows) for a, rows in by_article.items()}
    for a in pools:
        random.Random(42).shuffle(pools[a])
    taken = {a: 0 for a in pools}
    while len(selected) < max_pairs and any(pools[a] and taken[a] < per_article_cap for a in pools):
        progress = False
        for a in article_ids:
            if len(selected) >= max_pairs:
                break
            if taken[a] >= per_article_cap or not pools[a]:
                continue
            row = pools[a].pop()
            key = hashlib.sha1(f"{norm(row['eng_Latn'])}|{norm(row['npi_Deva'])}".encode()).hexdigest()
            if key in seen:
                continue
            seen.add(key)
            selected.append(row)
            taken[a] += 1
            progress = True
        if not progress:
            # relax cap
            per_article_cap += 2
            if per_article_cap > 40:
                break

    stats = {
        "n_link_groups": len(groups),
        "n_articles_with_pairs": len(by_article),
        "n_selected": len(selected),
        "skipped": dict(skipped),
        "translators": sorted({r["translator"] for r in selected if r["translator"]}),
    }
    return selected, stats


def verify_user_csv(path: Path) -> tuple[list[dict], dict]:
    """Validate structure of nepali_translation_gold_candidates.csv."""
    required = {
        "id",
        "english",
        "nepali",
        "domain",
        "context",
        "register",
        "source",
        "license",
        "quality_tier",
        "native_review_required",
        "notes",
    }
    rows_out: list[dict] = []
    issues: list[str] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        cols = set(reader.fieldnames or [])
        missing = required - cols
        if missing:
            issues.append(f"missing columns: {sorted(missing)}")
        for i, r in enumerate(reader, 1):
            en = (r.get("english") or "").strip()
            ne = (r.get("nepali") or "").strip()
            if not en or not ne:
                issues.append(f"row {i}: empty side")
                continue
            if not DEVANAGARI.search(ne):
                issues.append(f"row {i} id={r.get('id')}: nepali lacks Devanagari")
            domain = (r.get("domain") or "").strip()
            license_ = (r.get("license") or "").strip()
            # Structure OK for training ingest; keep provenance honest
            rows_out.append(
                {
                    "eng_Latn": en,
                    "npi_Deva": ne,
                    "source": r.get("source") or "user_csv",
                    "license": license_,
                    "formality": (r.get("register") or "neutral").strip() or "neutral",
                    "unit": "phrase" if len(en) < 40 else "sentence",
                    "domain": domain,
                    "context": r.get("context"),
                    "quality_tier": r.get("quality_tier"),
                    "native_review_required": str(r.get("native_review_required")).lower()
                    == "true",
                    "notes": r.get("notes"),
                    "csv_id": r.get("id"),
                    "verified_structure": True,
                    "live_site_verified": False,
                }
            )
    by_domain: dict[str, int] = defaultdict(int)
    for r in rows_out:
        by_domain[r["domain"]] += 1
    report = {
        "path": str(path),
        "n_rows": len(rows_out),
        "columns_ok": not bool(required - cols),
        "by_domain": dict(by_domain),
        "issues_sample": issues[:20],
        "n_issues": len(issues),
        "structure_verdict": "ok_for_train_with_provenance"
        if not missing
        else "schema_problems",
        "notes": (
            "government_ui rows: provenance_uncertain — Law Commission live site returned "
            "403/404 from this environment; do not treat as scraped official text. "
            "common_conversation rows: assistant_curated user_project_seed — fine as FT seed "
            "after gold-blocklist scrub; still mark native_review_required."
        ),
    }
    return rows_out, report


def try_law_commission_seed() -> list[dict]:
    """
    Live harvest is blocked (403). Return empty + rely on verified CSV gov UI rows.
    Placeholder keeps the pipeline explicit.
    """
    return []


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    if not ALIGN_XML.exists() or not EN_ZIP.exists() or not NE_ZIP.exists():
        print("Missing GlobalVoices raw files under training/data/raw/", flush=True)
        return 1

    print("Extracting Global Voices (doc-aligned, 1-1 sentences)…", flush=True)
    gv, gv_stats = extract_global_voices(1000)
    gv_path = OUT / "train_global_voices_en_ne.jsonl"
    write_jsonl(gv_path, gv)
    print(f"wrote {len(gv)} → {gv_path}", flush=True)
    print(json.dumps(gv_stats, indent=2, ensure_ascii=False), flush=True)

    law_rows: list[dict] = []
    csv_report = {}
    if USER_CSV.exists():
        print(f"Verifying CSV {USER_CSV}", flush=True)
        csv_rows, csv_report = verify_user_csv(USER_CSV)
        # Prefer government_ui into law file; conversation into separate seed
        gov = [r for r in csv_rows if r["domain"] == "government_ui"]
        conv = [r for r in csv_rows if r["domain"] != "government_ui"]
        law_rows.extend(gov)
        conv_path = OUT / "train_user_conversation_seeds.jsonl"
        write_jsonl(conv_path, conv)
        print(f"wrote {len(conv)} conversation seeds → {conv_path}", flush=True)
    else:
        csv_report = {"error": f"missing {USER_CSV}"}

    law_rows.extend(try_law_commission_seed())
    law_path = OUT / "train_law_gov_en_ne.jsonl"
    write_jsonl(law_path, law_rows)

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "global_voices": {
            "path": str(gv_path),
            "n": len(gv),
            "stats": gv_stats,
            "attribution": "Global Voices volunteer translators (TRANSLATOR field); OPUS 2018Q4 packaging",
            "verification": "cesAlign fromDoc↔toDoc article pairs + 1-1 sentence links only",
        },
        "law_government": {
            "path": str(law_path),
            "n": len(law_rows),
            "live_harvest": "blocked_403",
            "csv_ingest": csv_report,
            "source_url": "https://lawcommission.gov.np/",
        },
        "next_step": (
            "Merge into prepare_gold_domain_data.py sources or concat into train_gold_domain "
            "after sentence_split + gold blocklist."
        ),
    }
    man_path = OUT / "sources_manifest_gv_law.json"
    man_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"manifest → {man_path}", flush=True)
    print(
        f"DONE gv={len(gv)} law/gov={len(law_rows)} "
        f"translators={len(gv_stats.get('translators', []))}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
