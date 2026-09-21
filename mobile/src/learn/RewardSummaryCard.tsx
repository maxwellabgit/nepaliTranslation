import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEntitlementOptional } from '../features/entitlements/EntitlementProvider';
import { t, useUiLang } from '../i18n';
import { countOutbox, loadOutbox } from '../storage/contributionOutbox';
import { useTheme } from '../theme';

type Props = {
  /** When true, reload outbox + entitlement (e.g. Learn pane becomes active). */
  active?: boolean;
  testID?: string;
};

function adFreePhrase(
  ms: number | null,
  active: boolean,
  nowMs: number,
  lang: 'en' | 'ne',
): string {
  if (!active || ms == null) return t('learn.adFreeInactive', lang);
  const mins = Math.max(0, Math.round((ms - nowMs) / 60000));
  if (mins < 60) return t('learn.adFreeMins', lang, { mins });
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem
    ? t('learn.adFreeHoursMins', lang, { hours, mins: rem })
    : t('learn.adFreeHours', lang, { hours });
}

/**
 * Earn-rewards strip: credits and the current ad-free window.
 * Credits never imply permanent ad-free status.
 */
export function RewardSummaryCard({ active = true, testID }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
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
    lang,
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor:
            theme.scheme === 'dark' ? theme.colors.errorBg : '#FDE8EA',
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
          color: theme.colors.crimson,
        },
        heading: {
          fontSize: 18,
          fontWeight: '800',
          color: theme.colors.crimson,
        },
        body: {
          fontSize: 14,
          lineHeight: 19,
          color: theme.colors.textSecondary,
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
          color: theme.colors.text,
        },
        pending: {
          marginTop: 6,
          fontSize: 13,
          color: theme.colors.textSecondary,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.card} testID={testID ?? 'reward-summary'}>
      <Text style={styles.kicker}>{t('learn.earnRewards', lang)}</Text>
      <Text style={styles.heading}>{t('learn.rewardsHeading', lang)}</Text>
      <Text style={styles.body}>{t('learn.rewardsBody', lang)}</Text>
      <View style={styles.metrics}>
        <Text style={styles.metric} testID="reward-lifetime-credits">
          {t('learn.credits', lang, { count: credits })}
        </Text>
        <Text style={styles.metric} testID="reward-ad-free-until">
          {adFreeLabel}
        </Text>
      </View>
      <Text style={styles.pending} testID="reward-pending-count">
        {pending === 0
          ? t('learn.pendingHelp', lang)
          : pending === 1
            ? t('learn.pendingWaitingOne', lang)
            : t('learn.pendingWaiting', lang, { count: pending })}
      </Text>
    </View>
  );
}
