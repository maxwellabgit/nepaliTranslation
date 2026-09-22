import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RewardedAdButton } from '../RewardedAdButton';
import { ServiceProvider } from '../../../services/ServiceContext';
import { createTestServices } from '../../../services/createTestServices';
import { REWARDED_CTA_LABEL } from '../adConfig';

const authState = {
  status: 'signed-in' as 'signed-in' | 'guest',
  userId: 'user-1' as string | null,
};

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    status: authState.status,
    userId: authState.userId,
  }),
}));

jest.mock('../../entitlements/EntitlementProvider', () => ({
  useEntitlement: () => ({
    earnedAdFreeUntilMs: null,
    trustedNow: () => 1_000,
    refresh: jest.fn(async () => undefined),
  }),
}));

jest.mock('../../../app/FeatureConfigProvider', () => ({
  useFeatureFlags: () => ({
    networkAdsEnabled: true,
    rewardedAdsEnabled: true,
    contributionTextEnabled: false,
    contributionSpeechEnabled: false,
    contributionPhotosEnabled: false,
    rewardsEnabled: true,
    paywallEnabled: false,
    learnEnabled: true,
  }),
}));

jest.mock('../rewardedSession', () => ({
  requestRewardedSession: jest.fn(async () => ({
    ok: true,
    session: { sessionToken: 'sess-1', expiresAtMs: Date.now() + 60_000 },
  })),
}));

jest.mock('../provisionalGrant', () => ({
  ...jest.requireActual('../provisionalGrant'),
  loadProvisionalGrant: jest.fn(async () => null),
  saveProvisionalGrant: jest.fn(async () => undefined),
}));

describe('RewardedAdButton', () => {
  beforeEach(() => {
    authState.status = 'signed-in';
    authState.userId = 'user-1';
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('hidden for guests', async () => {
    authState.status = 'guest';
    authState.userId = null;
    await act(async () => {
      render(
        <ServiceProvider services={createTestServices()}>
          <RewardedAdButton />
        </ServiceProvider>,
      );
    });
    expect(screen.queryByTestId('rewarded-ad-cta')).toBeNull();
  });

  test('shows CTA for signed-in user with rewarded flag', async () => {
    await act(async () => {
      render(
        <ServiceProvider
          services={createTestServices({ canRequestAds: true, offline: false })}
        >
          <RewardedAdButton offline={false} />
        </ServiceProvider>,
      );
    });
    expect(screen.getByTestId('rewarded-ad-cta')).toBeTruthy();
    expect(screen.getByText(REWARDED_CTA_LABEL)).toBeTruthy();
  });

  test('alerts when user id missing', async () => {
    authState.status = 'signed-in';
    authState.userId = null;
    await act(async () => {
      render(
        <ServiceProvider
          services={createTestServices({ canRequestAds: true, offline: false })}
        >
          <RewardedAdButton offline={false} />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('rewarded-ad-cta'));
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Sign in required',
      expect.any(String),
    );
  });

  test('runs rewarded flow when pressed', async () => {
    const services = createTestServices({
      canRequestAds: true,
      offline: false,
      flags: { rewardedAdsEnabled: true, networkAdsEnabled: true },
    });
    await act(async () => {
      render(
        <ServiceProvider services={services}>
          <RewardedAdButton offline={false} />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('rewarded-ad-cta'));
    });
    await waitFor(() => {
      expect(services.ads.networkCalls().length).toBeGreaterThan(0);
    });
  });

  test('does not provisional-grant when reward was not earned', async () => {
    const { saveProvisionalGrant } = jest.requireMock('../provisionalGrant') as {
      saveProvisionalGrant: jest.Mock;
    };
    saveProvisionalGrant.mockClear();
    const services = createTestServices({
      canRequestAds: true,
      offline: false,
      flags: { rewardedAdsEnabled: true, networkAdsEnabled: true },
    });
    services.ads.adapter.showRewarded = jest.fn(async () => ({ earned: false }));
    await act(async () => {
      render(
        <ServiceProvider services={services}>
          <RewardedAdButton offline={false} />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('rewarded-ad-cta'));
    });
    await waitFor(() => {
      expect(services.ads.adapter.showRewarded).toHaveBeenCalled();
    });
    expect(saveProvisionalGrant).not.toHaveBeenCalled();
  });
});
