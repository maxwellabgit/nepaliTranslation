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
  test('rejects banned keys including media and transcript fields', () => {
    for (const key of TELEMETRY_BANNED_KEYS) {
      expect(() => assertTelemetryClean({ [key]: 'secret' })).toThrow(/banned/);
    }
    expect(() =>
      assertTelemetryClean({ nested: { transcript: 'hello' } }),
    ).toThrow(/banned/);
    expect(() =>
      assertTelemetryClean({
        name: 'app.screen_view',
        props: { screen: 'translate', durationMs: 12 },
      }),
    ).not.toThrow();
  });

  test('sensitive fixtures never survive scrub or JSON', () => {
    for (const sample of TELEMETRY_SENSITIVE_FIXTURES) {
      expect(() =>
        scrubTelemetryEvent({
          name: 'crash.soft',
          props: { reasonCode: sample },
        }),
      ).toThrow(/sensitive|too long|banned/);
    }
  });

  test('blocks file and data-image URI shapes even under safe keys', () => {
    expect(() =>
      assertTelemetryClean({
        props: { reasonCode: 'file:///tmp/capture.jpg' },
      }),
    ).toThrow(/sensitive/);
    expect(() =>
      assertTelemetryClean({
        props: { reasonCode: 'data:image/png;base64,AAAA' },
      }),
    ).toThrow(/sensitive/);
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
    client.track('mt.ready', {
      adapter: 'onnx',
      durationMs: 40,
      payloadLength: 12,
      contentHash: 'deadbeef',
    });
    expect(client.pending()).toHaveLength(1);
    await client.flush();
    expect(sent).toHaveLength(1);
    const json = JSON.stringify(sent);
    for (const sample of TELEMETRY_SENSITIVE_FIXTURES) {
      expect(json).not.toContain(sample);
    }
    expect(json).not.toMatch(/Evergreen|SecretNepali|काठमाडौं|diabetes/i);
    expect(sent[0].name).toBe('mt.ready');
    expect(sent[0].atMs).toBe(99);
  });

  test('soft-fails when sink throws — never rejects caller', async () => {
    const runtime = createTestRuntime({ nowMs: 1 });
    const client = createTelemetryClient({
      clock: runtime.clock,
      ids: runtime.ids,
      isEnabled: () => true,
      sink: {
        send: async () => {
          throw new Error('network down');
        },
      },
    });
    client.track('app.cold_start', { platform: 'ios' });
    await expect(client.flush()).resolves.toBeUndefined();
  });

  test('drops events that would carry banned props instead of throwing', () => {
    const runtime = createTestRuntime({ nowMs: 5 });
    const client = createTelemetryClient({
      clock: runtime.clock,
      ids: runtime.ids,
      isEnabled: () => true,
    });
    // Cast: simulate a buggy caller stuffing raw content.
    client.track('crash.soft', {
      reasonCode: 'ok',
      transcript: 'raw speech',
    } as never);
    expect(client.pending()).toHaveLength(0);
  });
});
