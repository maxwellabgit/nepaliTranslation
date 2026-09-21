/**
 * Browser-side artifact export helper.
 * Prefers downloading a JSON bundle; Node smoke tests use `writeRunArtifacts` directly.
 * When Tauri FS APIs exist, a future bridge can write under LOCALAPPDATA.
 */

import type { TimelineEvent, TestingGroundBootConfig, ScenarioState } from '../bridge/types';

export type BrowserExportBundle = {
  runId: string;
  createdAt: string;
  manifest: Record<string, unknown>;
  events: TimelineEvent[];
  'final-snapshot': Record<string, unknown>;
  summary: Record<string, unknown>;
  note: string;
};

export function buildBrowserExportBundle(args: {
  runId: string;
  bootConfig: TestingGroundBootConfig;
  scenario: ScenarioState;
  events: TimelineEvent[];
  viewport: { width: number; height: number; id: string };
}): BrowserExportBundle {
  const now = new Date().toISOString();
  return {
    runId: args.runId,
    createdAt: now,
    manifest: {
      runId: args.runId,
      createdAt: now,
      harness: 'neptranslate-testing-ground',
      platform: navigator.platform,
      translateMode: args.bootConfig.translateMode,
      seed: args.bootConfig.seed,
      viewport: args.viewport,
      artifactPathHint:
        '%LOCALAPPDATA%\\NepTranslateTestingGround\\runs\\<run-id>\\ (Tauri) or testing-ground/runs/ (Node fallback)',
    },
    events: args.events,
    'final-snapshot': {
      runId: args.runId,
      capturedAt: now,
      bootConfig: args.bootConfig,
      scenario: args.scenario,
    },
    summary: {
      runId: args.runId,
      finishedAt: now,
      eventCount: args.events.length,
      status: args.scenario.status,
      notes: [
        'Browser export downloads a single JSON bundle.',
        'Use `npm run test:artifacts` for the Node writer that creates manifest.json / events.jsonl / final-snapshot.json / summary.json.',
      ],
    },
    note: 'Engineering-only artifact. Not a consumer Windows app export.',
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
