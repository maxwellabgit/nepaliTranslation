import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../components/AppPrimitives';
import { useEntitlement } from '../features/entitlements/EntitlementProvider';
import {
  countOutbox,
  loadOutbox,
} from '../storage/contributionOutbox';
import { colors } from '../theme';

type Props = {
  /** When true, reload outbox + entitlement (e.g. Learn pane becomes active). */
  active?: boolean;
  testID?: string;
};

function formatAdFreeUntil(ms: number | null, active: boolean): string {
  if (!active || ms == null) return 'Not active';
  try {
    return new Date(ms).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

/**
 * Lifetime credits, pending outbox count, and earned ad-free window.
 * Historical credits alone never imply permanent ad-free status.
 */
export function RewardSummaryCard({ active = true, testID }: Props) {
  const entitlement = useEntitlement();
  const refreshEntitlement = entitlement.refresh;
  const [pending, setPending] = useState(0);

  const reload = useCallback(async () => {
    const items = await loadOutbox();
    const counts = countOutbox(items);
    setPending(counts.waitingToSync + counts.pendingValidation);
    await refreshEntitlement();
  }, [refreshEntitlement]);

  useEffect(() => {
    if (!active) return;
    void reload();
  }, [active, reload]);

  const adFreeActive = entitlement.hasActiveEarnedAdFree();
  const adFreeLabel = formatAdFreeUntil(
    entitlement.earnedAdFreeUntilMs,
    adFreeActive,
  );

  return (
    <AppCard style={styles.card} testID={testID ?? 'reward-summary'}>
      <Text style={styles.heading} accessibilityRole="header">
        Rewards
      </Text>
      <Row
        label="Lifetime validated credits"
        value={String(entitlement.lifetimeCredits)}
        testID="reward-lifetime-credits"
      />
      <Row
        label="Pending"
        value={String(pending)}
        testID="reward-pending-count"
      />
      <Row
        label="Ad-free until"
        value={adFreeLabel}
        testID="reward-ad-free-until"
      />
      <Text style={styles.hint}>
        Credits unlock time-limited ad-free windows. They do not grant permanent
        ad-free access.
      </Text>
    </AppCard>
  );
}

function Row({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID: string;
}) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 28,
  },
  label: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 0,
    maxWidth: '48%',
    textAlign: 'right',
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
});
