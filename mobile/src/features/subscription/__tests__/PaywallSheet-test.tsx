import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ServiceProvider } from '../../../services/ServiceContext';
import { createTestServices } from '../../../services/createTestServices';
import { FeatureConfigProvider } from '../../../app/FeatureConfigProvider';
import { PaywallSheet } from '../PaywallSheet';
import { SubscriptionProvider, useSubscription } from '../SubscriptionProvider';
import { Pressable, Text } from 'react-native';

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'guest',
    userId: null,
  }),
}));

function OpenButton() {
  const sub = useSubscription();
  return (
    <Pressable testID="open-paywall" onPress={() => sub.openPaywall()}>
      <Text>open</Text>
    </Pressable>
  );
}

function wrap(ui: React.ReactElement, services = createTestServices({ flags: { paywallEnabled: true } })) {
  return (
    <ServiceProvider services={services}>
      <FeatureConfigProvider>
        <SubscriptionProvider>{ui}</SubscriptionProvider>
      </FeatureConfigProvider>
    </ServiceProvider>
  );
}

describe('PaywallSheet', () => {
  it('renders subscribe restore manage and purchases', async () => {
    const services = createTestServices({ flags: { paywallEnabled: true } });
    await act(async () => {
      render(wrap(<OpenButton />, services));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('open-paywall'));
    });
    await waitFor(() => expect(screen.getByTestId('paywall-sheet')).toBeTruthy());
    expect(screen.getByTestId('paywall-subscribe')).toBeTruthy();
    expect(screen.getByTestId('paywall-restore')).toBeTruthy();
    expect(screen.getByTestId('paywall-manage')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('paywall-subscribe'));
    });
    await waitFor(() => {
      expect(services.purchases.hasSubscription()).toBe(true);
    });
  });

  it('shows restore empty message and calls manage', async () => {
    const services = createTestServices({ flags: { paywallEnabled: true } });
    const manageSpy = jest.spyOn(services.purchases, 'manage');
    await act(async () => {
      render(wrap(<OpenButton />, services));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('open-paywall'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('paywall-restore'));
    });
    await waitFor(() => expect(screen.getByTestId('paywall-message')).toBeTruthy());
    fireEvent.press(screen.getByTestId('paywall-manage'));
    expect(manageSpy).toHaveBeenCalled();
  });

  it('renders directly when visible and flag on', async () => {
    await act(async () => {
      render(
        wrap(
          <PaywallSheet visible onClose={() => undefined} />,
        ),
      );
    });
    await waitFor(() => expect(screen.getByTestId('paywall-sheet')).toBeTruthy());
    fireEvent.press(screen.getByTestId('paywall-close'));
  });

  it('returns null when paywall disabled', async () => {
    const services = createTestServices({ flags: { paywallEnabled: false } });
    await act(async () => {
      render(
        wrap(
          <PaywallSheet visible onClose={() => undefined} />,
          services,
        ),
      );
    });
    expect(screen.queryByTestId('paywall-sheet')).toBeNull();
  });
});
