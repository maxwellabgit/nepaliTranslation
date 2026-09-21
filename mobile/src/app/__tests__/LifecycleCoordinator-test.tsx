import { act, render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { AppProviders } from '../AppProviders';
import { createTestServices } from '../../services/createTestServices';

describe('LifecycleCoordinator outbox flush', () => {
  test('offline → online triggers contribution.flushOutbox', async () => {
    const flushOutbox = jest.fn(async () => ({
      ok: true as const,
      synced: 0,
      failed: 0,
      rejected: 0,
    }));
    const services = createTestServices({ offline: true });
    services.contribution.flushOutbox = flushOutbox;

    await act(async () => {
      render(
        <AppProviders services={services}>
          <View>
            <Text>child</Text>
          </View>
        </AppProviders>,
      );
    });

    // Cold launch also flushes once via LifecycleCoordinator.
    expect(flushOutbox).toHaveBeenCalled();
    flushOutbox.mockClear();

    await act(async () => {
      services.setOffline(false);
    });

    expect(flushOutbox).toHaveBeenCalled();
  });
});
