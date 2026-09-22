/**
 * Bundled defaults for optional online services.
 * Remote config may override later; core translate never depends on these.
 */
export type FeatureFlags = {
  contributionTextEnabled: boolean;
  contributionSpeechEnabled: boolean;
  contributionPhotosEnabled: boolean;
  rewardsEnabled: boolean;
  networkAdsEnabled: boolean;
  rewardedAdsEnabled: boolean;
  automaticInterstitialEnabled: boolean;
  paywallEnabled: boolean;
  learnEnabled: boolean;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  contributionTextEnabled: false,
  contributionSpeechEnabled: false,
  contributionPhotosEnabled: false,
  rewardsEnabled: false,
  networkAdsEnabled: false,
  rewardedAdsEnabled: false,
  automaticInterstitialEnabled: false,
  paywallEnabled: false,
  learnEnabled: false,
};

/** Module cache for non-React callers (contributionApi). Provider keeps this in sync. */
let runtimeFeatureFlags: FeatureFlags = {
  ...DEFAULT_FEATURE_FLAGS,
  learnEnabled: true,
};

export function setRuntimeFeatureFlags(flags: FeatureFlags): void {
  runtimeFeatureFlags = { ...flags, learnEnabled: true };
}

export function getRuntimeFeatureFlags(): FeatureFlags {
  return runtimeFeatureFlags;
}
