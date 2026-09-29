import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useFeatureFlags } from '../app/FeatureConfigProvider';
import { useEntitlementOptional } from '../features/entitlements/EntitlementProvider';
import { useAdConsent } from '../features/ads/useAdConsent';
import { subscribeForegroundActiveMs } from '../features/ads/InterstitialController';
import {
  formatInterstitialCountdown,
  interstitialAdsSuppressed,
  interstitialGauge,
} from '../features/ads/interstitialGauge';
import {
  gaugePresentation,
  remainingMsUntil,
} from '../features/contribution/reviewCredits';
import { useSubscriptionOptional } from '../features/subscription/SubscriptionProvider';
import { useServices } from '../services/ServiceContext';
import { useTheme } from '../theme';
import { t, useUiLang } from '../i18n';
import { useCreditAwardOptional } from './CreditAwardProvider';

type Props = {
  onPress?: () => void;
  /** Fits in the header between the app icon and Settings. */
  compact?: boolean;
  /**
   * Draws a fixed remaining balance. Used by unit tests and the screenshot
   * harness. Live entitlement is ignored while this is set.
   */
  previewRemainingMs?: number;
};

const FILL = '#C4922A';
const FILL_DARK = '#F0C14A';
const OVER = '#D64545';

export function CreditsGauge({ onPress, compact = false, previewRemainingMs }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const flags = useFeatureFlags();
  const services = useServices();
  const consent = useAdConsent(services.ads);
  const entitlement = useEntitlementOptional();
  const subscription = useSubscriptionOptional();
  const award = useCreditAwardOptional();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [foregroundMs, setForegroundMs] = useState(0);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const timer = setInterval(tick, 15_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, []);
  useEffect(() => subscribeForegroundActiveMs(setForegroundMs), []);
  const gauge = interstitialGauge({
    foregroundActiveMs: foregroundMs,
    suppressed: interstitialAdsSuppressed({
      automaticInterstitialEnabled: flags.automaticInterstitialEnabled,
      hasSubscription: Boolean(subscription?.hasSubscription()),
      earnedAdFreeUntilMs: entitlement?.earnedAdFreeUntilMs ?? null,
      trustedNowMs: entitlement?.trustedNow() ?? null,
      offline: services.network.isOffline(),
      canRequestAds: consent.canRequestAds,
    }),
  });
  const interstitialLabel =
    gauge.state === 'unavailable'
      ? t('ads.interstitialUnavailable', lang)
      : formatInterstitialCountdown(gauge.remainingMs);

  const liveRemaining = remainingMsUntil(entitlement?.earnedAdFreeUntilMs ?? null, nowMs);
  const remainingMs = previewRemainingMs ?? award.displayRemainingMs ?? liveRemaining;
  const face = gaugePresentation(remainingMs);
  const pumping = award.phase === 'pump' && previewRemainingMs == null;
  const scale = face.overMark ? 1.08 : pumping ? 1.06 : 1;
  const fillColor = face.overMark ? OVER : theme.scheme === 'dark' ? FILL_DARK : FILL;
  const timerColor = face.overMark ? OVER : theme.scheme === 'dark' ? '#F0C14A' : '#6B4A12';
  const coinColor = face.overMark ? OVER : theme.scheme === 'dark' ? '#F0C14A' : '#6B4A12';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flex: compact ? 1 : undefined,
          marginHorizontal: compact ? 6 : 16,
          marginTop: compact ? 0 : 4,
          paddingHorizontal: compact ? 8 : 16,
          paddingVertical: compact ? 4 : 12,
          borderRadius: compact ? 12 : 16,
          backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.scheme === 'dark' ? '#8A6A32' : '#C4922A',
          transform: [{ scale }],
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        track: {
          flex: 1,
          height: face.overMark ? (compact ? 12 : 20) : compact ? 8 : 16,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: theme.scheme === 'dark' ? '#5C4A28' : '#F3E6C4',
        },
        fill: {
          height: '100%',
          borderRadius: 5,
          backgroundColor: fillColor,
        },
        timer: {
          fontSize: face.overMark ? (compact ? 14 : 20) : compact ? 12 : 16,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
          color: timerColor,
          minWidth: compact ? 58 : 72,
          textAlign: 'right',
        },
      }),
    [compact, face.overMark, fillColor, scale, theme.scheme, timerColor],
  );

  const accessibilityLabel = face.overMark
    ? t('review.gaugeOverA11y', lang, { clock: face.clock, interstitial: interstitialLabel })
    : t('review.gaugeA11y', lang, { clock: face.clock, interstitial: interstitialLabel });

  return (
    <Pressable
      style={styles.wrap}
      testID="credits-gauge"
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.row} testID="credits-gauge-total">
        <FontAwesome5 name="coins" size={face.overMark ? 18 : 14} color={coinColor} />
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(face.fillPercent) }}
        >
          <View
            testID="credits-gauge-fill"
            style={[styles.fill, { width: `${face.fillPercent}%` }]}
          />
        </View>
        <Text style={styles.timer} testID="credits-gauge-timer">
          {face.clock}
        </Text>
      </View>
    </Pressable>
  );
}
