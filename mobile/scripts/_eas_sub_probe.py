"""Fetch EAS submission details via Expo GraphQL."""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

state = json.loads((Path.home() / ".expo" / "state.json").read_text(encoding="utf-8"))
auth = state.get("auth") or {}
session = auth.get("sessionSecret")
if not session:
    raise SystemExit("no session")

SUB_IDS = [
    "d34930d7-c260-4eef-8387-6cbb29756701",
    "8bd13eb6-ce84-44eb-9987-ec4475b420f1",
    "ad69aecc-ec85-49e4-90f1-73c3a5845b4c",
]


def gql(query: str, variables: dict | None = None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        "https://api.expo.dev/graphql",
        data=body,
        headers={
            "Content-Type": "application/json",
            "expo-session": session,
            "User-Agent": "eas-cli/16.0.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"HTTP": e.code, "body": e.read().decode()[:2000]}


print("me:", json.dumps(gql("{ meActor { ... on User { id username } } }"), indent=2)[:800])

query = """
query Submission($submissionId: ID!) {
  submissions {
    byId(submissionId: $submissionId) {
      id
      status
      platform
      iosConfig {
        ascAppIdentifier
        appleIdUsername
      }
      error {
        errorCode
        message
      }
      logFiles
    }
  }
}
"""

for sid in SUB_IDS:
    data = gql(query, {"submissionId": sid})
    print("\n===", sid, "===")
    print(json.dumps(data, indent=2)[:4000])
