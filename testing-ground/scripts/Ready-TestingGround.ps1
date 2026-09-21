<#
.SYNOPSIS
  Prepare the NepTranslate Windows testing ground (engineering only).

.DESCRIPTION
  Checks Node, optionally builds mobile web export, installs testing-ground deps,
  prepares hosted-app static files, and prints how to run.
  Does not require Rust/cargo for the Vite path.
#>
[CmdletBinding()]
param(
  [switch]$SkipExpoExport,
  [switch]$ForceExpoExport
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TgRoot = Resolve-Path (Join-Path $ScriptDir '..')
$RepoRoot = Resolve-Path (Join-Path $TgRoot '..')
$MobileRoot = Join-Path $RepoRoot 'mobile'
$MobileDist = Join-Path $MobileRoot 'dist'

Write-Host '=== NepTranslate Testing Ground readiness ===' -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"
Write-Host "Testing ground: $TgRoot"
Write-Host ''

function Assert-Command($Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Required command not found: $Name"
  }
  return $cmd
}

$node = Assert-Command 'node'
$npm = Assert-Command 'npm'
Write-Host "Node: $(& $node.Source -v)"
Write-Host "npm:  $(& $npm.Source -v)"

$cargo = Get-Command cargo -ErrorAction SilentlyContinue
$rustc = Get-Command rustc -ErrorAction SilentlyContinue
if ($cargo -and $rustc) {
  Write-Host "cargo: $(& $cargo.Source --version)"
  Write-Host "rustc: $(& $rustc.Source --version)"
  Write-Host 'Tauri path: available (npm run tauri:dev / tauri:build).' -ForegroundColor Green
} else {
  Write-Host 'BLOCKER (honest): cargo/rustc not on PATH.' -ForegroundColor Yellow
  Write-Host '  Vite frontend still works: npm run build / npm run dev'
  Write-Host '  Install Rust from https://rustup.rs to use npm run tauri:build'
}

Write-Host ''
$needExport = $ForceExpoExport -or (
  -not $SkipExpoExport -and (
    -not (Test-Path (Join-Path $MobileDist 'index.html'))
  )
)

if ($needExport) {
  Write-Host 'Building mobile web export (npx expo export --platform web)...'
  Push-Location $MobileRoot
  try {
    if (-not (Test-Path (Join-Path $MobileRoot 'node_modules'))) {
      Write-Host 'mobile/node_modules missing — running npm ci...'
      npm ci
    }
    npx expo export --platform web
  } finally {
    Pop-Location
  }
} elseif (Test-Path (Join-Path $MobileDist 'index.html')) {
  Write-Host "Using existing mobile/dist at $MobileDist"
} else {
  Write-Host 'WARNING: mobile/dist missing and export skipped.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Installing testing-ground dependencies...'
Push-Location $TgRoot
try {
  npm install
  if (Test-Path (Join-Path $MobileDist 'index.html')) {
    npm run prepare:hosted
  } else {
    Write-Host 'Skipping prepare:hosted (no mobile/dist).' -ForegroundColor Yellow
  }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host '=== How to run ===' -ForegroundColor Cyan
Write-Host 'Vite UI (no Rust):'
Write-Host "  cd `"$TgRoot`""
Write-Host '  npm run prepare:hosted'
Write-Host '  npm run dev'
Write-Host ''
Write-Host 'Vite production build:'
Write-Host "  cd `"$TgRoot`""
Write-Host '  npm run build'
Write-Host ''
Write-Host 'Artifact smoke (Node fallback -> testing-ground/runs):'
Write-Host "  cd `"$TgRoot`""
Write-Host '  npm run test:artifacts'
Write-Host ''
Write-Host 'Tauri desktop (requires Rust toolchain):'
Write-Host "  cd `"$TgRoot`""
Write-Host '  npm run tauri:dev'
Write-Host '  npm run tauri:build'
Write-Host ''
Write-Host 'Artifact dirs:'
Write-Host '  %LOCALAPPDATA%\NepTranslateTestingGround\runs\<run-id>\   (Windows / Tauri preference)'
Write-Host '  testing-ground\runs\<run-id>\                              (Node fallback)'
Write-Host ''
Write-Host 'Done.' -ForegroundColor Green
