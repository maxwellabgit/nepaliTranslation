import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ScenarioResult = {
  id: string;
  status: 'passed' | 'failed' | 'skipped' | 'blocked';
  detail?: string;
};

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

type RunHandle = {
  runId: string;
  dir: string;
  eventsPath: string;
  summaryPath: string;
  snapshotPath: string;
};

let suiteRun: RunHandle | null = null;
const results: ScenarioResult[] = [];

function sanitizeRunId(runId: string): string {
  return runId.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || `run-${Date.now()}`;
}

export function ensureArtifactRun(): RunHandle {
  if (suiteRun) return suiteRun;

  process.env.TG_FORCE_LOCAL_RUNS = '1';
  const runId = sanitizeRunId(
    `pw-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  const root = path.join(pkgRoot, 'runs');
  const dir = path.join(root, runId);
  fs.mkdirSync(dir, { recursive: true });

  const eventsPath = path.join(dir, 'events.jsonl');
  const summaryPath = path.join(dir, 'summary.json');
  const snapshotPath = path.join(dir, 'final-snapshot.json');
  const manifestPath = path.join(dir, 'manifest.json');

  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        runId,
        createdAt: new Date().toISOString(),
        harness: 'neptranslate-testing-ground',
        platform: process.platform,
        artifactRoot: root,
        translateMode: 'recorded',
        seed: 'pw-scenarios',
        viewport: { width: 390, height: 844, id: '390x844' },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  fs.writeFileSync(
    eventsPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      kind: 'suite.start',
      detail: 'playwright scenarios',
    })}\n`,
    'utf8',
  );
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        runId,
        finishedAt: new Date().toISOString(),
        eventCount: 1,
        status: 'running',
        notes: ['playwright'],
        scenarios: [],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  fs.writeFileSync(
    snapshotPath,
    `${JSON.stringify(
      {
        runId,
        capturedAt: new Date().toISOString(),
        bootConfig: { harness: 'neptranslate-testing-ground' },
        scenario: { name: 'suite', status: 'running', stepIndex: 0, seed: 'pw' },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  suiteRun = { runId, dir, eventsPath, summaryPath, snapshotPath };
  return suiteRun;
}

export function recordScenario(result: ScenarioResult) {
  const run = ensureArtifactRun();
  results.push(result);
  fs.appendFileSync(
    run.eventsPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      kind: `scenario.${result.status}`,
      scenario: result.id,
      status: result.status,
      detail: result.detail ?? result.id,
    })}\n`,
    'utf8',
  );
}

export function finishArtifactRun(overall: 'ok' | 'failed' = 'ok') {
  if (!suiteRun) return null;
  const eventsRaw = fs.readFileSync(suiteRun.eventsPath, 'utf8').trim();
  const eventCount = eventsRaw ? eventsRaw.split('\n').length : 0;
  const summary = {
    runId: suiteRun.runId,
    finishedAt: new Date().toISOString(),
    eventCount,
    status: overall,
    notes: ['playwright test:scenarios'],
    scenarios: results,
  };
  fs.writeFileSync(suiteRun.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    suiteRun.snapshotPath,
    `${JSON.stringify(
      {
        runId: suiteRun.runId,
        capturedAt: new Date().toISOString(),
        bootConfig: { harness: 'neptranslate-testing-ground' },
        scenario: {
          name: 'suite',
          status: overall,
          stepIndex: results.length,
          seed: 'pw',
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return { ...summary, dir: suiteRun.dir };
}

export function artifactDir() {
  return suiteRun?.dir ?? null;
}
