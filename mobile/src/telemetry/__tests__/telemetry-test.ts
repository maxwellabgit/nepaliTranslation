import { createTestRuntime } from '../../runtime/createTestRuntime';
import {
  TELEMETRY_BANNED_KEYS,
  TELEMETRY_SENSITIVE_FIXTURES,
  assertTelemetryClean,
  createTelemetryClient,
  scrubTelemetryEvent,
  type TelemetryEvent,
  type TelemetrySink,
} from '../index';

describe('telemetry scrubber', () => {
  const base = {
    name: 'app.screen_view',
    atMs: 1,
    id: 'tel_1',
  };

  test('rejects banned keys and unknown prop aliases', () => {
    for (const key of TELEMETRY_BANNED_KEYS) {
      expect(() =>
        assertTelemetryClean({ ...base, props: { [key]: 'secret' } }),
      ).toThrow(/banned|unknown/);
    }
    expect(() =>
      assertTelemetryClean({
        ...base,
        props: { sourceText: 'hello friend' },
      }),
    ).toThrow(/banned|unknown/);
    expect(() =>
      assertTelemetryClean({
        ...base,
        props: { translatedText: 'नमस्ते' },
      }),
    ).toThrow(/banned|unknown/);
    expect(() =>
      assertTelemetryClean({
        ...base,
        props: { screen: 'translate', durationMs: 12 },
      }),
    ).not.toThrow();
  });

  test('rejects free-form sentences even under reasonCode', () => {
    expect(() =>
      assertTelemetryClean({
        ...base,
        props: { reasonCode: 'user typed hello how are you today' },
      }),
    ).toThrow(/safe code|sensitive|too long/);
  });

  test('sensitive fixtures never survive scrub', () => {
    for (const sample of TELEMETRY_SENSITIVE_FIXTURES) {
      expect(() =>
        scrubTelemetryEvent({
          ...base,
          name: 'crash.soft',
          props: { reasonCode: sample.slice(0, 64) },
        }),
      ).toThrow(/sensitive|too long|safe code|banned/);
    }
  });

  test('blocks file and data-image URI shapes', () => {
    expect(() =>
      assertTelemetryClean({
        ...base,
        props: { reasonCode: 'file:///tmp/capture.jpg' },
      }),
    ).toThrow(/sensitive|safe code/);
    expect(() =>
      assertTelemetryClean({
        ...base,
        props: { reasonCode: 'data:image/png;base64,AAAA' },
      }),
    ).toThrow(/sensitive|safe code/);
  });
});

describe('telemetry client gate', () => {
  test('does not enqueue when telemetry_enabled is off', () => {
    const runtime = createTestRuntime({ nowMs: 10 });
    const sent: TelemetryEvent[][] = [];
    const sink: TelemetrySink = {
      send: async (batch) => {
        sent.push(batch);
      },
    };
    const client = createTelemetryClient({
      clock: runtime.clock,
      ids: runtime.ids,
      sink,
      isEnabled: () => false,
    });
    client.track('app.screen_view', { screen: 'settings' });
    expect(client.pending()).toHaveLength(0);
    return client.flush().then(() => {
      expect(sent).toHaveLength(0);
    });
  });

  test('when enabled, scrubbed events reach the sink without raw content', async () => {
    const runtime = createTestRuntime({ nowMs: 99 });
    const sent: TelemetryEvent[] = [];
    const sink: TelemetrySink = {
      send: async (batch) => {
        sent.push(...batch);
      },
    };
    const client = createTelemetryClient({
      clock: runtime.clock,
      ids: runtime.ids,
      sink,
      isEnabled: () => true,
    });
    client.track('app.screen_view', { screen: 'translate', durationMs: 40 });
    client.track('crash.soft', {
      reasonCode: 'Please meet me at 742 Evergreen Terrace tomorrow',
    });
    expect(client.pending()).toHaveLength(1);
    await client.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.name).toBe('app.screen_view');
    expect(JSON.stringify(sent)).not.toMatch(/Evergreen/);
  });
});
