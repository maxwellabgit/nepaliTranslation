import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { goldPack, GOLD_CLASSES, itemsForClass } from '../gold/pack';
import type { GoldItem } from '../gold/types';
import benchSnapshot from '../../assets/gold/bench_snapshot.json';
import {
  buildExportPayload,
  completeFromItem,
  completeSentenceSplits,
  deleteReview,
  loadReviews,
  type GoldReview,
  type ReviewMap,
  upsertReview,
} from '../storage/goldReviews';
import { isMultiSentence, suggestAlignedSplits, IT2_WINDOW } from '../mt/sentences';
import { colors } from '../theme';

const REVIEW_PASSWORD = '1234';

type Props = {
  onClose: () => void;
};

/**
 * Password-gated human gold review — fast path for overnight training loop.
 */
export function GoldReviewScreen({ onClose }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [classId, setClassId] = useState(GOLD_CLASSES[0]);
  const [reviews, setReviews] = useState<ReviewMap>({});
  const [index, setIndex] = useState(0);
  const [sourceEdit, setSourceEdit] = useState('');
  const [refEdit, setRefEdit] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [lastUndoneId, setLastUndoneId] = useState<string | null>(null);

  useEffect(() => {
    void loadReviews().then(setReviews);
  }, []);

  const classItems = useMemo(() => {
    const base = itemsForClass(classId);
    if (!premiumOnly) return base;
    return base.filter(
      (i) =>
        i.provenance.trust === 'gold' ||
        i.provenance.trust === 'high' ||
        i.provenance.tier === 'premium',
    );
  }, [classId, premiumOnly]);
  const pending = useMemo(
    () =>
      showCompleted
        ? classItems
        : classItems.filter((i) => !reviews[i.id]?.completed_at),
    [classItems, reviews, showCompleted],
  );

  const item: GoldItem | undefined = pending[Math.min(index, Math.max(pending.length - 1, 0))];

  useEffect(() => {
    setIndex(0);
  }, [classId, showCompleted, premiumOnly]);

  useEffect(() => {
    if (!item) {
      setSourceEdit('');
      setRefEdit('');
      return;
    }
    const existing = reviews[item.id];
    setSourceEdit(existing?.source_final ?? item.source);
    setRefEdit(existing?.reference_final ?? item.reference);
  }, [item?.id, reviews]);

  const totals = useMemo(() => {
    const done = goldPack.items.filter((i) => reviews[i.id]?.completed_at).length;
    return { done, total: goldPack.n_items };
  }, [reviews]);

  const classDone = useMemo(
    () => classItems.filter((i) => reviews[i.id]?.completed_at).length,
    [classItems, reviews],
  );

  const tryUnlock = () => {
    if (password.trim() === REVIEW_PASSWORD) {
      setUnlocked(true);
      setPassword('');
    } else {
      Alert.alert('Wrong password');
    }
  };

  const persist = useCallback(async (review: GoldReview) => {
    const next = await upsertReview(review);
    setReviews(next);
    setLastUndoneId(review.id);
  }, []);

  const markCorrect = async () => {
    if (!item) return;
    const src = sourceEdit.trim() || item.source;
    const ref = refEdit.trim() || item.reference;
    if (isMultiSentence(src) || isMultiSentence(ref)) {
      Alert.alert(
        'Multi-sentence pair',
        'Fine-tuning is sentence-level. Prefer Split when both sides align, or edit down to one sentence.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Accept anyway',
            onPress: () =>
              void persist(
                completeFromItem(item, src, ref, {
                  multi_sentence_flag: true,
                }),
              ),
          },
        ],
      );
      return;
    }
    await persist(completeFromItem(item, src, ref));
  };

  const markCompleteEdits = async () => {
    if (!item) return;
    if (!sourceEdit.trim() || !refEdit.trim()) {
      Alert.alert('Both sides required');
      return;
    }
    const multi = isMultiSentence(sourceEdit) || isMultiSentence(refEdit);
    await persist(
      completeFromItem(item, sourceEdit, refEdit, {
        multi_sentence_flag: multi || undefined,
      }),
    );
  };

  const splitAligned = async () => {
    if (!item) return;
    const pairs = suggestAlignedSplits(sourceEdit || item.source, refEdit || item.reference);
    if (!pairs) {
      Alert.alert(
        'Cannot auto-split',
        'Source and reference sentence counts differ. Edit to one sentence each, or split manually into separate reviews later.',
      );
      return;
    }
    const next = await completeSentenceSplits(item, pairs);
    setReviews(next);
  };

  const undoLast = async () => {
    const id = lastUndoneId;
    if (!id || !reviews[id]) {
      Alert.alert('Nothing to undo');
      return;
    }
    const next = await deleteReview(id);
    setReviews(next);
    setLastUndoneId(null);
  };

  const exportReviews = async () => {
    const payload = buildExportPayload(reviews);
    const text = JSON.stringify(payload, null, 2);
    try {
      await Share.share({
        message: text,
        title: `NepTranslate gold reviews (${payload.n_completed})`,
      });
    } catch {
      await Clipboard.setStringAsync(text);
      Alert.alert(
        'Copied',
        `${payload.n_completed} reviews on clipboard.\nPC: python benchmarks/apply_app_reviews.py <file>`,
      );
    }
  };

  if (!unlocked) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.link}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Gold Review</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.lockBox}>
          <Text style={styles.lockHint}>Reviewer access</Text>
          <TextInput
            style={styles.password}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textPlaceholder}
            secureTextEntry
            keyboardType="number-pad"
            onSubmitEditing={tryUnlock}
            autoFocus
          />
          <Pressable style={styles.primaryBtn} onPress={tryUnlock}>
            <Text style={styles.primaryBtnText}>Unlock</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Gold Review</Text>
          <Text style={styles.progress}>
            {totals.done}/{totals.total} · {classDone}/{classItems.length} this class
          </Text>
        </View>
        <Pressable onPress={() => void exportReviews()} hitSlop={8}>
          <Text style={styles.link}>Export</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.classRow}
      >
        {GOLD_CLASSES.map((cid) => {
          const n = itemsForClass(cid).length;
          const d = itemsForClass(cid).filter((i) => reviews[i.id]?.completed_at).length;
          const on = cid === classId;
          return (
            <Pressable
              key={cid}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setClassId(cid)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {cid.replace(/_/g, ' ')}
              </Text>
              <Text style={[styles.chipSub, on && styles.chipTextOn]}>
                {d}/{n}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.toolbar}>
        <Pressable onPress={() => setShowCompleted((v) => !v)}>
          <Text style={styles.link}>
            {showCompleted ? 'Show pending only' : 'Include completed'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setPremiumOnly((v) => !v)}>
          <Text style={styles.link}>{premiumOnly ? 'All tiers' : 'Premium first'}</Text>
        </Pressable>
        <Pressable onPress={() => void undoLast()}>
          <Text style={styles.link}>Undo</Text>
        </Pressable>
        <Text style={styles.meta}>
          {pending.length ? `${Math.min(index + 1, pending.length)}/${pending.length}` : 'Done'}
        </Text>
      </View>

      <View style={styles.benchCard}>
        <Text style={styles.benchTitle}>Benchmark · chrF overall</Text>
        <View style={styles.benchRow}>
          {(benchSnapshot.models as { id: string; overall: number }[]).map((m) => (
            <View key={m.id} style={styles.benchCell}>
              <Text style={styles.benchId}>{m.id}</Text>
              <Text style={styles.benchVal}>{(100 * m.overall).toFixed(1)}%</Text>
            </View>
          ))}
        </View>
        <Text style={styles.benchNote}>
          Formal register OK {(100 * (benchSnapshot.classes[0].register_ok ?? 0)).toFixed(0)}% ·
          Informal {(100 * (benchSnapshot.classes[1].register_ok ?? 0)).toFixed(0)}% · App ships
          phrasebook until adapters pass gates
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {!item ? (
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>
              {showCompleted ? 'No rows in this class' : 'Class complete'}
            </Text>
            <Text style={styles.doneBody}>
              {totals.done >= totals.total
                ? 'All gold reviewed. Export → apply_app_reviews.py → pack_gold_for_app.py.'
                : 'Pick another class, or Export completed reviews.'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.idLine}>{item.id}</Text>
            <Text style={styles.prov}>
              {item.provenance.dataset_id} · trust {item.provenance.trust}
              {item.provenance.note ? ` · ${item.provenance.note}` : ''}
            </Text>
            <Text style={styles.windowHint}>
              FT window ~{IT2_WINDOW.fineTuneMaxLength} tok (model max{' '}
              {IT2_WINDOW.maxSourcePositions}) · prefer one sentence
            </Text>

            {isMultiSentence(sourceEdit) || isMultiSentence(refEdit) ? (
              <View style={styles.warnCard}>
                <Text style={styles.warnTitle}>Multi-sentence detected</Text>
                <Text style={styles.warnBody}>
                  IndicTrans2 fine-tunes per sentence. Split when both sides align,
                  or trim to a single sentence before completing.
                </Text>
                {suggestAlignedSplits(sourceEdit, refEdit) ? (
                  <Pressable style={styles.splitBtn} onPress={() => void splitAligned()}>
                    <Text style={styles.splitBtnText}>
                      Split into {suggestAlignedSplits(sourceEdit, refEdit)!.length}{' '}
                      sentence pairs
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.warnBody}>
                    Counts differ — edit manually to one sentence each.
                  </Text>
                )}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>{item.source_label}</Text>
            <TextInput
              style={styles.field}
              value={sourceEdit}
              onChangeText={setSourceEdit}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>{item.target_label}</Text>
            <TextInput
              style={[styles.field, styles.fieldTarget]}
              value={refEdit}
              onChangeText={setRefEdit}
              multiline
              textAlignVertical="top"
            />

            {item.deva ? (
              <Text style={styles.devaHint}>Devanagari pair: {item.deva}</Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable style={styles.correctBtn} onPress={() => void markCorrect()}>
                <Text style={styles.correctText}>✓ Correct</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => void markCompleteEdits()}
              >
                <Text style={styles.primaryBtnText}>Save & complete</Text>
              </Pressable>
            </View>

            <View style={styles.navRow}>
              <Pressable
                disabled={index <= 0}
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <Text style={[styles.link, index <= 0 && styles.disabled]}>← Prev</Text>
              </Pressable>
              <Pressable
                disabled={index >= pending.length - 1}
                onPress={() => setIndex((i) => Math.min(pending.length - 1, i + 1))}
              >
                <Text
                  style={[
                    styles.link,
                    index >= pending.length - 1 && styles.disabled,
                  ]}
                >
                  Skip →
                </Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.catalog}>
          <Text style={styles.catalogTitle}>Dataset trust (for later train pulls)</Text>
          {goldPack.dataset_catalog.map((d) => (
            <Text key={d.id} style={styles.catalogLine}>
              {d.trust.toUpperCase()} · {d.id} — {d.use}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  progress: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  link: { fontSize: 15, fontWeight: '600', color: colors.crimson },
  disabled: { opacity: 0.35 },
  lockBox: {
    marginTop: 48,
    paddingHorizontal: 28,
    gap: 14,
  },
  lockHint: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  password: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.text,
  },
  classRow: { paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipOn: { backgroundColor: colors.crimson, borderColor: colors.crimson },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  chipTextOn: { color: '#fff' },
  chipSub: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  meta: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  benchCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  benchTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.crimson,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  benchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  benchCell: { minWidth: 72 },
  benchId: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  benchVal: { fontSize: 16, fontWeight: '700', color: colors.text },
  benchNote: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  idLine: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  prov: { fontSize: 12, color: colors.forest, marginBottom: 6 },
  windowHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  warnCard: {
    backgroundColor: '#FFF6E8',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.saffron,
    gap: 8,
  },
  warnTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  warnBody: { fontSize: 12, lineHeight: 17, color: colors.textSecondary },
  splitBtn: {
    backgroundColor: colors.forest,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  splitBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.crimson,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  field: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    fontSize: 20,
    lineHeight: 28,
    color: colors.text,
    minHeight: 88,
    marginBottom: 14,
  },
  fieldTarget: { minHeight: 100 },
  devaHint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  actions: { gap: 10, marginTop: 4 },
  correctBtn: {
    backgroundColor: colors.forestSoft,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.forest,
  },
  correctText: { fontSize: 16, fontWeight: '700', color: colors.forest },
  primaryBtn: {
    backgroundColor: colors.crimson,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  doneCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
  },
  doneTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  doneBody: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  catalog: { marginTop: 28, gap: 6 },
  catalogTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  catalogLine: { fontSize: 11, lineHeight: 16, color: colors.textSecondary },
});
