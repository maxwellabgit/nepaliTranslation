import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useEntitlementOptional } from '../features/entitlements/EntitlementProvider';
import { useTheme } from '../theme';
import { adFreeBalance } from './creditProgress';

export function CreditsGauge() {
  const theme = useTheme();
  const entitlement = useEntitlementOptional();
  const [nowMs, setNowMs] = useState(() => Date.now());
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
  const balance = adFreeBalance({
    earnedUntilMs: entitlement?.earnedAdFreeUntilMs ?? null,
    nowMs,
    lifetimeCredits: entitlement?.lifetimeCredits ?? 0,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { paddingHorizontal: 20, gap: 2 },
        balance: {
          fontSize: 13,
          fontWeight: '700',
          color: theme.scheme === 'dark' ? theme.colors.saffron : '#8A6A32',
        },
        total: {
          fontSize: 12,
          color: theme.colors.textSecondary,
        },
      }),
    [theme],
  );

  return (
    <View
      style={styles.wrap}
      testID="credits-gauge"
      accessible
      accessibilityRole="text"
      accessibilityLabel={balance.accessibilityLabel}
    >
      <Text style={styles.balance} testID="credits-gauge-label">
        {balance.remainingLabel}
      </Text>
      <Text style={styles.total} testID="credits-gauge-total">
        {balance.totalEarnedLabel}
      </Text>
    </View>
  );
}
