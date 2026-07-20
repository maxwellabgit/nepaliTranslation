"""Search ASC for invalid/processing builds and resolution-center messages."""
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
        return {"HTTP": e.code, "body": e.read().decode()[:2000]}


urls = [
    f"https://appstoreconnect.apple.com/iris/v1/builds?filter[app]={APP_ID}&limit=50&include=buildBetaDetail,preReleaseVersion,icons",
    f"https://appstoreconnect.apple.com/iris/v1/builds?filter[app]={APP_ID}&filter[processingState]=PROCESSING&limit=50",
    f"https://appstoreconnect.apple.com/iris/v1/builds?filter[app]={APP_ID}&filter[processingState]=FAILED&limit=50",
    f"https://appstoreconnect.apple.com/iris/v1/builds?filter[app]={APP_ID}&filter[processingState]=INVALID&limit=50",
    f"https://appstoreconnect.apple.com/iris/v1/builds?filter[app]={APP_ID}&filter[expired]=true&limit=50",
    "https://appstoreconnect.apple.com/iris/v1/notificationSettings",
    f"https://appstoreconnect.apple.com/iris/v1/apps/{APP_ID}/customerReviews?limit=5",
    "https://appstoreconnect.apple.com/WebObjects/iTunesConnect.woa/ra/apps/manageyourapps/summary/v2",
]

for url in urls:
    print("\n===", url.split("apple.com")[-1][:100], "===")
    d = get(url)
    if isinstance(d, dict) and "data" in d:
        print("count", len(d.get("data") or []))
        for item in (d.get("data") or [])[:10]:
            attrs = item.get("attributes") or {}
            print("-", item.get("type"), item.get("id"), {k: attrs.get(k) for k in list(attrs)[:8]})
        if d.get("included"):
            print("included", len(d["included"]))
    else:
        print(json.dumps(d, indent=2)[:1500])

# Resolution Center style endpoints
for path in [
    "/iris/v1/apps/6792574384/appStoreVersionExperiments?limit=5",
    "/olympus/v1/notifications",
    "/iris/v1/actorNotifications?limit=20",
]:
    print("\n===", path, "===")
    print(json.dumps(get("https://appstoreconnect.apple.com" + path), indent=2)[:1200])
