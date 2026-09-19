/**
 * Bundled defaults for optional online services.
 * Remote config may override later; core translate never depends on these.
 */
export type FeatureFlags = {
  contributionsEnabled: boolean;
  rewardsEnabled: boolean;
  networkAdsEnabled: boolean;
  rewardedAdsEnabled: boolean;
  paywallEnabled: boolean;
  learnEnabled: boolean;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  contributionsEnabled: false,
  rewardsEnabled: false,
  networkAdsEnabled: false,
  rewardedAdsEnabled: false,
  paywallEnabled: false,
  learnEnabled: false,
};
