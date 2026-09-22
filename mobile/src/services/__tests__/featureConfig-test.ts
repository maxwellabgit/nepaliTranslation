import { DEFAULT_FEATURE_FLAGS } from '../../app/featureFlags';
import { createProductionServices } from '../productionServices';
import { getSupabase } from '../supabase';

jest.mock('../supabase');

const mockedGetSupabase = getSupabase as jest.MockedFunction<typeof getSupabase>;

describe('createProductionServices featureConfig', () => {
  beforeEach(() => {
    mockedGetSupabase.mockReset();
  });

  test('fails soft to safe defaults when Supabase is missing', async () => {
    mockedGetSupabase.mockReturnValue(null);
    const services = createProductionServices();
    const flags = await services.featureConfig.loadFlags();
    expect(flags).toEqual({ ...DEFAULT_FEATURE_FLAGS, learnEnabled: true });
    expect(flags.contributionTextEnabled).toBe(false);
    expect(flags.contributionSpeechEnabled).toBe(false);
    expect(flags.contributionPhotosEnabled).toBe(false);
  });

  test('maps split contribution flags and keeps Learn available', async () => {
    mockedGetSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                contribution_text_enabled: true,
                contribution_speech_enabled: false,
                contribution_photos_enabled: true,
                contributions_enabled: true,
                rewards_enabled: true,
                network_ads_enabled: false,
                rewarded_ads_enabled: false,
                paywall_enabled: false,
                learn_enabled: false,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    const services = createProductionServices();
    const flags = await services.featureConfig.loadFlags();
    expect(flags.contributionTextEnabled).toBe(true);
    expect(flags.contributionSpeechEnabled).toBe(false);
    expect(flags.contributionPhotosEnabled).toBe(true);
    expect(flags.rewardsEnabled).toBe(true);
    expect(flags.networkAdsEnabled).toBe(false);
    expect(flags.learnEnabled).toBe(true);
  });

  test('falls back to legacy contributions_enabled for text flag', async () => {
    mockedGetSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                contributions_enabled: true,
                rewards_enabled: false,
                network_ads_enabled: false,
                rewarded_ads_enabled: false,
                paywall_enabled: false,
                learn_enabled: false,
              },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    const services = createProductionServices();
    const flags = await services.featureConfig.loadFlags();
    expect(flags.contributionTextEnabled).toBe(true);
    expect(flags.contributionSpeechEnabled).toBe(false);
  });

  test('fails soft when remote query errors', async () => {
    mockedGetSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: { message: 'boom' },
            }),
          }),
        }),
      }),
    } as never);

    const services = createProductionServices();
    const flags = await services.featureConfig.loadFlags();
    expect(flags).toEqual({ ...DEFAULT_FEATURE_FLAGS, learnEnabled: true });
  });
});
