import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { peekDailyOpen, readDailyOpen, subscribeDailyOpen } from '../features/contribution/dailyOpen';

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

export function CreditsGauge({ onPress, compact = false, previewRemainingMs }: Props) {
  const pill = useRef<View>(null);
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
  const [dailyUntilMs, setDailyUntilMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const timer = setInterval(tick, 1_000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, []);
  useEffect(() => subscribeForegroundActiveMs(setForegroundMs), []);
  useEffect(() => {
    const apply = (record: { untilMs: number } | null) => {
      setDailyUntilMs(record && record.untilMs > Date.now() ? record.untilMs : null);
    };
    const pull = () => {
      void readDailyOpen().then(apply);
    };
    pull();
    const timer = setInterval(pull, 5_000);
    const stop = subscribeDailyOpen(() => apply(peekDailyOpen()));
    return () => {
      clearInterval(timer);
      stop();
    };
  }, []);
  const earnedUntilMs = entitlement?.earnedAdFreeUntilMs ?? null;
  const untilMs =
    dailyUntilMs != null && (earnedUntilMs == null || dailyUntilMs > earnedUntilMs)
      ? dailyUntilMs
      : earnedUntilMs;
  const gauge = interstitialGauge({
    foregroundActiveMs: foregroundMs,
    suppressed: interstitialAdsSuppressed({
      automaticInterstitialEnabled: flags.automaticInterstitialEnabled,
      hasSubscription: Boolean(subscription?.hasSubscription()),
      earnedAdFreeUntilMs: untilMs,
      trustedNowMs: dailyUntilMs != null ? nowMs : entitlement?.trustedNow() ?? null,
      offline: services.network.isOffline(),
      canRequestAds: consent.canRequestAds,
    }),
  });
  const interstitialLabel =
    gauge.state === 'unavailable'
      ? t('ads.interstitialUnavailable', lang)
      : formatInterstitialCountdown(gauge.remainingMs);

  const liveRemaining = remainingMsUntil(untilMs, nowMs);
  const remainingMs = previewRemainingMs ?? award.displayRemainingMs ?? liveRemaining;
  const face = gaugePresentation(remainingMs);
  const receiving =
    previewRemainingMs == null && (award.phase === 'flying' || award.phase === 'pump');
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!receiving) {
      shake.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -1,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [receiving, shake]);
  const timerColor = theme.scheme === 'dark' ? '#F0C14A' : '#6B4A12';
  const coinColor = timerColor;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          alignSelf: compact ? 'center' : 'flex-end',
          marginHorizontal: compact ? 0 : 16,
          marginTop: compact ? 0 : 4,
          paddingHorizontal: compact ? 9 : 12,
          paddingVertical: compact ? 5 : 8,
          borderRadius: compact ? 12 : 16,
          backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.scheme === 'dark' ? '#8A6A32' : '#C4922A',
          transform: [{ scale: 1 }],
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        timer: {
          fontSize: compact ? 12 : 16,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
          color: timerColor,
          minWidth: compact ? 58 : 72,
          textAlign: 'right',
        },
      }),
    [compact, theme.scheme, timerColor],
  );
  const shakeX = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-3, 3],
  });

  const accessibilityLabel = t('review.gaugeA11y', lang, {
    clock: face.clock,
    interstitial: interstitialLabel,
  });

  return (
    <Pressable
      ref={pill}
      onLayout={() => pill.current?.measureInWindow((x, y, width, height) => {
        award.setCoinTarget({ x: x + width / 2, y: y + height / 2 });
      })}
      style={styles.wrap}
      testID="credits-gauge"
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        testID="credits-gauge-face"
        style={{
          transform: [{ translateX: receiving ? shakeX : 0 }, { scale: 1 }],
        }}
      >
      <View style={styles.row} testID="credits-gauge-total">
        <FontAwesome5 name="coins" size={14} color={coinColor} />
        <Text style={styles.timer} testID="credits-gauge-timer">
          {gauge.state === 'countdown' ? interstitialLabel : face.clock}
        </Text>
      </View>
      </Animated.View>
    </Pressable>
  );
}
