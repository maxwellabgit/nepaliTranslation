import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
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
import { flushPendingDrafts } from '../services/contributionSync';
import { EmptyState } from '../components/AppPrimitives';
import { colors } from '../theme';

type Props = {
  onClose: () => void;
};

function statusLabel(status: ContributionDraft['status']): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'queued':
      return 'Waiting to sync';
    case 'syncing':
      return 'Syncing';
    case 'retry':
      return 'Needs retry';
    case 'synced':
      return 'Pending validation';
    case 'rejected':
      return 'Rejected';
    default:
      return status;
  }
}

export function ContributionsScreen({ onClose }: Props) {
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
      'Delete contribution',
      'Remove this draft from this device? Nothing is uploaded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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

  return (
    <View style={styles.root} testID="contributions-screen">
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel="Close contributions"
          testID="contributions-close"
        >
          <Text style={styles.topBtnText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Contributions & rewards</Text>
        <View style={styles.topBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.counts} testID="contribution-counts">
          <CountRow label="Draft" value={counts.draft} />
          <CountRow label="Waiting to sync" value={counts.waitingToSync} />
          <CountRow
            label="Pending validation"
            value={counts.pendingValidation}
          />
          <CountRow label="Validated" value={counts.validated} />
          <CountRow label="Rejected" value={counts.rejected} />
          <CountRow label="Needs attention" value={counts.needsAttention} />
        </View>

        <Text style={styles.sectionLabel}>On this device</Text>
        {items.length === 0 ? (
          <EmptyState
            title="No contributions yet"
            detail="Mark a translation incorrect or use To training to save a draft."
            testID="contributions-empty"
          />
        ) : (
          items.map((draft) => (
            <View
              key={draft.id}
              style={styles.card}
              testID={`contribution-row-${draft.id}`}
            >
              <Text style={styles.status}>{statusLabel(draft.status)}</Text>
              <Text style={styles.src} numberOfLines={2}>
                {draft.source_text}
              </Text>
              <Text style={styles.dst} numberOfLines={2}>
                {draft.correction_text ?? draft.model_output}
              </Text>
              {draft.lastErrorCode ? (
                <Text style={styles.error}>{draft.lastErrorCode}</Text>
              ) : null}
              <View style={styles.rowActions}>
                {(draft.status === 'draft' ||
                  draft.status === 'retry' ||
                  draft.status === 'rejected' ||
                  draft.status === 'queued') && (
                  <Pressable
                    onPress={() => setEditDraft(draft)}
                    testID={`contribution-edit-${draft.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Edit contribution"
                  >
                    <Text style={styles.link}>Edit</Text>
                  </Pressable>
                )}
                {(draft.status === 'retry' || draft.status === 'rejected') && (
                  <Pressable
                    onPress={() => void onRetry(draft)}
                    testID={`contribution-retry-${draft.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Retry contribution"
                  >
                    <Text style={styles.link}>Retry</Text>
                  </Pressable>
                )}
                {draft.status !== 'synced' && draft.status !== 'syncing' && (
                  <Pressable
                    onPress={() => onDelete(draft)}
                    testID={`contribution-delete-${draft.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Delete contribution"
                  >
                    <Text style={[styles.link, styles.danger]}>Delete</Text>
                  </Pressable>
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
    </View>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.countRow}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text style={styles.countValue} testID={`count-${label}`}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  topBtn: {
    width: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBtnText: { fontSize: 22, color: colors.textSecondary },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  counts: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countLabel: { fontSize: 15, color: colors.textSecondary },
  countValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue,
    textTransform: 'uppercase',
  },
  src: { fontSize: 14, color: colors.textSecondary },
  dst: { fontSize: 16, color: colors.text, fontWeight: '500' },
  error: { fontSize: 12, color: colors.danger },
  rowActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  link: { fontSize: 14, fontWeight: '700', color: colors.blue, minHeight: 36 },
  danger: { color: colors.danger },
});
