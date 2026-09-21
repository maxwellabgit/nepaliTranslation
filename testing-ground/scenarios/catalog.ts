/**
 * Catalog of the 12 product scenarios for the Windows testing ground.
 * Automated = Playwright green against Expo web + TG recorded runtime.
 * Blocked = needs native mic / camera / ML Kit on a physical iPhone.
 */
export const SCENARIO_CATALOG = [
  {
    id: '01-cold-launch-empty-speak',
    title: 'Cold launch / empty Speak',
    status: 'automated',
  },
  {
    id: '02-typed-en-ne-hello',
    title: 'Typed EN→NE Hello→नमस्ते (recorded/phrase path)',
    status: 'automated',
  },
  {
    id: '03-tab-switch',
    title: 'Tab switch Translate / Camera / Learn',
    status: 'automated',
  },
  {
    id: '04-history-overlay',
    title: 'History overlay open / close',
    status: 'automated',
  },
  {
    id: '05-learn-alphabet-glyph',
    title: 'Learn alphabet glyph visible',
    status: 'automated',
  },
  {
    id: '06-camera-permission',
    title: 'Camera tab opens (permission UI or live shutter on web)',
    status: 'automated',
  },
  {
    id: '07-camera-ocr-fixture',
    title: 'Camera OCR fixture result (TG fixture, not native ML Kit)',
    status: 'automated',
  },
  {
    id: '08-pass-the-phone',
    title: 'Pass-the-phone after a typed turn',
    status: 'automated',
  },
  {
    id: '09-settings-overlay',
    title: 'Settings overlay open / close',
    status: 'automated',
  },
  {
    id: '10-speech-permission-denied',
    title: 'Speak with speech permission denied (TG bridge)',
    status: 'automated',
  },
  {
    id: '11-live-mic-stt',
    title: 'Live microphone STT → translate',
    status: 'blocked',
    blocker: 'scenarios/blockers.md#11-live-mic-stt',
  },
  {
    id: '12-live-camera-capture-ocr',
    title: 'Live camera capture + on-device OCR',
    status: 'blocked',
    blocker: 'scenarios/blockers.md#12-live-camera-capture-ocr',
  },
];
