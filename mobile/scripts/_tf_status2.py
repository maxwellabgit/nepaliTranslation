"""Deeper ASC TestFlight / build status for NepTranslate."""
from __future__ import annotations

import json
import ssl
import urllib.error
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
        with urllib.request.urlopen(req, context=ctx, timeout=45) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print("HTTP", e.code, url)
        print(body[:600])
        return None


# All builds for app
for path in [
    f"/iris/v1/apps/{APP_ID}/builds?limit=50&include=preReleaseVersion,buildBetaDetail",
    f"/iris/v1/builds?filter[app]={APP_ID}&limit=50&include=preReleaseVersion,buildBetaDetail",
    f"/iris/v1/apps/{APP_ID}/ciBuildRuns?limit=20",
    f"/iris/v1/betaAppLocalizations?filter[app]={APP_ID}&limit=10",
    f"/iris/v1/betaGroups?filter[app]={APP_ID}&limit=20&include=builds",
]:
    print("\n====", path)
    data = get("https://appstoreconnect.apple.com" + path)
    if not data:
        continue
    for item in (data.get("data") or [])[:20]:
        a = item.get("attributes") or {}
        interesting = {
            k: a.get(k)
            for k in (
                "version",
                "uploadedDate",
                "processingState",
                "expirationDate",
                "minOsVersion",
                "usesNonExemptEncryption",
                "externalBuildState",
                "internalBuildState",
                "name",
                "isInternalGroup",
                "locale",
                "whatsNew",
            )
            if k in a
        }
        print("-", item.get("type"), item.get("id"), interesting or a)
    for inc in (data.get("included") or [])[:10]:
        a = inc.get("attributes") or {}
        print(
            "  inc",
            inc.get("type"),
            inc.get("id"),
            {k: a.get(k) for k in list(a)[:8]},
        )

# preReleaseVersion 1.0.0 builds
prv = "2b835b4b-806f-4400-9800-7272749b907b"
print("\n==== builds for preRelease 1.0.0")
data = get(
    f"https://appstoreconnect.apple.com/iris/v1/preReleaseVersions/{prv}/builds?limit=50&include=buildBetaDetail"
)
if data:
    for item in data.get("data") or []:
        a = item.get("attributes") or {}
        print("- build", item.get("id"), a)
    for inc in data.get("included") or []:
        print("  detail", inc.get("id"), inc.get("attributes"))
