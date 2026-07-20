"""List ALL ASC builds + beta details; check for missing compliance."""
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
cookie_header = "; ".join(parts)
ctx = ssl.create_default_context()


def get(url: str):
    req = urllib.request.Request(
        url,
        headers={
            "Cookie": cookie_header,
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:400])
        return None


data = get(
    f"https://appstoreconnect.apple.com/iris/v1/builds?filter[app]={APP_ID}&limit=50"
)
print("builds:", len((data or {}).get("data") or []))
for item in (data or {}).get("data") or []:
    a = item["attributes"]
    print(
        f"  cf={a.get('version')} state={a.get('processingState')} "
        f"uploaded={a.get('uploadedDate')} id={item['id']}"
    )

# pre-release versions
data = get(
    f"https://appstoreconnect.apple.com/iris/v1/apps/{APP_ID}/preReleaseVersions?limit=50"
)
print("\npreReleaseVersions:")
for item in (data or {}).get("data") or []:
    print(" ", item["id"], item["attributes"])

# build upload / review submissions sometimes under different endpoints
for path in [
    f"/iris/v1/apps/{APP_ID}/reviewSubmissions?limit=20",
    f"/iris/v1/apps/{APP_ID}/betaAppReviewDetails",
    f"/iris/v1/apps/{APP_ID}/betaLicenseAgreements",
]:
    print("\n", path)
    d = get("https://appstoreconnect.apple.com" + path)
    if d:
        print(json.dumps(d, indent=2)[:1200])
