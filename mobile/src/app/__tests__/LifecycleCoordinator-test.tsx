import { act, render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { AppProviders } from '../AppProviders';
import { createTestServices } from '../../services/createTestServices';

describe('LifecycleCoordinator outbox flush', () => {
  test('offline → online triggers text and media outbox flush', async () => {
    const flushOutbox = jest.fn(async () => ({
      ok: true as const,
      synced: 0,
      failed: 0,
      rejected: 0,
    }));
    const flushMediaOutbox = jest.fn(async () => ({
      ok: true as const,
      synced: 0,
      failed: 0,
      rejected: 0,
    }));
    const services = createTestServices({ offline: true });
    services.contribution.flushOutbox = flushOutbox;
    services.contribution.flushMediaOutbox = flushMediaOutbox;

    await act(async () => {
      render(
        <AppProviders services={services} bypassStartupConsent>
          <View>
            <Text>child</Text>
          </View>
        </AppProviders>,
      );
    });

    // Cold launch also flushes once via LifecycleCoordinator.
    expect(flushOutbox).toHaveBeenCalled();
    expect(flushMediaOutbox).toHaveBeenCalled();
    flushOutbox.mockClear();
    flushMediaOutbox.mockClear();

    await act(async () => {
      services.setOffline(false);
    });

    expect(flushOutbox).toHaveBeenCalled();
    expect(flushMediaOutbox).toHaveBeenCalled();
  });
});
