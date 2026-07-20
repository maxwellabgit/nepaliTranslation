"""List apps/builds under each ASC provider; look for NepTranslate / recent uploads."""
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from pathlib import Path

cookie_path = Path.home() / ".app-store" / "auth" / "mrmax319@gmail.com" / "cookie"
store = json.loads(cookie_path.read_text(encoding="utf-8"))
parts = [
    f"{(c.get('key') or c.get('name'))}={c.get('value')}"
    for c in store.get("cookies") or []
    if (c.get("key") or c.get("name")) and c.get("value")
]
cookie = "; ".join(parts)
ctx = ssl.create_default_context()


def request(url: str, method: str = "GET", body: bytes | None = None, extra_headers: dict | None = None):
    headers = {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, {"body": e.read().decode()[:1500]}


# Get session / providers
_, session = request("https://appstoreconnect.apple.com/olympus/v1/session")
providers = session.get("availableProviders") or []
print("current provider:", (session.get("provider") or {}).get("name"), (session.get("provider") or {}).get("providerId"))
print("available:", [(p.get("name"), p.get("providerId")) for p in providers])

for p in providers:
    pid = p["providerId"]
    name = p["name"]
    print(f"\n######## SWITCH TO {name} ({pid}) ########")
    # switch provider
    status, switched = request(
        "https://appstoreconnect.apple.com/olympus/v1/session",
        method="POST",
        body=json.dumps({"providerId": pid}).encode(),
    )
    print("switch status", status, "now", (switched.get("provider") or {}).get("name") if isinstance(switched, dict) else switched)

    # list apps
    status, apps = request("https://appstoreconnect.apple.com/iris/v1/apps?limit=50")
    print("apps status", status)
    data = (apps.get("data") if isinstance(apps, dict) else None) or []
    print("app count", len(data))
    for app in data:
        a = app.get("attributes") or {}
        print(" -", app.get("id"), a.get("name"), a.get("bundleId"))

    # specifically NepTranslate builds if present
    for app in data:
        if (app.get("attributes") or {}).get("bundleId") == "com.neptranslate.app" or app.get("id") == "6792574384":
            aid = app["id"]
            _, builds = request(
                f"https://appstoreconnect.apple.com/iris/v1/builds?filter[app]={aid}&limit=20"
            )
            print(" builds for", aid, ":", len((builds.get("data") or []) if isinstance(builds, dict) else []))
            for b in (builds.get("data") or []) if isinstance(builds, dict) else []:
                ba = b["attributes"]
                print(
                    "  cf=",
                    ba.get("version"),
                    "state=",
                    ba.get("processingState"),
                    "uploaded=",
                    ba.get("uploadedDate"),
                )

# switch back to Maxwell Bucholz personal
for p in providers:
    if p.get("name") == "Maxwell Bucholz":
        request(
            "https://appstoreconnect.apple.com/olympus/v1/session",
            method="POST",
            body=json.dumps({"providerId": p["providerId"]}).encode(),
        )
        break
