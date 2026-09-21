/**
 * Scenario run artifacts for Playwright / Node.
 * Prefer %LOCALAPPDATA%\\NepTranslateTestingGround\\runs\\ on Windows;
 * force testing-ground/runs/ with TG_FORCE_LOCAL_RUNS=1.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function sanitizeRunId(runId) {
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
    scenarios: input.summary?.scenarios ?? [],
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

/** Create or reopen a run directory for incremental scenario appends. */
export function openScenarioRun(input = {}) {
  const runId = sanitizeRunId(
    input.runId ?? `pw-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  const forceLocal = input.forceLocal ?? process.env.TG_FORCE_LOCAL_RUNS === '1';
  const root = resolveRunsRoot({ forceLocal });
  const dir = path.join(root, runId);
  fs.mkdirSync(dir, { recursive: true });

  const files = {
    manifest: path.join(dir, 'manifest.json'),
    events: path.join(dir, 'events.jsonl'),
    snapshot: path.join(dir, 'final-snapshot.json'),
    summary: path.join(dir, 'summary.json'),
  };

  if (!fs.existsSync(files.manifest)) {
    writeRunArtifacts({
      runId,
      forceLocal,
      manifest: {
        createdAt: new Date().toISOString(),
        platform: process.platform,
        translateMode: input.translateMode ?? 'recorded',
        seed: input.seed ?? 'pw-scenarios',
        viewport: input.viewport ?? { width: 390, height: 844, id: '390x844' },
      },
      events: [
        {
          at: new Date().toISOString(),
          kind: 'suite.start',
          detail: 'playwright scenarios',
        },
      ],
      snapshot: {
        capturedAt: new Date().toISOString(),
        bootConfig: { harness: 'neptranslate-testing-ground' },
        scenario: { name: 'suite', status: 'running', stepIndex: 0, seed: 'pw' },
      },
      summary: {
        finishedAt: new Date().toISOString(),
        status: 'running',
        notes: ['playwright'],
        scenarios: [],
      },
    });
  }

  return { runId, dir, files, root, forceLocal };
}

export function appendScenarioEvent(run, event) {
  const row = {
    at: event.at ?? new Date().toISOString(),
    kind: event.kind,
    detail: event.detail,
    scenario: event.scenario,
    status: event.status,
  };
  fs.appendFileSync(run.files.events, `${JSON.stringify(row)}\n`, 'utf8');
  return row;
}

export function finalizeScenarioRun(run, { status = 'ok', scenarios = [], notes = [] } = {}) {
  const eventsRaw = fs.existsSync(run.files.events)
    ? fs.readFileSync(run.files.events, 'utf8').trim()
    : '';
  const eventCount = eventsRaw ? eventsRaw.split('\n').length : 0;
  const summary = {
    runId: run.runId,
    finishedAt: new Date().toISOString(),
    eventCount,
    status,
    notes,
    scenarios,
  };
  fs.writeFileSync(run.files.summary, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  const snapshot = {
    runId: run.runId,
    capturedAt: new Date().toISOString(),
    bootConfig: { harness: 'neptranslate-testing-ground' },
    scenario: { name: 'suite', status, stepIndex: scenarios.length, seed: 'pw' },
  };
  fs.writeFileSync(run.files.snapshot, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return summary;
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
