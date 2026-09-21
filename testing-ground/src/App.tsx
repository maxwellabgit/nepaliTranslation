import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyTranslateMode,
  defaultBootConfig,
  TRANSLATE_MODE_LABELS,
} from './bridge/config';
import type {
  ScenarioCommandId,
  ScenarioState,
  TestingGroundBootConfig,
  TimelineEvent,
  TranslateModeId,
  ViewportPresetId,
} from './bridge/types';
import { VIEWPORT_PRESETS } from './bridge/types';
import {
  buildBrowserExportBundle,
  downloadJson,
} from './artifacts/browserExport';
import { DevConsole } from './components/DevConsole';
import { PhoneStage } from './components/PhoneStage';
import { ScenarioBar } from './components/ScenarioBar';

function newRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `run-${stamp}`;
}

export default function App() {
  const [viewportId, setViewportId] = useState<ViewportPresetId>('390x844');
  const [bootConfig, setBootConfig] = useState<TestingGroundBootConfig>(() =>
    defaultBootConfig({ runId: newRunId() }),
  );
  const [iframeKey, setIframeKey] = useState(0);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [scenario, setScenario] = useState<ScenarioState>({
    name: 'default-offline-translate',
    status: 'idle',
    stepIndex: 0,
    seed: 'tg-seed-1',
  });
  const [fixtureJson, setFixtureJson] = useState(() =>
    JSON.stringify(defaultBootConfig().translations ?? [], null, 2),
  );
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const viewport = useMemo(
    () => VIEWPORT_PRESETS.find((p) => p.id === viewportId) ?? VIEWPORT_PRESETS[1],
    [viewportId],
  );

  const pushEvent = useCallback((kind: string, detail?: string) => {
    setEvents((prev) => [
      ...prev,
      { at: new Date().toISOString(), kind, detail },
    ]);
  }, []);

  useEffect(() => {
    const host = {
      getBootConfig: () => bootConfig,
    };
    window.__NEPTRANSLATE_TG_HOST__ = host;
    window.__NEPTRANSLATE_TG__ = bootConfig;
    return () => {
      if (window.__NEPTRANSLATE_TG_HOST__ === host) {
        delete window.__NEPTRANSLATE_TG_HOST__;
      }
    };
  }, [bootConfig]);

  const remountHostedApp = useCallback(
    (next: TestingGroundBootConfig, reason: string) => {
      setBootConfig(next);
      window.__NEPTRANSLATE_TG__ = next;
      setIframeKey((k) => k + 1);
      pushEvent('app.remount', reason);
    },
    [pushEvent],
  );

  const postToApp = useCallback(
    (command: ScenarioCommandId, args?: Record<string, unknown>) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) {
        pushEvent('bridge.error', 'iframe not ready');
        return;
      }
      win.postMessage(
        { type: 'neptranlate-tg', channel: 'command', command, args },
        window.location.origin,
      );
      pushEvent('bridge.postMessage', command);
    },
    [pushEvent],
  );

  const onTranslateMode = (mode: TranslateModeId) => {
    const next = applyTranslateMode({ ...bootConfig }, mode);
    remountHostedApp(next, `translateMode=${mode}`);
  };

  const applyFixtures = () => {
    try {
      const parsed = JSON.parse(fixtureJson) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('Fixtures must be a JSON array');
      }
      setFixtureError(null);
      const next = { ...bootConfig, translations: parsed as TestingGroundBootConfig['translations'] };
      remountHostedApp(next, 'fixtures.apply');
    } catch (err) {
      setFixtureError(err instanceof Error ? err.message : String(err));
    }
  };

  const runCommand = (command: ScenarioCommandId) => {
    switch (command) {
      case 'load':
        setScenario((s) => ({ ...s, status: 'loaded', stepIndex: 0 }));
        remountHostedApp({ ...bootConfig }, 'scenario.load');
        pushEvent('scenario.load', scenario.name);
        break;
      case 'step':
        setScenario((s) => ({
          ...s,
          status: 'stepping',
          stepIndex: s.stepIndex + 1,
        }));
        postToApp('step', { index: scenario.stepIndex + 1 });
        pushEvent('scenario.step', String(scenario.stepIndex + 1));
        break;
      case 'run':
        setScenario((s) => ({ ...s, status: 'running' }));
        postToApp('run');
        pushEvent('scenario.run', scenario.name);
        break;
      case 'cancel':
        setScenario((s) => ({ ...s, status: 'cancelled' }));
        postToApp('cancel');
        pushEvent('scenario.cancel');
        break;
      case 'reset': {
        const fresh = defaultBootConfig({
          runId: newRunId(),
          seed: scenario.seed,
          translateMode: bootConfig.translateMode,
        });
        setScenario({
          name: 'default-offline-translate',
          status: 'idle',
          stepIndex: 0,
          seed: fresh.seed ?? 'tg-seed-1',
        });
        setEvents([]);
        setFixtureJson(JSON.stringify(fresh.translations ?? [], null, 2));
        remountHostedApp(fresh, 'scenario.reset');
        pushEvent('scenario.reset', fresh.runId);
        break;
      }
      case 'seed': {
        const seed = `tg-seed-${Date.now().toString(36)}`;
        setScenario((s) => ({ ...s, seed }));
        remountHostedApp({ ...bootConfig, seed }, 'scenario.seed');
        pushEvent('scenario.seed', seed);
        break;
      }
      case 'export': {
        const runId = bootConfig.runId ?? newRunId();
        const bundle = buildBrowserExportBundle({
          runId,
          bootConfig,
          scenario,
          events,
          viewport: {
            id: viewport.id,
            width: viewport.width,
            height: viewport.height,
          },
        });
        downloadJson(`${runId}-export.json`, bundle);
        pushEvent('scenario.export', runId);
        setScenario((s) => ({ ...s, status: 'done' }));
        break;
      }
      default:
        pushEvent('scenario.unknown', command);
    }
  };

  const modeMeta = TRANSLATE_MODE_LABELS[bootConfig.translateMode];

  return (
    <div className="tg-root">
      <header className="tg-header">
        <div>
          <h1>NepTranslate Testing Ground</h1>
          <p className="tg-sub">
            Engineering-only · hosts the real Expo web export · not an App Store or
            consumer Windows product
          </p>
        </div>
        <div className="tg-header-meta">
          <span className="tg-pill">offline scenario harness</span>
          <span className="tg-pill">{modeMeta.label}</span>
        </div>
      </header>

      <ScenarioBar onCommand={runCommand} scenario={scenario} />

      <div className="tg-main">
        <PhoneStage
          viewport={viewport}
          viewportId={viewportId}
          onViewportChange={setViewportId}
          iframeKey={iframeKey}
          iframeRef={iframeRef}
          translateMode={bootConfig.translateMode}
          onTranslateMode={onTranslateMode}
          modeHonesty={modeMeta.honesty}
        />
        <DevConsole
          bootConfig={bootConfig}
          scenario={scenario}
          events={events}
          viewport={viewport}
          fixtureJson={fixtureJson}
          fixtureError={fixtureError}
          onFixtureJsonChange={setFixtureJson}
          onApplyFixtures={applyFixtures}
          onOfflineToggle={(offline) =>
            remountHostedApp({ ...bootConfig, offline }, `offline=${offline}`)
          }
        />
      </div>
    </div>
  );
}
