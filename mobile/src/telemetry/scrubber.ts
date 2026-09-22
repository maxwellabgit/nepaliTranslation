/**
 * Scrub telemetry payloads before any third-party / remote sink.
 * Reuses F1 banned-key discipline and expands media/PII keys.
 */

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

export function assertTelemetryClean(value: unknown, path = ''): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertTelemetryClean(item, `${path}[${i}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if (TELEMETRY_BANNED_KEYS.has(key.toLowerCase())) {
      throw new Error(`banned telemetry field: ${next}`);
    }
    if (typeof child === 'string') {
      assertNoSensitiveSubstring(child, next);
    }
    assertTelemetryClean(child, next);
  }
}

export function assertNoSensitiveSubstring(value: string, path = 'value'): void {
  const lower = value.toLowerCase();
  for (const fixture of TELEMETRY_SENSITIVE_FIXTURES) {
    if (value.includes(fixture) || lower.includes(fixture.toLowerCase())) {
      throw new Error(`sensitive telemetry content at ${path}`);
    }
  }
  // Block common raw-content shapes even when keys were renamed.
  if (/^file:\/\//i.test(value) || /^data:image\//i.test(value)) {
    throw new Error(`sensitive telemetry content at ${path}`);
  }
  if (value.length > 256) {
    throw new Error(`telemetry string too long at ${path}`);
  }
}

export function scrubTelemetryEvent<T extends Record<string, unknown>>(
  event: T,
): T {
  assertTelemetryClean(event);
  return event;
}
