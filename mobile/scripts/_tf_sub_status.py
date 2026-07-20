#!/usr/bin/env python3
import json
import urllib.error
import urllib.request
from pathlib import Path

state = json.loads((Path.home() / ".expo" / "state.json").read_text(encoding="utf-8"))
auth = state.get("auth") or {}
print("auth keys:", list(auth.keys()))
session = auth.get("sessionSecret") or auth.get("accessToken")
print("session present:", bool(session), "len:", len(session or ""))

sid = "f4110b8c-85f8-49eb-a470-c2101dd06a5b"
q = """
query Submission($submissionId: ID!) {
  submissions {
    byId(submissionId: $submissionId) {
      id
      status
      platform
      error { message errorCode }
    }
  }
}
"""
body = json.dumps({"query": q, "variables": {"submissionId": sid}}).encode()

header_sets = [
    {"Content-Type": "application/json", "expo-session": session or ""},
    {"Content-Type": "application/json", "Authorization": f"Bearer {session}"},
]
for headers in header_sets:
    try:
        req = urllib.request.Request(
            "https://api.expo.dev/graphql", data=body, headers=headers, method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            print("OK", json.dumps(json.loads(resp.read().decode()), indent=2)[:2000])
            break
    except urllib.error.HTTPError as e:
        print("ERR", e.code, e.read()[:300].decode("utf-8", errors="replace"))
