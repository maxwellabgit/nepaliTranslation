#!/usr/bin/env python3
import hashlib, json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(".")
GOV = ROOT/".governance"
INTENT = GOV/"INTENT.md"
SNAP = GOV/"snapshots"/"latest.json"
REPORT = GOV/"reports"/"drift_latest.md"

IGNORE = {".git","node_modules",".venv",".next","dist","build","__pycache__"}
EXT = {".py",".js",".ts",".tsx",".jsx",".md",".json",".yml",".yaml",".toml",".sh",".sql"}

def hfile(p: Path) -> str:
    h = hashlib.md5()
    with p.open("rb") as f:
        for b in iter(lambda: f.read(8192), b""): h.update(b)
    return h.hexdigest()

def snap() -> dict:
    s={}
    for p in ROOT.rglob("*"):
        if not p.is_file(): continue
        if any(x in p.parts for x in IGNORE): continue
        if p.suffix not in EXT: continue
        s[str(p)] = hfile(p)
    return s

def count(marker: str) -> int:
    n=0
    for p in ROOT.rglob("*"):
        if not p.is_file(): continue
        if any(x in p.parts for x in IGNORE): continue
        if p.suffix not in EXT: continue
        try: n += p.read_text(errors="ignore").count(marker)
        except: pass
    return n

def sensitive(intent: str) -> list[str]:
    out=[]; on=False
    for ln in intent.splitlines():
        if ln.strip().lower().startswith("## sensitive areas"): on=True; continue
        if on and ln.startswith("## "): break
        if on and ln.strip().startswith("-"): out.append(ln.split("-",1)[1].strip())
    return out

def main():
    GOV.mkdir(exist_ok=True)
    (GOV/"snapshots").mkdir(parents=True, exist_ok=True)
    (GOV/"reports").mkdir(parents=True, exist_ok=True)

    intent = INTENT.read_text(errors="ignore") if INTENT.exists() else ""
    prev = json.loads(SNAP.read_text()) if SNAP.exists() else {}
    cur = snap()
    changed = sorted([f for f,v in cur.items() if prev.get(f) != v])

    todo, fixme = count("TODO"), count("FIXME")
    drift=0.0; why=[]

    if not intent.strip(): drift+=0.50; why.append("INTENT missing/empty")
    if len(changed) > 25: drift+=0.25; why.append("many files changed")
    if todo > 30: drift+=0.15; why.append("high TODO")
    if fixme > 10: drift+=0.15; why.append("high FIXME")

    sens = sensitive(intent)
    for s in sens:
        if s and any(s in f for f in changed):
            drift+=0.20; why.append(f"touched sensitive area: {s}"); break

    drift = min(1.0, drift)
    if not why: why=["no obvious drift signals"]

    REPORT.write_text(
        f"# Drift Report\n"
        f"generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n"
        f"drift_score = {drift:.2f}\n"
        f"changed_files = {len(changed)}\n"
        f"TODO = {todo}\n"
        f"FIXME = {fixme}\n\n"
        f"reasons:\n- " + "\n- ".join(why) + "\n\n"
        f"changed (first 80):\n- " + "\n- ".join(changed[:80] or ["(none)"]) + "\n"
    )
    SNAP.write_text(json.dumps(cur, indent=2))
    print(f"drift_score={drift:.2f}  report={REPORT}")

if __name__ == "__main__":
    main()
