#!/usr/bin/env python3
"""
Receive Data review batches from the iPhone and route them on this PC.

Usage:
  python training/review_sync_server.py

Phone (same Wi-Fi): Settings → Advanced → Data review · password 1234 · laptop address printed here.

POST /v1/reviews
  Header: X-Review-Sync-Secret: <baked secret>
  Body: { reviews: { review_key: { kind, ... } } }

GET /health → { ok: true }
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import subprocess
import sys
import traceback
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import socket

REPO = Path(__file__).resolve().parents[1]
INBOX = REPO / "training" / "artifacts" / "review_sync_inbox"
SEEN = REPO / "training" / "artifacts" / "review_sync_seen.json"
EVENTS = REPO / "training" / "data" / "meaning_review_events.jsonl"
ROUTE = REPO / "training" / "route_corrections.py"
BAKED_SECRET = "neptranslate-sync-test-2026"


def lan_urls(port: int) -> list[str]:
    urls = [f"http://127.0.0.1:{port}"]
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        if ip and not str(ip).startswith("127."):
            urls.append(f"http://{ip}:{port}")
    except Exception:
        pass
    return urls


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_seen() -> set[str]:
    if SEEN.exists():
        try:
            data = json.loads(SEEN.read_text(encoding="utf-8"))
            return set(data.get("event_ids") or [])
        except Exception:
            return set()
    # Seed from existing events so re-uploads after server restart don't double-count edits.
    seen: set[str] = set()
    if EVENTS.exists():
        for line in EVENTS.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                eid = json.loads(line).get("event_id")
                if eid:
                    seen.add(eid)
            except Exception:
                continue
    return seen


def save_seen(seen: set[str]) -> None:
    SEEN.parent.mkdir(parents=True, exist_ok=True)
    # Cap growth; keep most recent-looking ids by sorting (event ids include timestamps).
    ordered = sorted(seen)
    if len(ordered) > 50_000:
        ordered = ordered[-50_000:]
    SEEN.write_text(
        json.dumps({"event_ids": ordered, "updated_at": utc_now()}, indent=2) + "\n",
        encoding="utf-8",
    )


def event_id_for(mid: str, rev: dict) -> str:
    completed = rev.get("completed_at") or ""
    key = rev.get("review_key") or mid
    return f"mre_{key}_{completed}"


def filter_new_reviews(payload: dict) -> tuple[dict, int, int, set[str]]:
    reviews = payload.get("reviews") or {}
    if not isinstance(reviews, dict):
        raise ValueError("reviews must be an object keyed by meaning_id")
    seen = load_seen()
    fresh: dict[str, dict] = {}
    new_ids: set[str] = set()
    for mid, rev in reviews.items():
        if not isinstance(rev, dict):
            continue
        eid = event_id_for(str(mid), rev)
        if eid in seen:
            continue
        fresh[str(mid)] = rev
        new_ids.add(eid)
    return fresh, len(reviews), len(fresh), new_ids


def write_and_route(payload: dict, fresh: dict, new_ids: set[str]) -> dict:
    INBOX.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    digest = hashlib.sha1(json.dumps(fresh, sort_keys=True).encode("utf-8")).hexdigest()[:10]
    path = INBOX / f"batch_{stamp}_{digest}.json"
    out = {
        **payload,
        "export_kind": payload.get("export_kind") or "data_reviews",
        "exported_at": payload.get("exported_at") or utc_now(),
        "n_completed": len(fresh),
        "reviews": fresh,
        "sync_received_at": utc_now(),
    }
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if not fresh:
        return {
            "ok": True,
            "routed": False,
            "n_received": 0,
            "n_new": 0,
            "inbox_file": str(path),
            "message": "all reviews already seen",
        }

    proc = subprocess.run(
        [sys.executable, str(ROUTE), str(path)],
        cwd=str(REPO),
        capture_output=True,
        text=True,
    )
    summary = {}
    if proc.stdout.strip():
        try:
            summary = json.loads(proc.stdout.strip().splitlines()[-1])
        except Exception:
            summary = {"raw_stdout": proc.stdout[-2000:]}
    if proc.returncode != 0:
        return {
            "ok": False,
            "error": "route_corrections failed",
            "stderr": (proc.stderr or "")[-2000:],
            "stdout": (proc.stdout or "")[-2000:],
            "inbox_file": str(path),
            "n_new": len(fresh),
        }

    seen = load_seen()
    seen |= new_ids
    save_seen(seen)

    return {
        "ok": True,
        "routed": True,
        "n_new": len(fresh),
        "inbox_file": str(path),
        "route_summary": summary,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "NepTranslateReviewSync/1.0"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), fmt % args))

    def _send(self, code: int, body: dict) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Review-Sync-Secret")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:
        self._send(204, {"ok": True})

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/", "/health"):
            self._send(200, {"ok": True, "service": "review_sync", "time": utc_now()})
            return
        self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/v1/reviews":
            self._send(404, {"ok": False, "error": "not found"})
            return

        expected = getattr(self.server, "sync_secret", "") or ""
        got = self.headers.get("X-Review-Sync-Secret") or ""
        if not expected or not secrets.compare_digest(got, expected):
            self._send(401, {"ok": False, "error": "unauthorized"})
            return

        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 8_000_000:
            self._send(400, {"ok": False, "error": "invalid content length"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._send(400, {"ok": False, "error": "invalid json"})
            return

        try:
            fresh, n_recv, n_new, new_ids = filter_new_reviews(payload)
            result = write_and_route(payload, fresh, new_ids)
            result["n_received"] = n_recv
            result["n_new"] = n_new
            code = 200 if result.get("ok") else 500
            self._send(code, result)
        except Exception as e:
            traceback.print_exc()
            self._send(500, {"ok": False, "error": str(e)})


def main() -> None:
    ap = argparse.ArgumentParser(description="Phone → PC data review receiver")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument(
        "--secret",
        default=os.environ.get("REVIEW_SYNC_SECRET", BAKED_SECRET),
        help="Shared secret (or set REVIEW_SYNC_SECRET)",
    )
    args = ap.parse_args()
    secret = (args.secret or BAKED_SECRET).strip()

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.sync_secret = secret  # type: ignore[attr-defined]
    urls = lan_urls(args.port)
    phone = urls[-1].replace("http://", "").replace(f":{args.port}", "")
    print(
        json.dumps(
            {
                "listening": f"http://{args.host}:{args.port}",
                "phone_urls": urls,
                "post": f"{urls[-1]}/v1/reviews",
                "inbox": str(INBOX),
                "app": {
                    "password": "1234",
                    "laptop_address": phone if ":" not in phone else urls[-1],
                    "hint": f"On the phone: Settings → Advanced → Data review. Password 1234. Laptop address {urls[-1].replace('http://', '')}",
                },
            },
            indent=2,
        ),
        flush=True,
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped", file=sys.stderr)


if __name__ == "__main__":
    main()
