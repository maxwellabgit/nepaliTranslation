"""Probe ASC for app identity, builds, and uploads."""
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from pathlib import Path

APP_ID = "6792574384"
cookie_path = Path.home() / ".app-store" / "auth" / "mrmax319@gmail.com" / "cookie"
store = json.loads(cookie_path.read_text(encoding="utf-8"))
parts = [
    f"{(c.get('key') or c.get('name'))}={c.get('value')}"
    for c in store.get("cookies") or []
    if (c.get("key") or c.get("name")) and c.get("value")
]
cookie = "; ".join(parts)
ctx = ssl.create_default_context()


def get(url: str):
    req = urllib.request.Request(
        url,
        headers={
            "Cookie": cookie,
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"HTTP": e.code, "body": e.read().decode()[:1200]}


paths = [
    f"/iris/v1/apps/{APP_ID}",
    f"/iris/v1/builds?filter[app]={APP_ID}&limit=50",
    f"/iris/v1/apps/{APP_ID}/preReleaseVersions?limit=20",
    f"/iris/v1/apps/{APP_ID}/betaGroups?limit=20",
    f"/iris/v1/apps/{APP_ID}/ciProducts",
]

for path in paths:
    print("\n===", path, "===")
    d = get("https://appstoreconnect.apple.com" + path)
    if path.endswith(APP_ID) and "data" in d:
        attrs = (d.get("data") or {}).get("attributes") or {}
        print(
            "name=",
            attrs.get("name"),
            "bundleId=",
            attrs.get("bundleId"),
            "sku=",
            attrs.get("sku"),
        )
        print(json.dumps(attrs, indent=2)[:1500])
    else:
        print(json.dumps(d, indent=2)[:2000])
