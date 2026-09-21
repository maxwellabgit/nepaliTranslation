import { StyleSheet, Text, View } from 'react-native';
import { useEntitlementOptional } from '../features/entitlements/EntitlementProvider';
import { colors } from '../theme';
import { creditProgress } from './creditProgress';

export function CreditsGauge() {
  const entitlement = useEntitlementOptional();
  const progress = creditProgress(entitlement?.lifetimeCredits ?? 0);

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

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#8A6A32' },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4D9CC',
    overflow: 'hidden',
  },
  fill: { height: 4, backgroundColor: colors.crimson },
});
