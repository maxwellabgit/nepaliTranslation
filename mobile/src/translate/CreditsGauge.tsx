import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useEntitlementOptional } from '../features/entitlements/EntitlementProvider';
import { useTheme } from '../theme';
import { creditProgress } from './creditProgress';

export function CreditsGauge() {
  const theme = useTheme();
  const entitlement = useEntitlementOptional();
  const progress = creditProgress(entitlement?.lifetimeCredits ?? 0);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { paddingHorizontal: 20, gap: 6 },
        label: {
          fontSize: 12,
          fontWeight: '700',
          color: theme.scheme === 'dark' ? theme.colors.saffron : '#8A6A32',
        },
        track: {
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.divider,
          overflow: 'hidden',
        },
        fill: { height: 4, backgroundColor: theme.colors.crimson },
      }),
    [theme],
  );

  return (
    <View
      style={styles.wrap}
      testID="credits-gauge"
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: progress.percent,
        text: progress.accessibilityLabel,
      }}
      accessibilityLabel={progress.accessibilityLabel}
    >
      <Text style={styles.label} testID="credits-gauge-label">
        {progress.credits} credits
        {progress.nextThreshold != null
          ? ` · ${progress.nextThreshold - progress.credits} to ${progress.nextThreshold}`
          : ''}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress.percent}%` }]} />
      </View>
    </View>
  );
}
