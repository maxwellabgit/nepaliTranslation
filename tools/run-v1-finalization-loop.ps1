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
3. A commit, a clean merge, or origin/main matching the reconciliation branch does not mean C0-C15 passed. Prove each gate with the plan's commands.
4. Continue through every unfinished code-owned gate in this pass. Do not stop after one gate. Do not stop on status WAITING_HUMAN while code, tests, or docs can still move.
5. Use forward-only migrations. Never rewrite historical migrations, audit evidence, or benchmark failures.
6. Run the tests for each change and read the output. An empty exclusion manifest is a failure, not a pass.
7. Fix failures caused by this work. Record unrelated blockers precisely, including the English-to-Nepali certificate if it still fails its floors.
8. Update documentation and .agent/V1_FINAL_CONTRACT_STATE.md with exact commands, results, evidence paths, HEAD SHA, and the next unproven gate.
9. Commit completed work with the gate IDs in the subject only after the tests you ran are honest. Push only the reconciliation branch.
10. Never deploy production. Never mark Internal TestFlight or public V1 GO from this loop.
11. Never put secrets or raw user content in source, logs, telemetry, fixtures, or the progress file.
12. Keep status IN_PROGRESS while any code-owned gate is unproven. FINALIZATION_COMPLETE is only for code-owned work that is green, and it still lists human release gates. It does not mean public V1 is GO.

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

    Write-Host "Plan is not finished. Continuing in 180 seconds..."
    Start-Sleep -Seconds 180
}
