Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path ".").Path
$Plan = Join-Path $Repo "plans/active/v1-final-contract-reconciliation.md"
$State = Join-Path $Repo ".agent/V1_FINAL_CONTRACT_STATE.md"
$LogDir = Join-Path $Repo ".agent/v1-finalization-loop-logs"

if (-not (Test-Path $Plan)) {
    throw "Missing plan: $Plan"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (Get-Command agent -ErrorAction SilentlyContinue) {
    $CursorCommand = "agent"
}
elseif (Get-Command cursor-agent -ErrorAction SilentlyContinue) {
    $CursorCommand = "cursor-agent"
}
else {
    throw "Cursor CLI not found. Install it and ensure 'agent' or 'cursor-agent' is on PATH."
}

$ConsecutiveFailures = 0

while ($true) {
    $StateText = if (Test-Path $State) {
        Get-Content -Raw $State
    }
    else {
        ""
    }

    if ($StateText -match "(?m)^status:\s*FINALIZATION_COMPLETE\s*$") {
        Write-Host "V1 finalization is complete according to $State"
        break
    }

    if ($StateText -match "(?m)^status:\s*WAITING_HUMAN\s*$") {
        Write-Host "V1 finalization is waiting for a human action. Read $State"
        break
    }

    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $Log = Join-Path $LogDir "$Stamp.log"

    $Prompt = @"
Continue the NepTranslate V1 final contract reconciliation.

Repository root:
$Repo

Authoritative standalone plan:
$Plan

Progress state:
$State

Rules for this pass:
1. Read AGENTS.md, the authoritative plan in full, and the progress state before acting.
2. Inspect git status and preserve all user changes. Never reset, discard, force-push, or write directly to main.
3. Fetch remote refs if network access is available, but do not switch away from the reconciliation branch or replace local work.
4. Select the earliest unfinished gate whose prerequisites are satisfied.
5. Implement one coherent next gate or one clearly bounded portion of a large gate. Do not merely report progress.
6. Use forward-only migrations. Never rewrite historical migrations or evidence.
7. Run the narrow tests for the change, then all broader tests required by that gate.
8. Fix failures caused by this work. Record unrelated blockers precisely.
9. Update documentation and .agent/V1_FINAL_CONTRACT_STATE.md with exact commands, results, evidence paths, HEAD SHA, and next action.
10. Commit a completed coherent gate with the gate ID in the subject. Push only the reconciliation branch after its tests pass.
11. Never deploy production.
12. Never put secrets or raw user content in source, logs, telemetry, fixtures, or the progress file.
13. If code-owned work remains, keep status: IN_PROGRESS and name the next action.
14. Use status: WAITING_HUMAN only when no safe code/document/test work can continue without a specific human credential, device, legal decision, hosted-service action, or approval. List the exact smallest unblock action.
15. Use status: FINALIZATION_COMPLETE only when every code-owned gate and verification in the plan is complete and green and the branch is clean/pushed. Human release gates must still be listed honestly.

Before ending, re-read the diff for privacy, reward idempotency, timezone/DST, deletion retry safety, ad safe points, offline-core preservation, and duplicate correction UI.
"@

    Push-Location $Repo
    try {
        & $CursorCommand -p --force --output-format text $Prompt 2>&1 |
            Tee-Object -FilePath $Log

        if ($LASTEXITCODE -ne 0) {
            $ConsecutiveFailures += 1
            Write-Warning "Cursor exited with code $LASTEXITCODE. Failure $ConsecutiveFailures of 3. Log: $Log"
        }
        else {
            $ConsecutiveFailures = 0
        }
    }
    finally {
        Pop-Location
    }

    if ($ConsecutiveFailures -ge 3) {
        throw "Stopping after three consecutive Cursor failures. Inspect $LogDir and the progress state."
    }

    $StateText = if (Test-Path $State) {
        Get-Content -Raw $State
    }
    else {
        ""
    }

    if ($StateText -match "(?m)^status:\s*FINALIZATION_COMPLETE\s*$") {
        Write-Host "V1 finalization is complete according to $State"
        break
    }

    if ($StateText -match "(?m)^status:\s*WAITING_HUMAN\s*$") {
        Write-Host "V1 finalization is waiting for a human action. Read $State"
        break
    }

    Write-Host "Plan is not finished. Continuing in 180 seconds..."
    Start-Sleep -Seconds 180
}
