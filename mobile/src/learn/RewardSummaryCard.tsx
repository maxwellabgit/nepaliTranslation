import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEntitlementOptional } from '../features/entitlements/EntitlementProvider';
import { countOutbox, loadOutbox } from '../storage/contributionOutbox';
import { colors } from '../theme';

type Props = {
  /** When true, reload outbox + entitlement (e.g. Learn pane becomes active). */
  active?: boolean;
  testID?: string;
};

function adFreePhrase(ms: number | null, active: boolean, nowMs: number): string {
  if (!active || ms == null) return 'Ad-free not active';
  const mins = Math.max(0, Math.round((ms - nowMs) / 60000));
  if (mins < 60) return `Ad-free for ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `Ad-free for ${h}h ${m}m` : `Ad-free for ${h}h`;
}

/**
 * Earn-rewards strip: credits and the current ad-free window.
 * Credits never imply permanent ad-free status.
 */
export function RewardSummaryCard({ active = true, testID }: Props) {
  const entitlement = useEntitlementOptional();
  const refreshEntitlement = entitlement?.refresh;
  const [pending, setPending] = useState(0);

  const reload = useCallback(async () => {
    const items = await loadOutbox();
    const counts = countOutbox(items);
    setPending(counts.waitingToSync + counts.pendingValidation);
    await refreshEntitlement?.();
  }, [refreshEntitlement]);

  useEffect(() => {
    if (!active) return;
    void reload();
  }, [active, reload]);

  const credits = entitlement?.lifetimeCredits ?? 0;
  const adFreeActive = entitlement?.hasActiveEarnedAdFree() ?? false;
  const adFreeLabel = adFreePhrase(
    entitlement?.earnedAdFreeUntilMs ?? null,
    adFreeActive,
    entitlement?.trustedNow() ?? 0,
  );

  return (
    <View style={styles.card} testID={testID ?? 'reward-summary'}>
      <Text style={styles.kicker}>Earn rewards</Text>
      <Text style={styles.heading}>Rewards</Text>
      <Text style={styles.body}>
        Use the app, help improve translations, earn rewards.
      </Text>
      <View style={styles.metrics}>
        <Text style={styles.metric} testID="reward-lifetime-credits">
          {credits} credits
        </Text>
        <Text style={styles.metric} testID="reward-ad-free-until">
          {adFreeLabel}
        </Text>
      </View>
      <Text style={styles.pending} testID="reward-pending-count">
        {pending === 0
          ? 'Helpful corrections earn extra ad-free time.'
          : `${pending} correction${pending === 1 ? '' : 's'} waiting.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FDE8EA',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.crimson,
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.crimson,
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metric: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pending: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
