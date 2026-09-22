/**
 * Soft-fail telemetry client. Never blocks translate / Camera / Learn.
 * Emits only when `telemetryEnabled` is true; scrubber runs before any sink.
 */
import { getRuntimeFeatureFlags } from '../app/featureFlags';
import type { ClockPort, IdPort } from '../runtime/ports';
import {
  TELEMETRY_EVENT_NAMES,
  type TelemetryEvent,
  type TelemetryEventName,
  type TelemetryProps,
  type TelemetrySink,
} from './schema';
import { scrubTelemetryEvent } from './scrubber';

const ALLOWED = new Set<string>(TELEMETRY_EVENT_NAMES);

export type TelemetryClient = {
  track: (name: TelemetryEventName, props?: TelemetryProps) => void;
  flush: () => Promise<void>;
  pending: () => TelemetryEvent[];
};

export type TelemetryClientOptions = {
  clock: ClockPort;
  ids: IdPort;
  sink?: TelemetrySink;
  /** Override flag read (tests). Default: runtime feature flags. */
  isEnabled?: () => boolean;
};

function defaultEnabled(): boolean {
  try {
    return getRuntimeFeatureFlags().telemetryEnabled === true;
  } catch {
    return false;
  }
}

/** No-op sink used when flag is off or remote endpoint is absent. */
export const nullTelemetrySink: TelemetrySink = {
  send: async () => undefined,
};

export function createTelemetryClient(
  options: TelemetryClientOptions,
): TelemetryClient {
  const queue: TelemetryEvent[] = [];
  const isEnabled = options.isEnabled ?? defaultEnabled;
  const sink = options.sink ?? nullTelemetrySink;

  return {
    track(name, props) {
      try {
        if (!isEnabled()) return;
        if (!ALLOWED.has(name)) return;
        const event: TelemetryEvent = {
          name,
          props: props ? { ...props } : undefined,
          atMs: options.clock.nowMs(),
          id: options.ids.nextId('tel'),
        };
        scrubTelemetryEvent(event as unknown as Record<string, unknown>);
        queue.push(event);
      } catch {
        /* soft-fail — never throw into product UI */
      }
    },
    async flush() {
      try {
        if (!isEnabled() || queue.length === 0) {
          queue.length = 0;
          return;
        }
        const batch = queue.splice(0, queue.length);
        for (const evt of batch) {
          scrubTelemetryEvent(evt as unknown as Record<string, unknown>);
        }
        await sink.send(batch);
      } catch {
        /* soft-fail */
      }
    },
    pending: () => queue.slice(),
  };
}
