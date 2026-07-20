"""Check ASC notifications, agreements, and build activity."""
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
        return {"HTTP": e.code, "body": e.read().decode()[:1500]}


# session user / providers
for path in [
    "/olympus/v1/session",
    "/iris/v1/apps?limit=20",
    f"/iris/v1/apps/{APP_ID}/appStoreVersions?limit=10",
    "/iris/v1/users?filter[me]=true&limit=5",
]:
    print("\n===", path, "===")
    d = get("https://appstoreconnect.apple.com" + path)
    print(json.dumps(d, indent=2)[:2500])
