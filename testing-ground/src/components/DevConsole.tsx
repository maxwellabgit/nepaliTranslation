import { useState } from 'react';
import type {
  ScenarioState,
  TestingGroundBootConfig,
  TimelineEvent,
  ViewportPreset,
} from '../bridge/types';
import { TRANSLATE_MODE_LABELS } from '../bridge/config';

type TabId = 'overview' | 'timeline' | 'state' | 'fixtures';

type Props = {
  bootConfig: TestingGroundBootConfig;
  scenario: ScenarioState;
  events: TimelineEvent[];
  viewport: ViewportPreset;
  fixtureJson: string;
  fixtureError: string | null;
  onFixtureJsonChange: (value: string) => void;
  onApplyFixtures: () => void;
  onOfflineToggle: (offline: boolean) => void;
};

export function DevConsole({
  bootConfig,
  scenario,
  events,
  viewport,
  fixtureJson,
  fixtureError,
  onFixtureJsonChange,
  onApplyFixtures,
  onOfflineToggle,
}: Props) {
  const [tab, setTab] = useState<TabId>('overview');

  return (
    <aside className="tg-console">
      <div className="tg-tabs" role="tablist">
        {(
          [
            ['overview', 'Overview'],
            ['timeline', 'Timeline'],
            ['state', 'State'],
            ['fixtures', 'Fixtures'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={tab === id ? 'active' : undefined}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="tg-tab-body" role="tabpanel">
        {tab === 'overview' && (
          <table className="tg-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Harness</td>
                <td>{bootConfig.harness}</td>
              </tr>
              <tr>
                <td>Run id</td>
                <td className="tg-mono">{bootConfig.runId}</td>
              </tr>
              <tr>
                <td>Translate mode</td>
                <td>
                  {TRANSLATE_MODE_LABELS[bootConfig.translateMode].label}
                </td>
              </tr>
              <tr>
                <td>Viewport</td>
                <td>
                  {viewport.width}×{viewport.height} ({viewport.id})
                </td>
              </tr>
              <tr>
                <td>Offline</td>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(bootConfig.offline)}
                      onChange={(e) => onOfflineToggle(e.target.checked)}
                    />{' '}
                    {bootConfig.offline ? 'yes' : 'no'}
                  </label>
                </td>
              </tr>
              <tr>
                <td>neuralReady flag</td>
                <td>{String(Boolean(bootConfig.neuralReady))}</td>
              </tr>
              <tr>
                <td>Scenario</td>
                <td>
                  {scenario.name} / {scenario.status}
                </td>
              </tr>
              <tr>
                <td>Hosted app</td>
                <td className="tg-mono">/hosted-app/index.html</td>
              </tr>
              <tr>
                <td>Artifacts</td>
                <td className="tg-mono">
                  %LOCALAPPDATA%\NepTranslateTestingGround\runs\&lt;run-id&gt;\
                  (Tauri) · testing-ground/runs/ (Node)
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {tab === 'timeline' && (
          <table className="tg-table">
            <thead>
              <tr>
                <th>At</th>
                <th>Kind</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={3}>No events yet</td>
                </tr>
              ) : (
                [...events].reverse().map((ev, i) => (
                  <tr key={`${ev.at}-${i}`}>
                    <td className="tg-mono">{ev.at}</td>
                    <td>{ev.kind}</td>
                    <td className="tg-mono">{ev.detail ?? ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {tab === 'state' && (
          <table className="tg-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>bootConfig</td>
                <td>
                  <pre className="tg-mono">
                    {JSON.stringify(bootConfig, null, 2)}
                  </pre>
                </td>
              </tr>
              <tr>
                <td>scenario</td>
                <td>
                  <pre className="tg-mono">
                    {JSON.stringify(scenario, null, 2)}
                  </pre>
                </td>
              </tr>
              <tr>
                <td>eventCount</td>
                <td>{events.length}</td>
              </tr>
            </tbody>
          </table>
        )}

        {tab === 'fixtures' && (
          <div>
            <p className="tg-sub">
              Recorded translate fixtures (JSON array). Applied into{' '}
              <span className="tg-mono">window.__NEPTRANSLATE_TG__</span> and
              remounts the hosted app.
            </p>
            <textarea
              className="tg-textarea"
              value={fixtureJson}
              onChange={(e) => onFixtureJsonChange(e.target.value)}
              spellCheck={false}
            />
            {fixtureError ? <p className="tg-error">{fixtureError}</p> : null}
            <div className="tg-actions">
              <button type="button" onClick={onApplyFixtures}>
                Apply fixtures
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
