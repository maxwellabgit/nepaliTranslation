import {
  assertNoBannedFields,
  contentHash,
  createDiagnosticBus,
  redactTranslateEvent,
} from '../diagnostics';
import { createTestRuntime } from '../createTestRuntime';

describe('diagnostic redaction', () => {
  test('contentHash is stable and redactTranslateEvent omits raw text', () => {
    expect(contentHash('Hello')).toBe(contentHash('Hello'));
    expect(contentHash('Hello')).not.toBe(contentHash('Hallo'));
    const runtime = createTestRuntime({ nowMs: 42 });
    const event = redactTranslateEvent({
      event: 'translate.success',
      fromState: 'translating',
      toState: 'success',
      adapter: 'test',
      sourceText: 'secret transcript',
      clock: runtime.clock,
      ids: runtime.ids,
    });
    expect(event.payloadLength).toBe('secret transcript'.length);
    expect(event.contentHash).toBe(contentHash('secret transcript'));
    expect(JSON.stringify(event)).not.toContain('secret');
    expect(JSON.stringify(event)).not.toContain('transcript');
    assertNoBannedFields(event);
  });

  test('assertNoBannedFields rejects raw user content keys', () => {
    const banned = [
      'text',
      'source',
      'translation',
      'transcript',
      'correction',
      'correction_text',
      'image',
      'uri',
      'email',
      'token',
      'password',
      'authorization',
      'raw',
      'payload',
      'content',
    ];
    for (const key of banned) {
      expect(() => assertNoBannedFields({ [key]: 'secret' })).toThrow(/banned/);
    }
    expect(() => assertNoBannedFields({ nested: { email: 'a@b.c' } })).toThrow(
      /banned/,
    );
    expect(() => assertNoBannedFields({ event: 'ok', reasonCode: 'x' })).not.toThrow();
  });

  test('diagnostic bus seals events with clock and ids', () => {
    const runtime = createTestRuntime({ nowMs: 100 });
    const bus = createDiagnosticBus(runtime.clock, runtime.ids);
    bus.emit({
      event: 'camera.result',
      fromState: 'translating',
      toState: 'result',
      payloadLength: 12,
      contentHash: contentHash('ignored'),
    });
    const [evt] = bus.events();
    expect(evt.atMs).toBe(100);
    expect(evt.id).toMatch(/^evt-/);
  });

  test('sensitive English and Nepali fixtures never appear in bus events or JSON', () => {
    const sensitive = [
      'Please meet me at 742 Evergreen Terrace tomorrow',
      'मेरो पासवर्ड SecretNepali123 हो',
      'नमस्ते मेरो नाम राम हो र मेरो ठेगाना काठमाडौं हो',
      'private medical note: diabetes diagnosis',
    ];
    const runtime = createTestRuntime({ nowMs: 7 });
    const bus = createDiagnosticBus(runtime.clock, runtime.ids);

    for (const sample of sensitive) {
      const redacted = redactTranslateEvent({
        event: 'translate.success',
        adapter: 'unit',
        sourceText: sample,
        clock: runtime.clock,
        ids: runtime.ids,
      });
      bus.emit(redacted);
      assertNoBannedFields(redacted);
      const json = JSON.stringify(redacted);
      expect(json).not.toContain(sample);
      for (const token of sample.split(/\s+/).filter((t) => t.length > 4)) {
        expect(json.toLowerCase()).not.toContain(token.toLowerCase());
      }
      expect(redacted.payloadLength).toBe(sample.length);
      expect(redacted.contentHash).toBe(contentHash(sample));
    }

    const dumped = JSON.stringify(bus.events());
    for (const sample of sensitive) {
      expect(dumped).not.toContain(sample);
      expect(dumped).not.toMatch(/Evergreen|SecretNepali|काठमाडौं|diabetes/i);
    }
  });
});
