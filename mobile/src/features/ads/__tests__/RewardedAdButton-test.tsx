import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RewardedAdButton } from '../RewardedAdButton';
import { ServiceProvider } from '../../../services/ServiceContext';
import { createTestServices } from '../../../services/createTestServices';
import { REWARDED_CTA_LABEL } from '../adConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { grantDailyOpenCoin, readDailyOpen } from '../../contribution/dailyOpen';
import { subscribeAdCreditAwards } from '../adCreditEvents';
import { requestRewardedSession } from '../rewardedSession';
import { loadProvisionalGrant, saveProvisionalGrant, createProvisionalGrant } from '../provisionalGrant';

const authState = {
  status: 'signed-in' as 'signed-in' | 'guest',
  userId: 'user-1' as string | null,
};
const mockEnsureGuestIdentity = jest.fn(async () => Boolean(authState.userId));
const mockAdFlags = { networkAdsEnabled: true, rewardedAdsEnabled: true };
const mockRefreshFlags = jest.fn(async () => undefined);

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    status: authState.status,
    userId: authState.userId,
    ensureGuestIdentity: mockEnsureGuestIdentity,
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
    ...mockAdFlags,
    contributionTextEnabled: false,
    contributionSpeechEnabled: false,
    contributionPhotosEnabled: false,
    rewardsEnabled: true,
    paywallEnabled: false,
    learnEnabled: true,
  }),
  useRefreshFeatureFlags: () => mockRefreshFlags,
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
  async function pressWithOutcome(outcome: { earned: boolean; impression?: boolean }) {
    const services = createTestServices({ sessionUserId: 'user-1', canRequestAds: true, offline: false });
    services.ads.adapter.showRewarded = jest.fn(async () => outcome);
    await render(<ServiceProvider services={services}><RewardedAdButton offline={false} /></ServiceProvider>);
    await fireEvent.press(screen.getByTestId('rewarded-ad-cta'));
    return services;
  }

  test('displayed skip durably adds one credit and emits one coin without a provisional grant', async () => {
    await AsyncStorage.clear();
    await grantDailyOpenCoin();
    const before = (await readDailyOpen())!.untilMs;
    const award = jest.fn();
    const unsubscribe = subscribeAdCreditAwards(award);
    (saveProvisionalGrant as jest.Mock).mockClear();
    await pressWithOutcome({ earned: false, impression: true });
    await waitFor(() => expect(award).toHaveBeenCalledTimes(1));
    expect(award).toHaveBeenCalledWith(expect.objectContaining({ credits: 1, coinCount: 1, automaticFlight: true }));
    expect((await readDailyOpen())!.untilMs).toBe(before + 600_000);
    expect(saveProvisionalGrant).not.toHaveBeenCalled();
    unsubscribe();
  });

  test('an unresolved previous full reward rejects a second provisional and emits no coins', async () => {
    (loadProvisionalGrant as jest.Mock).mockResolvedValueOnce(createProvisionalGrant('pending', Date.now()));
    (saveProvisionalGrant as jest.Mock).mockClear();
    const award = jest.fn();
    const unsubscribe = subscribeAdCreditAwards(award);
    await pressWithOutcome({ earned: true });
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Reward pending', expect.any(String)));
    expect(saveProvisionalGrant).not.toHaveBeenCalled();
    expect(award).not.toHaveBeenCalled();
    unsubscribe();
  });

  test('failed session mint never loads an ad or saves a reward', async () => {
    (saveProvisionalGrant as jest.Mock).mockClear();
    (requestRewardedSession as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'unauthorized' });
    const services = await pressWithOutcome({ earned: true });
    expect(Alert.alert).toHaveBeenCalledWith('Ad unavailable', 'Could not start a rewarded session.');
    expect(services.ads.adapter.showRewarded).not.toHaveBeenCalled();
    expect(saveProvisionalGrant).not.toHaveBeenCalled();
  });

  test('storage failure reports unavailable and does not publish reward animation', async () => {
    (saveProvisionalGrant as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    const award = jest.fn();
    const unsubscribe = subscribeAdCreditAwards(award);
    await pressWithOutcome({ earned: true });
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Ad unavailable', expect.stringContaining('could not be verified')));
    expect(award).not.toHaveBeenCalled();
    unsubscribe();
  });
  beforeEach(() => {
    mockAdFlags.networkAdsEnabled = true;
    mockAdFlags.rewardedAdsEnabled = true;
    mockRefreshFlags.mockClear();
    authState.status = 'signed-in';
    authState.userId = 'user-1';
    mockEnsureGuestIdentity.mockImplementation(async () => Boolean(authState.userId));
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  test('unavailable private identity never loads ads and asks for connection, not login', async () => {
    mockEnsureGuestIdentity.mockResolvedValueOnce(false);
    const services = await pressWithOutcome({ earned: true });
    expect(mockEnsureGuestIdentity).toHaveBeenCalled();
    expect(services.ads.adapter.showRewarded).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Optional services unavailable', expect.stringContaining('when online'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('local guest sees optional rewards CTA without a login entry', async () => {
    authState.status = 'guest';
    authState.userId = null;
    await act(async () => {
      render(
        <ServiceProvider services={createTestServices()}>
          <RewardedAdButton />
        </ServiceProvider>,
      );
    });
    expect(screen.getByTestId('rewarded-ad-cta')).toBeTruthy();
  });

  test('shows CTA for signed-in user with rewarded flag', async () => {
    await act(async () => {
      render(
        <ServiceProvider
          services={createTestServices({ sessionUserId: 'user-1', canRequestAds: true, offline: false })}
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
          services={createTestServices({ sessionUserId: 'user-1', canRequestAds: true, offline: false })}
        >
          <RewardedAdButton offline={false} />
        </ServiceProvider>,
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('rewarded-ad-cta'));
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Optional services unavailable',
      expect.any(String),
    );
  });

  test('runs rewarded flow when pressed', async () => {
    (saveProvisionalGrant as jest.Mock).mockClear();
    const services = createTestServices({ sessionUserId: 'user-1',
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
    expect(mockEnsureGuestIdentity).toHaveBeenCalled();
    expect(saveProvisionalGrant).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', sessionToken: 'sess-1', verified: false,
    }));
  });

  test.each(['rewardedAdsEnabled', 'networkAdsEnabled'] as const)('keeps credits action visible but never loads ads when %s is off', async (flag) => {
    mockAdFlags[flag] = false;
    const services = await pressWithOutcome({ earned: true });
    expect(screen.getByText(REWARDED_CTA_LABEL)).toBeTruthy();
    expect(screen.getByTestId('rewarded-ad-cta')).toBeDisabled();
    expect(screen.getByText('Optional ads are unavailable right now.')).toBeTruthy();
    expect(services.ads.adapter.showRewarded).not.toHaveBeenCalled();
    expect(mockRefreshFlags).toHaveBeenCalledTimes(1);
  });

  test('offline and subscribed states explain why the visible reward cannot be watched', async () => {
    const services = createTestServices({ offline: true });
    await render(<ServiceProvider services={services}><RewardedAdButton /></ServiceProvider>);
    expect(screen.getByText('Connect to the internet to watch an optional ad.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('rewarded-ad-cta'));
    expect(services.ads.networkCalls()).toEqual([]);
    await render(<ServiceProvider services={services}><RewardedAdButton hasSubscription /></ServiceProvider>);
    expect(screen.getByText('Your ad-free subscription is active.')).toBeTruthy();
  });

  test('explicit request retries UMP after startup failure, without loading if consent remains blocked', async () => {
    const services = createTestServices({ sessionUserId: 'user-1', canRequestAds: false, offline: false });
    services.ads.prepareConsentAndSdk = jest.fn(services.ads.prepareConsentAndSdk);
    await render(<ServiceProvider services={services}><RewardedAdButton /></ServiceProvider>);
    await fireEvent.press(screen.getByTestId('rewarded-ad-cta'));
    expect(services.ads.prepareConsentAndSdk).toHaveBeenCalledTimes(1);
    expect(services.ads.networkCalls()).toEqual([]);
  });

  test.each(['ump', 'session', 'load'] as const)('current eligibility is checked after deferred %s before presenting an ad', async (stage) => {
    let release!: () => void;
    let entered!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const services = createTestServices({ sessionUserId: 'user-1', offline: false, canRequestAds: stage !== 'ump' });
    if (stage === 'ump') services.ads.prepareConsentAndSdk = jest.fn(async () => {
      entered(); await pending;
      services.setConsent({ canRequestAds: true, privacyOptionsRequired: false });
      return services.ads.getConsentState();
    });
    if (stage === 'session') (requestRewardedSession as jest.Mock).mockImplementationOnce(async () => {
      entered(); await pending;
      return { ok: true, session: { sessionToken: 'deferred', expiresAtMs: Date.now() + 60_000 } };
    });
    if (stage === 'load') services.ads.adapter.loadRewarded = jest.fn(async () => { entered(); await pending; });
    services.ads.adapter.showRewarded = jest.fn(async () => ({ earned: true }));
    const view = (hasSubscription = false) => <ServiceProvider services={services}><RewardedAdButton hasSubscription={hasSubscription} /></ServiceProvider>;
    const rendered = await render(view());
    const press = fireEvent.press(screen.getByTestId('rewarded-ad-cta'));
    await started;
    if (stage === 'ump') mockAdFlags.rewardedAdsEnabled = false;
    if (stage === 'session') services.setOffline(true);
    await rendered.rerender(view(stage === 'load'));
    await act(async () => { release(); await press; });
    expect(services.ads.adapter.showRewarded).not.toHaveBeenCalled();
    if (stage !== 'load') expect(services.ads.networkCalls()).toEqual([]);
  });

  test('owner replacement during session mint cannot load or reward the new identity', async () => {
    const services = createTestServices({ sessionUserId: 'user-1', canRequestAds: true, offline: false });
    let owner = 'user-1';
    services.auth.getSessionUserId = jest.fn(async () => owner);
    (requestRewardedSession as jest.Mock).mockImplementationOnce(async () => {
      owner = 'user-2';
      return { ok: true, session: { sessionToken: 'old-owner', expiresAtMs: Date.now() + 60_000 } };
    });
    await render(<ServiceProvider services={services}><RewardedAdButton /></ServiceProvider>);
    await fireEvent.press(screen.getByTestId('rewarded-ad-cta'));
    expect(services.ads.networkCalls()).toEqual([]);
  });

  test('does not provisional-grant when reward was not earned', async () => {
    const { saveProvisionalGrant } = jest.requireMock('../provisionalGrant') as {
      saveProvisionalGrant: jest.Mock;
    };
    saveProvisionalGrant.mockClear();
    const services = createTestServices({ sessionUserId: 'user-1',
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
