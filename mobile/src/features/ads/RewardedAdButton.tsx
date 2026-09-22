import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { AppButton } from '../../components/AppPrimitives';
import { t, useUiLang } from '../../i18n';
import { useAuth } from '../auth/AuthProvider';
import { useEntitlement } from '../entitlements/EntitlementProvider';
import { useSubscriptionOptional } from '../subscription/SubscriptionProvider';
import { useFeatureFlags } from '../../app/FeatureConfigProvider';
import { useServices } from '../../services/ServiceContext';
import { resolveAdUnitConfig } from './adConfig';
import { executeAdPlan, planAdPlacement } from './adMiddleware';
import {
  acceptProvisionalGrant,
  createProvisionalGrant,
  loadProvisionalGrant,
  saveProvisionalGrant,
  supportMessageForExpiredProvisional,
} from './provisionalGrant';
import { requestRewardedSession } from './rewardedSession';

type Props = {
  offline?: boolean;
  hasSubscription?: boolean;
};

/**
 * Signed-in optional rewarded CTA. Never auto-loads.
 * Client callback → provisional grant; permanent grant only via verified SSV.
 */
export function RewardedAdButton({
  offline: offlineProp,
  hasSubscription = false,
}: Props) {
  const auth = useAuth();
  const entitlement = useEntitlement();
  const subscription = useSubscriptionOptional();
  const flags = useFeatureFlags();
  const services = useServices();
  const lang = useUiLang();
  const [busy, setBusy] = useState(false);
  const cta = t('ads.rewardedCta', lang);

  const offline = offlineProp ?? services.network.isOffline();
  const subscribed =
    hasSubscription || Boolean(subscription?.hasSubscription());

  const onPress = useCallback(async () => {
    if (busy) return;
    if (auth.status !== 'signed-in' || !auth.userId) {
      Alert.alert(
        t('ads.signInRequiredTitle', lang),
        t('ads.signInRequiredBody', lang),
      );
      return;
    }
    setBusy(true);
    try {
      const units = resolveAdUnitConfig();
      const consent = services.ads.getConsentState();
      const plan = planAdPlacement({
        surface: 'contribution_result',
        networkAdsEnabled: flags.networkAdsEnabled,
        rewardedAdsEnabled: flags.rewardedAdsEnabled,
        hasSubscription: subscribed,
        earnedAdFreeUntilMs: entitlement.earnedAdFreeUntilMs,
        trustedNowMs: entitlement.trustedNow(),
        offline,
        canRequestAds: consent.canRequestAds,
        explicitRewardedRequest: true,
        bannerUnitId: units.bannerUnitId,
        rewardedUnitId: units.rewardedUnitId,
        nowMs: Date.now(),
      });
      if (plan.action !== 'rewarded') {
        Alert.alert('Ad unavailable', 'Optional ads are not available right now.');
        return;
      }

      const session = await requestRewardedSession();
      if (!session.ok) {
        Alert.alert('Ad unavailable', 'Could not start a rewarded session.');
        return;
      }

      await executeAdPlan(plan, services.ads.adapter, {
        userId: auth.userId,
        customData: session.session.sessionToken,
      }).then(async (result) => {
        // Provisional only after client EARNED_REWARD — never from show() alone.
        if (result.executed !== 'rewarded') {
          return;
        }
        const now = Date.now();
        const current = await loadProvisionalGrant();
        const next = createProvisionalGrant(session.session.sessionToken, now);
        const accepted = acceptProvisionalGrant(current, next, now);
        if (!accepted.ok) {
          Alert.alert(
            'Reward pending',
            'A previous optional ad reward is still verifying.',
          );
          return;
        }
        await saveProvisionalGrant(accepted.grant);
        await entitlement.refresh();
      });
    } catch {
      Alert.alert('Ad unavailable', supportMessageForExpiredProvisional());
    } finally {
      setBusy(false);
    }
  }, [
    auth.status,
    auth.userId,
    busy,
    entitlement,
    flags.networkAdsEnabled,
    flags.rewardedAdsEnabled,
    subscribed,
    lang,
    offline,
    services.ads,
  ]);

  if (auth.status !== 'signed-in') return null;
  if (!flags.rewardedAdsEnabled) return null;
  if (subscribed) return null;

  return (
    <AppButton
      label={cta}
      variant="secondary"
      onPress={() => void onPress()}
      disabled={busy || offline}
      accessibilityLabel={cta}
      testID="rewarded-ad-cta"
      style={styles.btn}
    />
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 8 },
});
