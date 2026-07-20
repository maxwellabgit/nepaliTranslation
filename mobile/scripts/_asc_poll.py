"""Poll ASC for new builds and check build upload / processing activity."""
from __future__ import annotations

import json
import ssl
import time
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
        return {"HTTP": e.code, "body": e.read().decode()[:800]}


for i in range(6):
    data = get(
        f"https://appstoreconnect.apple.com/iris/v1/builds?filter[app]={APP_ID}&limit=20"
    )
    builds = (data or {}).get("data") or []
    print(
        f"[{i}] builds={len(builds)}",
        [
            (
                b["attributes"].get("version"),
                b["attributes"].get("processingState"),
                b["attributes"].get("uploadedDate"),
            )
            for b in builds
        ],
    )
    # also try buildBundles / alternative
    for path in [
        f"/iris/v1/apps/{APP_ID}/buildUploads?limit=20",
        f"/iris/v1/apps/{APP_ID}/ciBuildRuns?limit=10",
    ]:
        d = get("https://appstoreconnect.apple.com" + path)
        if isinstance(d, dict) and d.get("data") is not None:
            print(" ", path, "count", len(d.get("data") or []))
        elif isinstance(d, dict) and d.get("HTTP"):
            pass
    if len(builds) > 1:
        break
    time.sleep(30)

print("done")
