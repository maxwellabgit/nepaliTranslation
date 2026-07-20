"""Upload an IPA to App Store Connect via REST buildUploads (Windows-safe)."""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import jwt
import requests

API = "https://api.appstoreconnect.apple.com"
DEFAULT_APP_ID = "6792574384"
DEFAULT_KEY_ID = "38N6BNU77R"
DEFAULT_ISSUER = "bdf27389-66c0-4d10-88b1-320d4820352e"
DEFAULT_KEY = Path.home() / ".cursor" / "asc_submit_key.p8"


def make_token(key_id: str, issuer: str, key_path: Path) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": issuer,
            "iat": now,
            "exp": now + 20 * 60,
            "aud": "appstoreconnect-v1",
        },
        key_path.read_text(encoding="utf-8"),
        algorithm="ES256",
        headers={"kid": key_id, "typ": "JWT"},
    )


def api(
    method: str,
    path: str,
    token: str,
    body: dict | None = None,
) -> tuple[int, dict]:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    resp = requests.request(
        method, API + path, headers=headers, json=body, timeout=120
    )
    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text[:2000]}
    return resp.status_code, data


def upload_ipa(
    ipa_path: Path,
    *,
    app_id: str,
    version: str,
    build: str,
    key_id: str,
    issuer: str,
    key_path: Path,
) -> str:
    token = make_token(key_id, issuer, key_path)
    size = ipa_path.stat().st_size
    print(f"Uploading {ipa_path} ({size} bytes) as {version} ({build})")

    status, data = api(
        "POST",
        "/v1/buildUploads",
        token,
        {
            "data": {
                "type": "buildUploads",
                "attributes": {
                    "cfBundleVersion": build,
                    "cfBundleShortVersionString": version,
                    "platform": "IOS",
                },
                "relationships": {
                    "app": {"data": {"type": "apps", "id": app_id}},
                },
            }
        },
    )
    if status >= 300:
        print(json.dumps(data, indent=2)[:3000])
        raise SystemExit(f"create buildUploads failed: {status}")
    upload_id = data["data"]["id"]
    print("buildUploadId", upload_id)

    status, file_data = api(
        "POST",
        "/v1/buildUploadFiles",
        token,
        {
            "data": {
                "type": "buildUploadFiles",
                "attributes": {
                    "fileName": ipa_path.name,
                    "fileSize": size,
                    "uti": "com.apple.ipa",
                    "assetType": "ASSET",
                },
                "relationships": {
                    "buildUpload": {
                        "data": {"type": "buildUploads", "id": upload_id}
                    }
                },
            }
        },
    )
    if status >= 300:
        print(json.dumps(file_data, indent=2)[:3000])
        raise SystemExit(f"create buildUploadFiles failed: {status}")

    file_id = file_data["data"]["id"]
    ops = file_data["data"]["attributes"].get("uploadOperations") or []
    raw = ipa_path.read_bytes()
    print(f"chunks: {len(ops)}")
    for idx, op in enumerate(ops):
        offset = int(op.get("offset") or 0)
        length = int(op.get("length") or 0)
        chunk = raw[offset : offset + length]
        headers = {h["name"]: h["value"] for h in (op.get("requestHeaders") or [])}
        r = requests.request(
            op.get("method", "PUT"),
            op["url"],
            headers=headers,
            data=chunk,
            timeout=300,
        )
        print(f"  chunk {idx+1}/{len(ops)} -> {r.status_code}")
        if r.status_code >= 300:
            print(r.text[:500])
            raise SystemExit(1)

    status, done = api(
        "PATCH",
        f"/v1/buildUploadFiles/{file_id}",
        token,
        {
            "data": {
                "type": "buildUploadFiles",
                "id": file_id,
                "attributes": {"uploaded": True},
            }
        },
    )
    print("finalize file", status)
    if status >= 300:
        print(json.dumps(done, indent=2)[:2000])
        raise SystemExit(1)

    # Poll buildUpload state for processing errors
    for i in range(30):
        token = make_token(key_id, issuer, key_path)
        status, info = api("GET", f"/v1/buildUploads/{upload_id}", token)
        state = (
            ((info.get("data") or {}).get("attributes") or {}).get("state") or {}
        )
        print(f"[{i}] buildUpload state={state.get('state')} errors={state.get('errors')}")
        if state.get("state") in {"COMPLETE", "FAILED", "PROCESSING"}:
            if state.get("errors"):
                print(json.dumps(state, indent=2)[:3000])
            if state.get("state") == "FAILED":
                raise SystemExit("Apple rejected the upload")
            break
        time.sleep(10)

    # Poll builds list
    for i in range(36):
        token = make_token(key_id, issuer, key_path)
        status, builds = api(
            "GET",
            f"/v1/builds?filter[app]={app_id}&limit=10&sort=-uploadedDate",
            token,
        )
        rows = [
            (
                b["attributes"].get("version"),
                b["attributes"].get("processingState"),
                b["attributes"].get("uploadedDate"),
            )
            for b in (builds.get("data") or [])
        ]
        print(f"builds[{i}]", rows)
        if any(v == build for v, *_ in rows):
            print(f"Build {build} is in App Store Connect")
            return upload_id
        time.sleep(15)

    print("Upload finished but build not listed yet — check ASC / email")
    return upload_id


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("ipa", type=Path)
    p.add_argument("--version", required=True)
    p.add_argument("--build", required=True)
    p.add_argument("--app-id", default=DEFAULT_APP_ID)
    p.add_argument("--key-id", default=DEFAULT_KEY_ID)
    p.add_argument("--issuer", default=DEFAULT_ISSUER)
    p.add_argument("--key", type=Path, default=DEFAULT_KEY)
    args = p.parse_args()
    upload_ipa(
        args.ipa,
        app_id=args.app_id,
        version=args.version,
        build=args.build,
        key_id=args.key_id,
        issuer=args.issuer,
        key_path=args.key,
    )


if __name__ == "__main__":
    main()
