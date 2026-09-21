import { createTestRuntime } from '../createTestRuntime';
import { isRuntimeIdle, waitForIdle } from '../waitForIdle';

describe('waitForIdle', () => {
  test('resolves when snapshot becomes idle without fixed product sleeps', async () => {
    const runtime = createTestRuntime({ nowMs: 0 });
    let translating = true;
    const sleepLog: number[] = [];
    const pending = waitForIdle(
      () => ({
        translatePhase: translating ? 'translating' : 'success',
        cameraPhase: 'live',
        listening: false,
        translating,
      }),
      {
        timeoutMs: 1000,
        intervalMs: 10,
        nowMs: () => runtime.clock.nowMs(),
        sleep: async (ms) => {
          sleepLog.push(ms);
          runtime.advanceMs(ms);
          if (sleepLog.length >= 2) translating = false;
        },
      },
    );
    await pending;
    expect(isRuntimeIdle({
      translatePhase: 'success',
      cameraPhase: 'live',
      listening: false,
      translating: false,
    })).toBe(true);
    expect(sleepLog.length).toBeGreaterThan(0);
  });

  test('times out when work never settles', async () => {
    const runtime = createTestRuntime({ nowMs: 0 });
    await expect(
      waitForIdle(
        () => ({
          translatePhase: 'listening',
          cameraPhase: 'live',
          listening: true,
          translating: false,
        }),
        {
          timeoutMs: 30,
          intervalMs: 10,
          nowMs: () => runtime.clock.nowMs(),
          sleep: async (ms) => {
            runtime.advanceMs(ms);
          },
        },
      ),
    ).rejects.toThrow(/timed out/);
  });
});

describe('createTestRuntime', () => {
  test('records translation and speech without platform SDKs', async () => {
    const runtime = createTestRuntime({
      translations: [
        {
          match: (req) => req.text.toLowerCase() === 'hello',
          result: {
            text: 'नमस्ते',
            method: 'phrase',
            direction: 'en-ne',
          },
        },
      ],
    });
    const seen: string[] = [];
    const unsub = runtime.speechRecognition.subscribe((e) => {
      if (e.kind === 'result' && e.transcript) seen.push(e.transcript);
    });
    runtime.pushTranscript('Hello');
    unsub();
    expect(seen).toEqual(['Hello']);
    const out = await runtime.translation.translate({
      text: 'Hello',
      preferred: 'en-ne',
      formality: 'formal',
      script: 'deva',
    });
    expect(out.text).toBe('नमस्ते');
  });
});
