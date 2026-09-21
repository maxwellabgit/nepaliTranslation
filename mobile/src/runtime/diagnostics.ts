/**
 * Redacted diagnostic events. Never serialize raw user content.
 */
import type { ClockPort, IdPort } from './ports';

const BANNED_KEYS = new Set([
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
]);

export type DiagnosticEvent = {
  event: string;
  fromState?: string;
  toState?: string;
  durationMs?: number;
  adapter?: string;
  retryCount?: number;
  reasonCode?: string;
  payloadLength?: number;
  contentHash?: string;
  atMs: number;
  id: string;
};

export type DiagnosticSink = {
  emit: (event: Omit<DiagnosticEvent, 'atMs' | 'id'> & { atMs?: number; id?: string }) => void;
};

/** FNV-1a 32-bit hex. Content never leaves as plaintext. */
export function contentHash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (`00000000${(h >>> 0).toString(16)}`).slice(-8);
}

export function assertNoBannedFields(value: unknown, path = ''): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoBannedFields(item, `${path}[${i}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if (BANNED_KEYS.has(key.toLowerCase())) {
      throw new Error(`banned diagnostic field: ${next}`);
    }
    assertNoBannedFields(child, next);
  }
}

export function createDiagnosticBus(
  clock: ClockPort,
  ids: IdPort,
): DiagnosticSink & { events: () => DiagnosticEvent[] } {
  const events: DiagnosticEvent[] = [];
  return {
    emit: (event) => {
      assertNoBannedFields(event);
      const sealed: DiagnosticEvent = {
        ...event,
        atMs: clock.nowMs(),
        id: event.id || ids.nextId('evt'),
      };
      assertNoBannedFields(sealed);
      events.push(sealed);
    },
    events: () => events.slice(),
  };
}

export function redactTranslateEvent(input: {
  event: string;
  fromState?: string;
  toState?: string;
  durationMs?: number;
  adapter?: string;
  retryCount?: number;
  reasonCode?: string;
  sourceText?: string;
  clock: ClockPort;
  ids: IdPort;
}): DiagnosticEvent {
  const payloadLength = input.sourceText?.length;
  const hash = input.sourceText ? contentHash(input.sourceText) : undefined;
  const event: DiagnosticEvent = {
    event: input.event,
    fromState: input.fromState,
    toState: input.toState,
    durationMs: input.durationMs,
    adapter: input.adapter,
    retryCount: input.retryCount,
    reasonCode: input.reasonCode,
    payloadLength,
    contentHash: hash,
    atMs: input.clock.nowMs(),
    id: input.ids.nextId('evt'),
  };
  assertNoBannedFields(event);
  return event;
}
