import {
  initialTranslatePhase,
  reduceTranslatePhase,
  isTranslateBusy,
  type TranslatePhaseEvent,
} from '../translatePhase';

const ALL_EVENTS: TranslatePhaseEvent[] = [
  { type: 'SPEAK' },
  { type: 'PERMISSION_GRANTED' },
  { type: 'PERMISSION_DENIED' },
  { type: 'LISTENING_STARTED' },
  { type: 'TRANSCRIPT_FINAL' },
  { type: 'TRANSLATE_STARTED' },
  { type: 'TRANSLATE_SUCCEEDED' },
  { type: 'TRANSLATE_FAILED', reasonCode: 'engine' },
  { type: 'CANCEL' },
  { type: 'RETRY' },
  { type: 'INTERRUPT' },
  { type: 'MARK_UNAVAILABLE', reasonCode: 'no_stt' },
  { type: 'RESET' },
];

describe('translatePhase machine', () => {
  test('covers speak → permission → listening → finalize → translate → success', () => {
    let s = initialTranslatePhase();
    s = reduceTranslatePhase(s, { type: 'SPEAK' });
    expect(s.phase).toBe('requestingPermission');
    s = reduceTranslatePhase(s, { type: 'PERMISSION_GRANTED' });
    expect(s.phase).toBe('listening');
    expect(isTranslateBusy(s.phase)).toBe(true);
    s = reduceTranslatePhase(s, { type: 'LISTENING_STARTED' });
    expect(s.phase).toBe('listening');
    s = reduceTranslatePhase(s, { type: 'TRANSCRIPT_FINAL' });
    expect(s.phase).toBe('finalizingTranscript');
    s = reduceTranslatePhase(s, { type: 'TRANSLATE_STARTED' });
    expect(s.phase).toBe('translating');
    s = reduceTranslatePhase(s, { type: 'TRANSLATE_SUCCEEDED' });
    expect(s.phase).toBe('success');
    expect(isTranslateBusy(s.phase)).toBe(false);
  });

  test('permission denial, cancel, reset, and unavailable', () => {
    let s = reduceTranslatePhase(initialTranslatePhase(), { type: 'SPEAK' });
    s = reduceTranslatePhase(s, { type: 'PERMISSION_DENIED' });
    expect(s).toEqual({ phase: 'recoverableError', reasonCode: 'permission_denied' });

    s = reduceTranslatePhase(initialTranslatePhase(), { type: 'SPEAK' });
    s = reduceTranslatePhase(s, { type: 'PERMISSION_GRANTED' });
    s = reduceTranslatePhase(s, { type: 'CANCEL' });
    expect(s.phase).toBe('idle');

    s = reduceTranslatePhase(s, { type: 'SPEAK' });
    s = reduceTranslatePhase(s, { type: 'RESET' });
    expect(s).toEqual(initialTranslatePhase());

    s = reduceTranslatePhase(initialTranslatePhase(), {
      type: 'MARK_UNAVAILABLE',
      reasonCode: 'no_stt',
    });
    expect(s.phase).toBe('unavailable');
  });

  test('typed translate path, retry, and interrupt', () => {
    let s = reduceTranslatePhase(initialTranslatePhase(), { type: 'TRANSLATE_STARTED' });
    expect(s.phase).toBe('translating');
    s = reduceTranslatePhase(s, { type: 'TRANSLATE_FAILED', reasonCode: 'engine' });
    expect(s).toEqual({ phase: 'recoverableError', reasonCode: 'engine' });
    s = reduceTranslatePhase(s, { type: 'RETRY' });
    expect(s.phase).toBe('translating');
    s = reduceTranslatePhase(s, { type: 'TRANSLATE_SUCCEEDED' });
    expect(s.phase).toBe('success');

    s = reduceTranslatePhase(initialTranslatePhase(), { type: 'TRANSLATE_STARTED' });
    s = reduceTranslatePhase(s, { type: 'INTERRUPT' });
    expect(s.phase).toBe('idle');
  });

  test('every event type is handled without throwing from idle', () => {
    for (const event of ALL_EVENTS) {
      expect(() => reduceTranslatePhase(initialTranslatePhase(), event)).not.toThrow();
    }
  });

  test('rejects illegal transitions (impossible iOS states stay put)', () => {
    const idle = initialTranslatePhase();
    expect(reduceTranslatePhase(idle, { type: 'PERMISSION_GRANTED' }).phase).toBe(
      'idle',
    );
    expect(reduceTranslatePhase(idle, { type: 'TRANSCRIPT_FINAL' }).phase).toBe(
      'idle',
    );
    expect(reduceTranslatePhase(idle, { type: 'TRANSLATE_SUCCEEDED' }).phase).toBe(
      'idle',
    );

    let listening = reduceTranslatePhase(idle, { type: 'SPEAK' });
    listening = reduceTranslatePhase(listening, { type: 'PERMISSION_GRANTED' });
    expect(listening.phase).toBe('listening');
    // Cannot skip to success from listening.
    expect(
      reduceTranslatePhase(listening, { type: 'TRANSLATE_SUCCEEDED' }).phase,
    ).toBe('listening');
    // Second SPEAK while listening is a no-op (must cancel first).
    expect(reduceTranslatePhase(listening, { type: 'SPEAK' }).phase).toBe(
      'listening',
    );
  });
});
