import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppPrimitives';
import { t, useUiLang } from '../../i18n';
import { useAuth } from '../auth/AuthProvider';
import { useEntitlement } from '../entitlements/EntitlementProvider';
import { useSubscriptionOptional } from '../subscription/SubscriptionProvider';
import { useFeatureFlags, useRefreshFeatureFlags } from '../../app/FeatureConfigProvider';
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
import { awardDismissedAd, publishAdCreditAward } from './adCreditEvents';
import { laterActiveUntil, readDailyOpen } from '../contribution/dailyOpen';
import { presentCreditClaim } from '../../translate/CreditAwardProvider';

type Props = {
  offline?: boolean;
  hasSubscription?: boolean;
};

/**
 * Optional rewarded CTA using the private guest identity. Never auto-loads an ad.
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
  const refreshFlags = useRefreshFeatureFlags();
  const services = useServices();
  const lang = useUiLang();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const cta = t('ads.rewardedCta', lang);

  const offline = offlineProp ?? services.network.isOffline();
  const subscribed =
    hasSubscription || Boolean(subscription?.hasSubscription());
  const unavailable = subscribed ? 'ads.rewardedSubscribed' : offline ? 'ads.rewardedOffline'
    : !flags.networkAdsEnabled || !flags.rewardedAdsEnabled ? 'ads.rewardedUnavailable' : null;
  const current = useRef({ flags, subscribed, offline });
  current.current = { flags, subscribed, offline };
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void refreshFlags();
    return () => { mounted.current = false; };
  }, [refreshFlags]);

  const onPress = useCallback(async () => {
    if (busyRef.current || unavailable) return;
    busyRef.current = true;
    setBusy(true);
    const eligible = () => mounted.current && current.current.flags.networkAdsEnabled &&
      current.current.flags.rewardedAdsEnabled && !current.current.subscribed &&
      !current.current.offline && !services.network.isOffline();
    try {
      const identityReady = auth.ensureGuestIdentity
        ? await auth.ensureGuestIdentity()
        : auth.status === 'signed-in' && Boolean(auth.userId);
      const userId = identityReady ? await services.auth.getSessionUserId() : null;
      if (!userId) {
        Alert.alert(t('ads.signInRequiredTitle', lang), t('ads.signInRequiredBody', lang));
        return;
      }
      if (!eligible()) return;
      const units = resolveAdUnitConfig();
      const consent = services.ads.getConsentState().canRequestAds
        ? services.ads.getConsentState()
        : await services.ads.prepareConsentAndSdk();
      if (!eligible()) return;
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
      const canPresent = async () => {
        if (!eligible()) return false;
        const owner = await services.auth.getSessionUserId();
        return eligible() && services.ads.getConsentState().canRequestAds && owner === userId;
      };

      await executeAdPlan(plan, services.ads.adapter, {
        userId,
        customData: session.session.sessionToken,
      }, canPresent).then(async (result) => {
        if (await services.auth.getSessionUserId() !== userId) return;
        // Provisional only after client EARNED_REWARD — never from show() alone.
        if (result.executed !== 'rewarded') {
          if (result.executed === 'rewarded_skipped') await awardDismissedAd(1, entitlement.durableAdFreeUntilMs ?? null);
          return;
        }
        const now = Date.now();
        const daily = await readDailyOpen();
        const beforeUntil = laterActiveUntil(entitlement.earnedAdFreeUntilMs, daily?.untilMs, now);
        const current = await loadProvisionalGrant();
        const next = createProvisionalGrant(session.session.sessionToken, now);
        const presentation = presentCreditClaim({ nowMs: now, earnedUntilMs: beforeUntil,
          credits: 2, minutesApplied: 20, capped: false });
        next.userId = userId;
        next.durableUntilMs = entitlement.durableAdFreeUntilMs ?? null;
        next.untilMs = now + presentation.toRemainingMs;
        const accepted = acceptProvisionalGrant(current, next, now);
        if (!accepted.ok) {
          Alert.alert(
            'Reward pending',
            'A previous optional ad reward is still verifying.',
          );
          return;
        }
        await saveProvisionalGrant(accepted.grant);
        publishAdCreditAward(presentation);
        await entitlement.refresh();
      });
    } catch {
      Alert.alert('Ad unavailable', supportMessageForExpiredProvisional());
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [
    auth,
    entitlement,
    flags.networkAdsEnabled,
    flags.rewardedAdsEnabled,
    subscribed,
    lang,
    offline,
    services,
    unavailable,
  ]);

  return (
    <View>
    <AppButton
      label={cta}
      variant="secondary"
      onPress={() => void onPress()}
      disabled={busy || unavailable != null}
      accessibilityLabel={cta}
      testID="rewarded-ad-cta"
      style={styles.btn}
    />
    {unavailable && <Text testID="rewarded-ad-unavailable" style={styles.notice}>{t(unavailable, lang)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 8 },
  notice: { marginTop: 8, fontSize: 14, color: '#3A3328' },
});
