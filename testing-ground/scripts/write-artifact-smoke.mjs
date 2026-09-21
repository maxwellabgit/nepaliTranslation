/**
 * Node fallback artifact writer.
 * Writes under testing-ground/runs/<run-id>/ (TG_FORCE_LOCAL_RUNS=1)
 * or %LOCALAPPDATA%\\NepTranslateTestingGround\\runs\\<run-id>\\ on Windows.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sanitizeRunId(runId) {
  const cleaned = String(runId)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80);
  return cleaned || `run-${Date.now()}`;
}

export function resolveRunsRoot({ forceLocal = false, localAppData } = {}) {
  const forced =
    forceLocal === true || process.env.TG_FORCE_LOCAL_RUNS === '1';
  if (forced) {
    return path.join(pkgRoot, 'runs');
  }
  const lad =
    localAppData ??
    process.env.LOCALAPPDATA ??
    (process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Local')
      : undefined);
  if (lad && process.platform === 'win32') {
    return path.join(lad, 'NepTranslateTestingGround', 'runs');
  }
  return path.join(pkgRoot, 'runs');
}

export function writeRunArtifacts(input) {
  const runId = sanitizeRunId(input.runId);
  const root = resolveRunsRoot({ forceLocal: input.forceLocal });
  const dir = path.join(root, runId);
  fs.mkdirSync(dir, { recursive: true });

  const files = {
    manifest: path.join(dir, 'manifest.json'),
    events: path.join(dir, 'events.jsonl'),
    snapshot: path.join(dir, 'final-snapshot.json'),
    summary: path.join(dir, 'summary.json'),
  };

  const manifest = {
    runId,
    createdAt: input.manifest?.createdAt ?? new Date().toISOString(),
    harness: 'neptranslate-testing-ground',
    platform: input.manifest?.platform ?? process.platform,
    artifactRoot: root,
    translateMode: input.manifest?.translateMode,
    seed: input.manifest?.seed,
    viewport: input.manifest?.viewport,
  };

  const events = input.events ?? [];
  const snapshot = {
    runId,
    capturedAt: input.snapshot?.capturedAt ?? new Date().toISOString(),
    bootConfig: input.snapshot?.bootConfig ?? null,
    scenario: input.snapshot?.scenario ?? null,
    consoleTabs: input.snapshot?.consoleTabs ?? null,
  };

  const summary = {
    runId,
    finishedAt: input.summary?.finishedAt ?? new Date().toISOString(),
    eventCount: input.summary?.eventCount ?? events.length,
    status: input.summary?.status ?? 'ok',
    notes: input.summary?.notes ?? [],
  };

  fs.writeFileSync(files.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    files.events,
    `${events.map((e) => JSON.stringify(e)).join('\n')}${events.length ? '\n' : ''}`,
    'utf8',
  );
  fs.writeFileSync(files.snapshot, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  fs.writeFileSync(files.summary, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { runId, dir, files, root };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.env.TG_FORCE_LOCAL_RUNS = '1';
  const runId = `smoke-${Date.now()}`;
  const result = writeRunArtifacts({
    runId,
    forceLocal: true,
    manifest: {
      createdAt: new Date().toISOString(),
      platform: process.platform,
      translateMode: 'fast-fallback',
      seed: 'smoke',
      viewport: { width: 390, height: 844, id: '390x844' },
    },
    events: [
      { at: new Date().toISOString(), kind: 'smoke.start', detail: 'artifact writer' },
      { at: new Date().toISOString(), kind: 'smoke.end', detail: 'ok' },
    ],
    snapshot: {
      capturedAt: new Date().toISOString(),
      bootConfig: { harness: 'neptranslate-testing-ground' },
      scenario: { name: 'smoke', status: 'done', stepIndex: 0, seed: 'smoke' },
    },
    summary: {
      finishedAt: new Date().toISOString(),
      status: 'ok',
      notes: ['write-artifact-smoke.mjs'],
    },
  });

  for (const f of Object.values(result.files)) {
    if (!fs.existsSync(f)) {
      console.error('Missing file', f);
      process.exit(1);
    }
  }
  console.log('[write-artifact-smoke] OK', result.dir);
}
