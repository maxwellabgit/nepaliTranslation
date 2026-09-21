import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from './useFocusEffect';
import {
  countOutbox,
  deleteDraft,
  loadOutbox,
  requeueForRetry,
  type ContributionDraft,
} from '../storage/contributionOutbox';
import { CorrectionSheet } from '../features/contribution/CorrectionSheet';
import { ContributionCard } from '../features/contribution/ContributionCard';
import { flushPendingDrafts } from '../services/contributionSync';
import { AppButton, AppHeader } from '../components/AppPrimitives';
import { EmptyState } from '../components/EmptyState';
import { StatusBanner } from '../components/StatusBanner';
import { RewardSummaryCard } from '../learn/RewardSummaryCard';
import { AdSlot } from '../features/ads/AdSlot';
import { RewardedAdButton } from '../features/ads/RewardedAdButton';
import { t, useNetworkOffline, useUiLang, type MessageKey } from '../i18n';
import { useTheme } from '../theme';

type Props = {
  onClose: () => void;
};

const STATUS_KEYS: Record<ContributionDraft['status'], MessageKey> = {
  draft: 'contributions.status.draft',
  queued: 'contributions.status.queued',
  syncing: 'contributions.status.syncing',
  retry: 'contributions.status.retry',
  synced: 'contributions.status.synced',
  rejected: 'contributions.status.rejected',
};

