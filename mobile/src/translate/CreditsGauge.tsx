import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useEntitlementOptional } from '../features/entitlements/EntitlementProvider';
import { INTERSTITIAL_MIN_FOREGROUND_MS } from '../features/entitlements/decideInterstitialPresentation';
import { subscribeForegroundActiveMs } from '../features/ads/InterstitialController';
import { loadForegroundActiveMs } from '../features/ads/foregroundAdTimer';
import { markSkippableVideoAdDue } from '../features/ads/skippableVideoAdMark';
import { useTheme } from '../theme';
import { t, useUiLang } from '../i18n';
import { adFreeBalance, creditProgress } from './creditProgress';

type Props = {
  onPress?: () => void;
  /** Fits in the header between the app icon and Settings. */
  compact?: boolean;
};

export function CreditsGauge({ onPress, compact = false }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const entitlement = useEntitlementOptional();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [foregroundMs, setForegroundMs] = useState(0);
  const adMarkedRef = useRef(false);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const timer = setInterval(tick, 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void loadForegroundActiveMs().then((ms) => {
      if (!cancelled) setForegroundMs(ms);
    });
    const unsubscribe = subscribeForegroundActiveMs((ms) => {
      if (!cancelled) setForegroundMs(ms);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const remainingMs = Math.max(0, INTERSTITIAL_MIN_FOREGROUND_MS - foregroundMs);
  useEffect(() => {
    if (remainingMs > 0) {
      adMarkedRef.current = false;
      return;
    }
    if (adMarkedRef.current) return;
    adMarkedRef.current = true;
    // REVIEW: 15:00 elapsed. Hook for a video ad skippable after 5 seconds.
    markSkippableVideoAdDue();
  }, [remainingMs]);
  const countdownLabel = formatAdCountdown(remainingMs);
  const lifetimeCredits = entitlement?.lifetimeCredits ?? 0;
  const balance = adFreeBalance({
    earnedUntilMs: entitlement?.earnedAdFreeUntilMs ?? null,
    nowMs,
    lifetimeCredits,
  });
  const progress = creditProgress(lifetimeCredits);
  const fill = progress.credits === 0 ? 0 : progress.percent;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: compact
          ? {
              flex: 1,
              marginHorizontal: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
              gap: 3,
              borderRadius: 12,
              backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.scheme === 'dark' ? '#8A6A32' : '#C4922A',
            }
          : {
              marginHorizontal: 16,
              marginTop: 4,
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 8,
              borderRadius: 16,
              backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
            },
        balance: {
          fontSize: 15,
          fontWeight: '700',
          color: theme.scheme === 'dark' ? theme.colors.saffron : '#8A6A32',
        },
        gauge: { gap: 8 },
        gaugeHeader: {
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: compact ? 'center' : 'space-between',
        },
        compactRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        trackFlex: { flex: 1 },
        total: {
          fontSize: compact ? 11 : 16,
          fontWeight: '700',
          color: theme.scheme === 'dark' ? theme.colors.saffron : '#8A6A32',
        },
        totalCount: {
          fontSize: compact ? 13 : 22,
          fontWeight: '800',
          color: theme.scheme === 'dark' ? '#F0C14A' : '#6B4A12',
        },
        track: {
          height: compact ? 8 : 16,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: theme.scheme === 'dark' ? '#8A6A32' : '#C4922A',
        },
        countdown: {
          fontSize: compact ? 12 : 14,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
          color: theme.scheme === 'dark' ? '#F0C14A' : '#6B4A12',
          minWidth: 40,
          textAlign: 'right',
        },
        fill: {
          height: '100%',
          borderRadius: 5,
          backgroundColor: theme.scheme === 'dark' ? '#F0C14A' : '#FFF6D8',
        },
      }),
    [compact, theme],
  );

  return (
    <Pressable
      style={styles.wrap}
      testID="credits-gauge"
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${balance.accessibilityLabel} ${countdownLabel} ${t('learn.earnRewardsA11y', lang)}`}
    >
      {balance.remainingLabel ? (
        <Text style={styles.balance} testID="credits-gauge-label">
          {balance.remainingLabel}
        </Text>
      ) : null}
      {compact ? (
        <View style={styles.compactRow} testID="credits-gauge-total">
          <FontAwesome5
            name="coins"
            size={14}
            color={theme.scheme === 'dark' ? '#F0C14A' : '#6B4A12'}
          />
          <Text style={styles.totalCount}>{progress.credits}</Text>
          <View
            style={[styles.track, styles.trackFlex]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: fill }}
          >
            <View style={[styles.fill, { width: `${fill}%` }]} />
          </View>
          <Text style={styles.countdown} testID="credits-ad-countdown">
            {countdownLabel}
          </Text>
        </View>
      ) : (
        <View style={styles.gauge} testID="credits-gauge-total">
          <View style={styles.gaugeHeader}>
            <Text style={styles.total}>Total earned</Text>
            <Text style={styles.totalCount}>{progress.credits}</Text>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: fill }}
          >
            <View style={[styles.fill, { width: `${fill}%` }]} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

function formatAdCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
