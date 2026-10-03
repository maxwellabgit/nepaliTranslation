import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '../AuthProvider';
import { getSupabase } from '../../../services/supabase';
function Probe() { const auth = useAuth(); return <Text testID="status">{auth.status}</Text>; }
test('optional services absent never block local app rendering', async () => {
  (getSupabase as jest.Mock).mockReturnValue(null);
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  expect(screen.getByTestId('status').props.children).toBe('guest');
});
test('a missing provider offers safe local-only methods', async () => {
  await act(async () => { render(<Probe />); });
  expect(screen.getByTestId('status').props.children).toBe('guest');
});
