import { StyleSheet, Text, View } from 'react-native';
import { useEntitlementOptional } from '../features/entitlements/EntitlementProvider';
import { colors } from '../theme';

export function CreditsGauge() {
  const entitlement = useEntitlementOptional();
  const credits = entitlement?.lifetimeCredits ?? 0;
  const fill = Math.max(4, Math.min(100, credits));

  return (
    <View style={styles.wrap} testID="credits-gauge">
      <Text style={styles.label}>{credits} credits</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fill}%` }]} />
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
