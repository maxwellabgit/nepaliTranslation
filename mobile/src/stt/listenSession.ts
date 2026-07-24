/**
 * Shared listen lifecycle for Auto + Conversation.
 * One session at a time: start → partials → stop → final text.
 */
export type ListenHandlers = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnded: () => void;
};

export type ListenController = {
  start: (locale: string) => Promise<boolean>;
  stop: () => Promise<void>;
  abort: () => Promise<void>;
  isActive: () => boolean;
};

type ExpoSpeechRecognitionModuleLike = {
  start: (opts: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  addListener: (event: string, cb: (e: any) => void) => { remove: () => void };
};

/**
 * Build a listen controller around Expo SpeechRecognition.
 * Callers own locale (EN vs NE) — Auto Detect must remount locale when direction flips.
 */
export function createListenSession(
  SpeechRecognition: ExpoSpeechRecognitionModuleLike | null,
  handlers: ListenHandlers,
): ListenController {
  let active = false;
  const subs: { remove: () => void }[] = [];

  const clearSubs = () => {
    while (subs.length) {
      try {
        subs.pop()?.remove();
      } catch {
        /* ignore */
      }
    }
  };

  const attach = () => {
    clearSubs();
    if (!SpeechRecognition) return;
    subs.push(
      SpeechRecognition.addListener("result", (event: any) => {
        const t = String(event?.results?.[0]?.transcript ?? "").trim();
        if (!t) return;
        if (event?.isFinal) handlers.onFinal(t);
        else handlers.onPartial(t);
      }),
    );
    subs.push(
      SpeechRecognition.addListener("error", (event: any) => {
        active = false;
        const msg = String(event?.message ?? event?.error ?? "Speech recognition failed");
        handlers.onError(msg);
        handlers.onEnded();
      }),
    );
    subs.push(
      SpeechRecognition.addListener("end", () => {
        active = false;
        handlers.onEnded();
      }),
    );
  };

  return {
    isActive: () => active,
    async start(locale: string) {
      if (!SpeechRecognition) {
        handlers.onError("Speech recognition unavailable");
        return false;
      }
      if (active) {
        try {
          SpeechRecognition.abort();
        } catch {
          /* ignore */
        }
        active = false;
      }
      attach();
      try {
        SpeechRecognition.start({
          lang: locale,
          interimResults: true,
          continuous: false,
          requiresOnDeviceRecognition: false,
        });
        active = true;
        return true;
      } catch (e: any) {
        active = false;
        handlers.onError(String(e?.message ?? e));
        handlers.onEnded();
        return false;
      }
    },
    async stop() {
      if (!SpeechRecognition || !active) return;
      try {
        SpeechRecognition.stop();
      } catch {
        /* ignore */
      }
      active = false;
    },
    async abort() {
      if (!SpeechRecognition) return;
      try {
        SpeechRecognition.abort();
      } catch {
        /* ignore */
      }
      active = false;
      clearSubs();
    },
  };
}
