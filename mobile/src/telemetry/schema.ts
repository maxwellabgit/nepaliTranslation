/**
 * Telemetry event schema — crash / perf / anonymous usage only.
 * Never include raw text, audio, transcripts, OCR, or photos.
 */

export const TELEMETRY_EVENT_NAMES = [
  'app.cold_start',
  'app.screen_view',
  'mt.ready',
  'mt.fallback',
  'stt.unavailable',
  'camera.session',
  'ads.house_shown',
  'subscription.snapshot',
  'telemetry.flush',
  'crash.soft',
] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];

/** Allowed metadata keys — keep values scalar / short codes only. */
export type TelemetryProps = {
  screen?: string;
  durationMs?: number;
  reasonCode?: string;
  adapter?: string;
  success?: boolean;
  count?: number;
  payloadLength?: number;
  contentHash?: string;
  platform?: string;
  appVersion?: string;
};

export type TelemetryEvent = {
  name: TelemetryEventName;
  props?: TelemetryProps;
  atMs: number;
  id: string;
};

export type TelemetrySink = {
  send: (events: TelemetryEvent[]) => Promise<void>;
};
