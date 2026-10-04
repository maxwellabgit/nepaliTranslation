import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { SupportSection } from '../SupportSection';
import { supportRpc } from '../supportApi';
let mockOwner: string | null = 'A';
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ userId: mockOwner }) }));
jest.mock('../supportApi', () => ({ supportRpc: jest.fn() }));
const rpc = supportRpc as jest.Mock;
beforeEach(async () => { mockOwner = 'A'; jest.clearAllMocks(); await AsyncStorage.clear(); rpc.mockResolvedValue([]); });
async function mount() { let view!: ReturnType<typeof render>; await act(async () => { view = render(<SupportSection category="general" />); }); return view; }
async function compose() { await fireEvent.changeText(screen.getByTestId('support-message'), 'synthetic issue'); await fireEvent.press(screen.getByTestId('support-opt-in')); }
it('keeps editing disabled until stored draft hydration completes', async () => {
  let finish!: (value: string | null) => void;
  jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await mount(); expect(screen.getByTestId('support-message').props.editable).toBe(false);
  await act(async () => finish(JSON.stringify({ message: 'saved issue', nonce: 'saved-nonce' })));
  expect(screen.getByTestId('support-message').props.value).toBe('saved issue');
  expect(screen.getByTestId('support-message').props.editable).toBe(true);
});
it('does not resurrect a deleted request from a late initial list snapshot', async () => {
  const row = { id: 'request', message: 'old message', reply: null, created_at: '2026-10-03', category: 'general', replied_at: null };
  let finish!: (value: unknown) => void;
  rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue([row]);
  await mount(); await fireEvent.press(screen.getByTestId('support-refresh'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await fireEvent.press(screen.getByTestId('support-delete-request'));
  await act(async () => alert.mock.calls[0][2]?.find(action => action.style === 'destructive')?.onPress?.());
  await act(async () => finish([row]));
  expect(screen.queryByText('old message')).toBeNull(); alert.mockRestore();
});
it('requires a separate support choice before sending and attaches no history or audio', async () => {
  await mount(); await fireEvent.changeText(screen.getByTestId('support-message'), 'synthetic issue');
  expect(screen.getByTestId('support-send')).toBeDisabled();
  await fireEvent.press(screen.getByTestId('support-opt-in'));
  await fireEvent.press(screen.getByTestId('support-send'));
  const call = rpc.mock.calls.find(row => row[1] === 'support_submit');
  expect(call?.[0]).toBe('A'); expect(Object.keys(call?.[2]).sort()).toEqual(['p_app_version','p_category','p_client_id','p_message']);
  expect(screen.getByText('Sent. You can check for a reply here.')).toBeTruthy();
});
it('keeps a failed draft across restart and retries with the same client ID', async () => {
  const view = await mount(); await compose();
  rpc.mockImplementation(async (_owner, method) => { if (method === 'support_submit') throw Error('offline'); return []; });
  await fireEvent.press(screen.getByTestId('support-send'));
  const failedId = rpc.mock.calls.find(row => row[1] === 'support_submit')![2].p_client_id;
  expect(screen.getByTestId('support-message').props.value).toBe('synthetic issue');
  await act(async () => view.unmount());
  await mount(); expect(screen.getByTestId('support-message').props.value).toBe('synthetic issue');
  await fireEvent.press(screen.getByTestId('support-opt-in'));
  rpc.mockResolvedValue([]); await fireEvent.press(screen.getByTestId('support-send'));
  expect(rpc.mock.calls.filter(row => row[1] === 'support_submit').at(-1)?.[2].p_client_id).toBe(failedId);
});
it('does not claim a confirmed message failed when refreshing replies fails', async () => {
  await mount(); await compose(); rpc.mockImplementation(async (_owner, method) => { if (method === 'support_list') throw Error('offline'); return { id: 'accepted' }; });
  await fireEvent.press(screen.getByTestId('support-send'));
  expect(screen.getByText('Sent. You can check for a reply here.')).toBeTruthy();
  expect(screen.getByTestId('support-message').props.value).toBe('');
});
it('isolates drafts and late responses when the private subject changes', async () => {
  const view = await mount(); await compose();
  let finish!: (value: unknown) => void;
  rpc.mockImplementation(async (_owner, method) => method === 'support_submit' ? new Promise(resolve => { finish = resolve; }) : []);
  await fireEvent.press(screen.getByTestId('support-send'));
  mockOwner = 'B'; await act(async () => view.rerender(<SupportSection category="general" />));
  await act(async () => finish({ id: 'old-owner' }));
  expect(screen.getByTestId('support-message').props.value).toBe('');
  expect(screen.queryByText('Sent. You can check for a reply here.')).toBeNull();
  expect(await AsyncStorage.getItem('bola.support.draft.v1:A:general')).toContain('synthetic issue');
});
