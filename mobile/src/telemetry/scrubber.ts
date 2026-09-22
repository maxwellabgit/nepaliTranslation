/**
 * Scrub telemetry payloads before any third-party / remote sink.
 * Allowlist-first: only known event fields and TelemetryProps keys may pass.
 * Values must stay short codes / scalars — never raw translations or media.
 */

import {
  TELEMETRY_EVENT_NAMES,
  type TelemetryEventName,
} from './schema';

export const TELEMETRY_ALLOWED_PROP_KEYS = new Set([
  'screen',
  'durationMs',
  'reasonCode',
  'adapter',
  'success',
  'count',
  'payloadLength',
  'contentHash',
  'platform',
  'appVersion',
]);

export const TELEMETRY_ALLOWED_EVENT_KEYS = new Set([
  'name',
  'props',
  'atMs',
  'id',
]);

const ALLOWED_NAMES = new Set<string>(TELEMETRY_EVENT_NAMES);

/** Legacy denylist kept for tests + defense in depth under props. */
export const TELEMETRY_BANNED_KEYS = new Set([
  'text',
  'source',
  'translation',
  'transcript',
  'correction',
  'correction_text',
  'image',
  'photo',
  'photos',
  'audio',
  'recording',
  'ocr',
  'ocr_text',
  'uri',
  'url',
  'path',
  'file',
  'base64',
  'email',
  'token',
  'password',
  'authorization',
  'raw',
  'payload',
  'content',
  'message',
  'body',
  'input',
  'output',
  'prompt',
  'clipboard',
  'sourcetext',
  'translatedtext',
  'source_text',
  'translated_text',
]);

/** Substrings that must never appear in serialized telemetry JSON. */
export const TELEMETRY_SENSITIVE_FIXTURES = [
  'Please meet me at 742 Evergreen Terrace tomorrow',
  'मेरो पासवर्ड SecretNepali123 हो',
  'नमस्ते मेरो नाम राम हो र मेरो ठेगाना काठमाडौं हो',
  'private medical note: diabetes diagnosis',
  'data:image/png;base64,iVBORw0KGgo=',
  'file:///var/mobile/Containers/Data/photo.jpg',
] as const;

const MAX_STRING = 64;
const CODE_RE = /^[A-Za-z0-9._:-]{1,64}$/;

export function assertNoSensitiveSubstring(value: string, path = 'value'): void {
  const lower = value.toLowerCase();
  for (const fixture of TELEMETRY_SENSITIVE_FIXTURES) {
    if (value.includes(fixture) || lower.includes(fixture.toLowerCase())) {
      throw new Error(`sensitive telemetry content at ${path}`);
    }
  }
  if (/^file:\/\//i.test(value) || /^data:image\//i.test(value)) {
    throw new Error(`sensitive telemetry content at ${path}`);
  }
  if (value.length > MAX_STRING) {
    throw new Error(`telemetry string too long at ${path}`);
  }
}

function assertPropValue(key: string, value: unknown, path: string): void {
  if (value == null) return;
  if (typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`invalid telemetry number at ${path}`);
    }
    return;
  }
  if (typeof value === 'string') {
    assertNoSensitiveSubstring(value, path);
    // Codes / screens must stay token-like — blocks free-form sentences.
    if (key === 'durationMs' || key === 'count' || key === 'payloadLength') {
      throw new Error(`telemetry type mismatch at ${path}`);
    }
    if (!CODE_RE.test(value)) {
      throw new Error(`telemetry value not a safe code at ${path}`);
    }
    return;
  }
  throw new Error(`telemetry non-scalar at ${path}`);
}

/**
 * Allowlist scrub: event must only contain known keys; props only TelemetryProps.
 * Unknown aliases (e.g. sourceText) are rejected even if not in the legacy denylist.
 */
export function assertTelemetryClean(value: unknown, path = ''): void {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`telemetry must be an event object${path ? ` at ${path}` : ''}`);
  }
  const event = value as Record<string, unknown>;
  for (const key of Object.keys(event)) {
    if (!TELEMETRY_ALLOWED_EVENT_KEYS.has(key)) {
      throw new Error(`unknown telemetry field: ${path ? `${path}.` : ''}${key}`);
    }
  }
  const name = event.name;
  if (typeof name !== 'string' || !ALLOWED_NAMES.has(name)) {
    throw new Error(`unknown telemetry event name`);
  }
  if (event.atMs != null && typeof event.atMs !== 'number') {
    throw new Error('telemetry atMs must be a number');
  }
  if (event.id != null && typeof event.id !== 'string') {
    throw new Error('telemetry id must be a string');
  }
  if (event.id != null) assertNoSensitiveSubstring(String(event.id), 'id');

  const props = event.props;
  if (props == null) return;
  if (typeof props !== 'object' || Array.isArray(props)) {
    throw new Error('telemetry props must be an object');
  }
  for (const [key, child] of Object.entries(props as Record<string, unknown>)) {
    const next = `props.${key}`;
    if (TELEMETRY_BANNED_KEYS.has(key.toLowerCase())) {
      throw new Error(`banned telemetry field: ${next}`);
    }
    if (!TELEMETRY_ALLOWED_PROP_KEYS.has(key)) {
      throw new Error(`unknown telemetry prop: ${next}`);
    }
    assertPropValue(key, child, next);
  }
}

export function scrubTelemetryEvent<T extends Record<string, unknown>>(
  event: T,
): T {
  assertTelemetryClean(event);
  return event;
}

export type { TelemetryEventName };
