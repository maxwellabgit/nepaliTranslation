"""Download ASC API key P8 from Expo for a one-shot Transporter workaround."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

state = json.loads((Path.home() / ".expo" / "state.json").read_text(encoding="utf-8"))
session = state["auth"]["sessionSecret"]
KEY_ID = "08043dc3-1168-4fa4-844a-15a3f2fd4498"


def gql(query: str, variables: dict | None = None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        "https://api.expo.dev/graphql",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "expo-session": session,
            "User-Agent": "eas-cli",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"HTTP": e.code, "body": e.read().decode()[:3000]}


q = """
query($id: ID!) {
  appStoreConnectApiKey {
    byId(id: $id) {
      id
      issuerIdentifier
      keyIdentifier
      keyP8
      appleTeam { appleTeamIdentifier appleTeamName }
    }
  }
}
"""
d = gql(q, {"id": KEY_ID})
key = ((d.get("data") or {}).get("appStoreConnectApiKey") or {}).get("byId") or {}
print("keyId", key.get("keyIdentifier"))
print("issuer", key.get("issuerIdentifier"))
print("team", key.get("appleTeam"))
p8 = key.get("keyP8") or ""
print("p8_len", len(p8))
out = Path.home() / ".cursor" / "asc_submit_key.p8"
meta = Path.home() / ".cursor" / "asc_submit_key.json"
if p8:
    out.write_text(p8, encoding="utf-8")
    meta.write_text(
        json.dumps(
            {
                "keyIdentifier": key.get("keyIdentifier"),
                "issuerIdentifier": key.get("issuerIdentifier"),
                "appleTeam": key.get("appleTeam"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("wrote", out)
else:
    print(json.dumps(d, indent=2)[:2000])
