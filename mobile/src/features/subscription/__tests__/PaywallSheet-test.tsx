import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ServiceProvider } from '../../../services/ServiceContext';
import { createTestServices } from '../../../services/createTestServices';
import { FeatureConfigProvider } from '../../../app/FeatureConfigProvider';
import { PaywallSheet } from '../PaywallSheet';
import { SubscriptionProvider, useSubscription } from '../SubscriptionProvider';
import { Pressable, Text } from 'react-native';
const mockEnsureGuestIdentity = jest.fn(async () => true);

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    // G3: openPaywall requires a signed-in user so RevenueCat identity is
    // bound to a Supabase UUID before any purchase/restore.
    status: 'signed-in',
    userId: '11111111-1111-4111-8111-111111111111',
    ensureGuestIdentity: mockEnsureGuestIdentity,
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

function wrap(ui: React.ReactElement, services = createTestServices({ sessionUserId: '11111111-1111-4111-8111-111111111111', flags: { paywallEnabled: true } })) {
  return (
    <ServiceProvider services={services}>
      <FeatureConfigProvider>
        <SubscriptionProvider>{ui}</SubscriptionProvider>
      </FeatureConfigProvider>
    </ServiceProvider>
  );
}

describe('PaywallSheet', () => {
  beforeEach(() => { mockEnsureGuestIdentity.mockClear(); mockEnsureGuestIdentity.mockResolvedValue(true); });
  it('identity changing during binding prevents purchase and restore under the stale UUID', async () => {
    const services = createTestServices({ sessionUserId: 'guest-A', flags: { paywallEnabled: true } });
    let owner = 'guest-A';
    services.auth.getSessionUserId = async () => owner;
    jest.spyOn(services.purchases, 'identify').mockImplementation(async () => {
      owner = 'guest-B';
      return true;
    });
    const purchase = jest.spyOn(services.purchases, 'purchase');
    const restore = jest.spyOn(services.purchases, 'restore');
    await render(wrap(<OpenButton />, services));
    owner = 'guest-A';
    await fireEvent.press(screen.getByTestId('open-paywall'));
    await fireEvent.press(screen.getByTestId('paywall-subscribe'));
    await waitFor(() => expect(screen.getByTestId('paywall-message')).toBeTruthy());
    owner = 'guest-A';
    await fireEvent.press(screen.getByTestId('paywall-restore'));
    expect(purchase).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });
  it('missing private identity fails soft without attempting StoreKit purchase or restore', async () => {
    mockEnsureGuestIdentity.mockResolvedValue(false);
    const services = createTestServices({ sessionUserId: null, flags: { paywallEnabled: true } });
    const purchase = jest.spyOn(services.purchases, 'purchase');
    const restore = jest.spyOn(services.purchases, 'restore');
    await render(wrap(<OpenButton />, services));
    await fireEvent.press(screen.getByTestId('open-paywall'));
    await fireEvent.press(screen.getByTestId('paywall-subscribe'));
    await waitFor(() => expect(screen.getByTestId('paywall-message')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('paywall-restore'));
    expect(purchase).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
    expect(mockEnsureGuestIdentity).toHaveBeenCalledTimes(2);
  });
  it('renders subscribe restore manage and purchases', async () => {
    const services = createTestServices({ sessionUserId: '11111111-1111-4111-8111-111111111111', flags: { paywallEnabled: true } });
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
    const services = createTestServices({ sessionUserId: '11111111-1111-4111-8111-111111111111', flags: { paywallEnabled: true } });
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
    const services = createTestServices({ sessionUserId: '11111111-1111-4111-8111-111111111111', flags: { paywallEnabled: false } });
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