export function ContributionsScreen({ onClose }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const offline = useNetworkOffline();
  const [items, setItems] = useState<ContributionDraft[]>([]);
  const [editDraft, setEditDraft] = useState<ContributionDraft | null>(null);

  const reload = useCallback(async () => {
    setItems(await loadOutbox());
  }, []);

  useFocusEffect(reload);

  const counts = countOutbox(items);

  const onRetry = async (draft: ContributionDraft) => {
    await requeueForRetry(draft.id);
    void flushPendingDrafts();
    await reload();
  };

  const onDelete = (draft: ContributionDraft) => {
    Alert.alert(
      t('contributions.deleteTitle', lang),
      t('contributions.deleteBody', lang),
      [
        { text: t('common.cancel', lang), style: 'cancel' },
        {
          text: t('common.delete', lang),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteDraft(draft.id);
              await reload();
            })();
          },
        },
      ],
    );
  };

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
        scroll: {
          padding: theme.spacing.lg,
          paddingBottom: 40,
          gap: theme.spacing.md,
        },
        counts: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.xl,
          padding: 14,
          gap: theme.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.divider,
        },
        countLabel: { fontSize: 15, color: theme.colors.textSecondary },
        countValue: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.colors.text,
        },
        sectionLabel: {
          marginTop: theme.spacing.sm,
          fontSize: theme.typography.label.fontSize,
          fontWeight: '700',
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
        },
        card: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.xl,
          padding: 14,
          gap: 6,
          borderWidth: 1,
          borderColor: theme.colors.divider,
        },
        status: {
          fontSize: 12,
          fontWeight: '700',
          color: theme.colors.blue,
          textTransform: 'uppercase',
        },
        src: { fontSize: 14, color: theme.colors.textSecondary },
        dst: { fontSize: 16, color: theme.colors.text, fontWeight: '500' },
        error: { fontSize: 12, color: theme.colors.danger },
      }),
    [theme],
  );

  return (
    <KeyboardAvoidingView
      style={dynamic.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="contributions-screen"
    >
      <AppHeader
        title={t('contributions.title', lang)}
        onBack={onClose}
        testID="contributions-header"
      />

      {offline ? (
        <StatusBanner
          tone="offline"
          message={t('contributions.offlineBanner', lang)}
          testID="contributions-offline-banner"
        />
      ) : null}

      <ScrollView
        contentContainerStyle={dynamic.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <RewardSummaryCard active testID="contributions-reward-summary" />
        <RewardedAdButton />

        <ContributionCard />

        <AdSlot
          surface="contribution_result"
          eligible={counts.validated > 0 || counts.pendingValidation > 0}
          modalVisible={Boolean(editDraft)}
        />

        <View style={dynamic.counts} testID="contribution-counts">
          <CountRow
            label={t('contributions.count.draft', lang)}
            value={counts.draft}
            testID="count-Draft"
            labelStyle={dynamic.countLabel}
            valueStyle={dynamic.countValue}
          />
          <CountRow
            label={t('contributions.count.waitingToSync', lang)}
            value={counts.waitingToSync}
            testID="count-Waiting to sync"
            labelStyle={dynamic.countLabel}
            valueStyle={dynamic.countValue}
          />
          <CountRow
            label={t('contributions.count.pendingValidation', lang)}
            value={counts.pendingValidation}
            testID="count-Pending validation"
            labelStyle={dynamic.countLabel}
            valueStyle={dynamic.countValue}
          />
          <CountRow
            label={t('contributions.count.validated', lang)}
            value={counts.validated}
            testID="count-Validated"
            labelStyle={dynamic.countLabel}
            valueStyle={dynamic.countValue}
          />
          <CountRow
            label={t('contributions.count.rejected', lang)}
            value={counts.rejected}
            testID="count-Rejected"
            labelStyle={dynamic.countLabel}
            valueStyle={dynamic.countValue}
          />
          <CountRow
            label={t('contributions.count.needsAttention', lang)}
            value={counts.needsAttention}
            testID="count-Needs attention"
            labelStyle={dynamic.countLabel}
            valueStyle={dynamic.countValue}
          />
        </View>

        <Text style={dynamic.sectionLabel}>
          {t('contributions.onDevice', lang)}
        </Text>
        {items.length === 0 ? (
          <EmptyState
            kind="empty"
            title={t('contributions.emptyTitle', lang)}
            detail={t('contributions.emptyDetail', lang)}
            testID="contributions-empty"
          />
        ) : (
          items.map((draft) => (
            <View
              key={draft.id}
              style={dynamic.card}
              testID={`contribution-row-${draft.id}`}
            >
              <Text style={dynamic.status}>
                {t(STATUS_KEYS[draft.status], lang)}
              </Text>
              <Text style={dynamic.src} numberOfLines={2}>
                {draft.source_text}
              </Text>
              <Text style={dynamic.dst} numberOfLines={2}>
                {draft.correction_text ?? draft.model_output}
              </Text>
              {draft.lastErrorCode ? (
                <Text style={dynamic.error}>{draft.lastErrorCode}</Text>
              ) : null}
              <View style={styles.rowActions}>
                {(draft.status === 'draft' ||
                  draft.status === 'retry' ||
                  draft.status === 'rejected' ||
                  draft.status === 'queued') && (
                  <AppButton
                    label={t('common.edit', lang)}
                    variant="ghost"
                    onPress={() => setEditDraft(draft)}
                    testID={`contribution-edit-${draft.id}`}
                    accessibilityLabel={t('contributions.editA11y', lang)}
                  />
                )}
                {(draft.status === 'retry' || draft.status === 'rejected') && (
                  <AppButton
                    label={t('common.retry', lang)}
                    variant="ghost"
                    onPress={() => void onRetry(draft)}
                    testID={`contribution-retry-${draft.id}`}
                    accessibilityLabel={t('contributions.retryA11y', lang)}
                  />
                )}
                {draft.status !== 'synced' && draft.status !== 'syncing' && (
                  <AppButton
                    label={t('common.delete', lang)}
                    variant="danger"
                    onPress={() => onDelete(draft)}
                    testID={`contribution-delete-${draft.id}`}
                    accessibilityLabel={t('contributions.deleteA11y', lang)}
                  />
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <CorrectionSheet
        visible={Boolean(editDraft)}
        source={editDraft?.source_text ?? ''}
        translation={editDraft?.model_output ?? ''}
        sourceLang={editDraft?.source_lang ?? 'en'}
        formality={editDraft?.formality}
        script={editDraft?.script}
        surface={editDraft?.surface ?? 'history'}
        translationMethod={editDraft?.translation_method}
        modelVersion={editDraft?.model_version}
        existingDraft={editDraft}
        onClose={() => setEditDraft(null)}
        onSaved={() => void reload()}
      />
    </KeyboardAvoidingView>
  );
}

function CountRow({
  label,
  value,
  testID,
  labelStyle,
  valueStyle,
}: {
  label: string;
  value: number;
  testID: string;
  labelStyle: object;
  valueStyle: object;
}) {
  return (
    <View style={styles.countRow}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 28,
  },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});
