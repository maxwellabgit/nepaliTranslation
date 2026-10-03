import { act, renderHook } from '@testing-library/react-native';
import { useTranslationSession } from '../useTranslationSession';
import { addHistory } from '../../storage/phrasebook';
import { useRuntime } from '../../runtime/RuntimeContext';

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
