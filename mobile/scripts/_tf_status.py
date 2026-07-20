"""Check TestFlight / ASC build processing status for NepTranslate."""
from __future__ import annotations

import json
import ssl
import urllib.request
from pathlib import Path

APP_ID = "6792574384"
cookie_path = Path.home() / ".app-store" / "auth" / "mrmax319@gmail.com" / "cookie"
store = json.loads(cookie_path.read_text(encoding="utf-8"))
parts = []
for c in store.get("cookies") or []:
    name = c.get("key") or c.get("name")
    val = c.get("value")
    if name and val:
        parts.append(f"{name}={val}")
cookie_header = "; ".join(parts)
ctx = ssl.create_default_context()


def get(url: str) -> dict | str:
    req = urllib.request.Request(
        url,
        headers={
            "Cookie": cookie_header,
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, context=ctx, timeout=45) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return body[:500]


# Pre-release versions / builds
urls = [
    f"https://appstoreconnect.apple.com/iris/v1/apps/{APP_ID}/appStoreVersions?limit=10&include=build",
    f"https://appstoreconnect.apple.com/iris/v1/apps/{APP_ID}/builds?limit=20&sort=-uploadedDate&include=preReleaseVersion",
    f"https://appstoreconnect.apple.com/iris/v1/apps/{APP_ID}/preReleaseVersions?limit=20",
]

for url in urls:
    print("\n===", url.split("apps/")[-1][:80], "===")
    try:
        data = get(url)
        if isinstance(data, str):
            print(data)
            continue
        items = data.get("data") or []
        included = {f"{x['type']}:{x['id']}": x for x in (data.get("included") or [])}
        print("count", len(items))
        for item in items[:15]:
            attrs = item.get("attributes") or {}
            print(
                "-",
                item.get("type"),
                item.get("id"),
                {k: attrs.get(k) for k in list(attrs)[:12]},
            )
            # relationships summary
            rel = item.get("relationships") or {}
            for rk, rv in list(rel.items())[:4]:
                d = (rv or {}).get("data")
                if isinstance(d, dict):
                    print("   rel", rk, d.get("type"), d.get("id"))
                elif isinstance(d, list):
                    print("   rel", rk, len(d), "items")
    except Exception as e:
        err = ""
        if hasattr(e, "read"):
            try:
                err = e.read().decode()[:400]
            except Exception:
                pass
        print("FAIL", e, err)
