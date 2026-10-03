import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../supabase';
import * as Network from 'expo-network';
import { createProductionServices } from '../productionServices';

describe('createProductionServices network', () => {
  test('expo-network listener flips isOffline and notifies subscribers', () => {
    const services = createProductionServices();
    const events: boolean[] = [];
    services.network.subscribe((offline) => {
      events.push(offline);
    });

    const addMock = Network.addNetworkStateListener as jest.Mock;
    expect(addMock).toHaveBeenCalled();
    const listener = addMock.mock.calls[addMock.mock.calls.length - 1][0] as (state: {
      isConnected?: boolean;
      isInternetReachable?: boolean;
    }) => void;

    listener({ isConnected: false, isInternetReachable: false });
    expect(services.network.isOffline()).toBe(true);
    expect(events[events.length - 1]).toBe(true);

    listener({ isConnected: true, isInternetReachable: true });
    expect(services.network.isOffline()).toBe(false);
    expect(events[events.length - 1]).toBe(false);
  });
});

test('production optional services reject a raw JWT for a different known owner', async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'owner-A');
  (getSupabase as jest.Mock).mockReturnValue({ auth: { getSession: async () => ({ data: { session: { user: { id: 'owner-B' }, access_token: 'jwt' } }, error: null }) } });
  expect(await createProductionServices().auth.getSessionUserId()).toBeNull();
});
