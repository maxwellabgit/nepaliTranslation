import { act, renderHook } from '@testing-library/react-native';
import { useTranslationSession } from '../useTranslationSession';
import { addHistory } from '../../storage/phrasebook';
import { useRuntime } from '../../runtime/RuntimeContext';
import { saveUtterance } from '../../features/contribution/utteranceCapture';
import { CONTRIBUTION_CONSENT_VERSION } from '../../features/auth/consent';
const mockAuthState = { status: 'guest', authConfigured: true, userId: null as string | null,
  ageConfirmed: true, consentVersion: CONTRIBUTION_CONSENT_VERSION };
jest.mock('../../features/auth/AuthProvider', () => ({ useAuth: () => mockAuthState }));
jest.mock('../../stt/sttSupport', () => ({ getSttSupport: async () => ({ en: true, ne: true }), hardStopRecognition: jest.fn() }));
jest.mock('../../features/contribution/utteranceCapture', () => ({
  ...jest.requireActual('../../features/contribution/utteranceCapture'),
  saveUtterance: jest.fn(async () => ({ ok: false, reason: 'not_saved' })),
}));

jest.mock('../../storage/phrasebook', () => ({ addHistory: jest.fn(async () => undefined) }));
jest.mock('../../runtime/RuntimeContext', () => ({ useRuntime: jest.fn() }));

test('restored identity/settings survive preference loading and a request saves its original settings', async () => {
  let resolve!: (result: { text: string; method: string; direction: string; cancelled: boolean }) => void;
  const translate = jest.fn(() => new Promise(r => { resolve = r; }));
  (useRuntime as jest.Mock).mockReturnValue({
    translation: { translate, cancelAll: jest.fn() },
    ids: { nextId: () => 'new-turn' },
    speechRecognition: { subscribe: () => () => undefined, abort: jest.fn() },
    speechSynthesis: { stop: jest.fn(), speak: jest.fn() },
  });
  const view = await renderHook(() => useTranslationSession({ active: true, seed: {
    id: 'actual-history-id', source: 'Hello', translation: 'नमस्ते', sourceLang: 'en',
    targetLang: 'ne', createdAt: 1, formality: 'informal', script: 'roman',
  } }));
  expect(view.result.current.state.turns[0].id).toBe('actual-history-id');
  expect(view.result.current.state.formality).toBe('informal');
  expect(view.result.current.state.script).toBe('roman');
  let submission!: Promise<void>;
  await act(async () => { submission = view.result.current.submit(); });
  expect(translate).toHaveBeenCalledWith(expect.objectContaining({ formality: 'informal', script: 'roman' }));
  await act(async () => {
    view.result.current.dispatch({ type: 'setFormality', formality: 'formal' });
    view.result.current.dispatch({ type: 'setScript', script: 'deva' });
  });
  await act(async () => {
    resolve({ text: 'namaste', method: 'neural', direction: 'en-ne', cancelled: false });
    await submission;
  });
  expect(addHistory).toHaveBeenCalledWith(expect.objectContaining({
    id: 'new-turn', formality: 'informal', script: 'roman',
  }));
});

test('a recording begun without private identity is never attached to an identity created mid-recording', async () => {
  mockAuthState.status = 'guest'; mockAuthState.userId = null;
  let listener!: (event: { kind: string; transcript?: string; audioUri?: string }) => void;
  (useRuntime as jest.Mock).mockReturnValue({
    translation: { translate: async () => ({ text: 'नमस्ते', method: 'neural', direction: 'en-ne' }), cancelAll: jest.fn() },
    ids: { nextId: () => 'clip-turn' },
    speechRecognition: { subscribe: (fn: typeof listener) => { listener = fn; return () => undefined; },
      requestPermission: async () => 'granted', start: jest.fn(), abort: jest.fn(), stop: jest.fn() },
    speechSynthesis: { stop: jest.fn(), speak: jest.fn() },
  });
  const view = await renderHook(() => useTranslationSession({ active: true }));
  const realNow = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(realNow);
  await act(async () => { await view.result.current.toggleListen(); });
  expect(view.result.current.state.listening).toBe(true);
  clock.mockReturnValue(realNow + 1500);
  mockAuthState.status = 'signed-in'; mockAuthState.userId = 'new-private-uuid';
  await view.rerender({});
  await act(async () => {
    listener({ kind: 'result', transcript: 'Hello' });
    listener({ kind: 'end' });
    listener({ kind: 'audio', audioUri: 'file:///clip.m4a' });
  });
  expect(saveUtterance).toHaveBeenCalledWith(expect.objectContaining({ userId: null, signedIn: false, eligible: false, durationMs: 1500 }));
  clock.mockRestore();
});
