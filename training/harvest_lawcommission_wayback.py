#!/usr/bin/env python3
"""Append provisional Law Commission EN/NE paragraph pairs from Wayback Machine."""
from __future__ import annotations

import html
import json
import re
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent / "data" / "train_law_gov_en_ne.jsonl"
RAW = Path(__file__).resolve().parent / "data" / "raw"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def strip_tags(s: str) -> str:
    s = re.sub(r"(?is)<script.*?>.*?</script>", " ", s)
    s = re.sub(r"(?is)<style.*?>.*?</style>", " ", s)
    s = re.sub(r"(?is)<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def paras(page: str) -> list[str]:
    found = re.findall(r"<p[^>]*>(.*?)</p>", page, flags=re.S | re.I)
    out = []
    for x in found:
        t = strip_tags(x)
        if len(t) >= 60:
            out.append(t)
    return out


def main() -> int:
    pairs: list[dict] = []
    pages = [
        (
            "https://web.archive.org/web/20210122120000/http://www.lawcommission.gov.np/en/about-us",
            "https://web.archive.org/web/20210122120000/http://www.lawcommission.gov.np/np/about-us",
        ),
        (
            "https://web.archive.org/web/20210123014725/http://www.lawcommission.gov.np/en/",
            "https://web.archive.org/web/20210123020000/http://www.lawcommission.gov.np/np/",
        ),
    ]
    for eu, nu in pages:
        try:
            eh, nh = fetch(eu), fetch(nu)
        except Exception as e:
            print("fetch fail", eu, e)
            continue
        et, nt = paras(eh), [p for p in paras(nh) if re.search(r"[\u0900-\u097F]", p)]
        print(eu, "en", len(et), "ne", len(nt))
        for i, (e, n) in enumerate(zip(et[:10], nt[:10])):
            pairs.append(
                {
                    "eng_Latn": e[:700],
                    "npi_Deva": n[:800],
                    "source": "lawcommission_wayback",
                    "license": "Nepal government public document (verify reuse); Wayback capture",
                    "formality": "formal",
                    "unit": "paragraph",
                    "domain": "government_law",
                    "url_en": eu,
                    "url_ne": nu,
                    "pair_index": i,
                    "alignment": "same_page_paragraph_order_provisional",
                    "native_review_required": True,
                }
            )

    existing: list[dict] = []
    if OUT.exists():
        existing = [
            json.loads(l) for l in OUT.read_text(encoding="utf-8").splitlines() if l.strip()
        ]
    existing.extend(pairs)
    OUT.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in existing) + "\n",
        encoding="utf-8",
    )
    print("wrote", len(pairs), "new; total", len(existing), "→", OUT)
    for p in pairs[:2]:
        print("---")
        print(p["eng_Latn"][:180])
        print(p["npi_Deva"][:180])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
