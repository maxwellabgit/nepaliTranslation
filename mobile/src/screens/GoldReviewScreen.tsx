import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { goldPack } from '../gold/pack';
import type { GoldItem } from '../gold/types';
import {
  allReviewSamples,
  isPremiumSample,
  sampleKindLabel,
} from '../gold/pairs';
import benchSnapshot from '../../assets/gold/bench_snapshot.json';
import {
  buildExportPayload,
  completeFromItem,
  completeSentenceSplits,
  loadReviews,
  saveReviews,
  type GoldReview,
  type ReviewMap,
} from '../storage/goldReviews';
import { isMultiSentence, suggestAlignedSplits, IT2_WINDOW } from '../mt/sentences';
import { colors } from '../theme';

const REVIEW_PASSWORD = '1234';

type Props = {
  onClose: () => void;
};

type SampleEdits = {
  source: string;
  reference: string;
};

type AutoHeightProps = ComponentProps<typeof TextInput> & {
  maxHeight?: number;
};

const FIELD_MIN = 72;
const FIELD_MAX_DEFAULT = 160;

function AutoHeightInput({
  style,
  onContentSizeChange,
  value,
  maxHeight = FIELD_MAX_DEFAULT,
  ...rest
}: AutoHeightProps) {
  const [height, setHeight] = useState(FIELD_MIN);

  useEffect(() => {
    setHeight(FIELD_MIN);
  }, [value]);

  const handleSize = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const next = Math.ceil(e.nativeEvent.contentSize.height);
    if (next > maxHeight * 3) {
      onContentSizeChange?.(e);
      return;
    }
    setHeight(Math.min(maxHeight, Math.max(FIELD_MIN, next)));
    onContentSizeChange?.(e);
  };

  const capped = Math.min(maxHeight, Math.max(FIELD_MIN, height));

  return (
    <TextInput
      {...rest}
      value={value}
      multiline
      textAlignVertical="top"
      scrollEnabled={height >= maxHeight}
      onContentSizeChange={handleSize}
      style={[styles.field, style, { height: capped, maxHeight }]}
    />
  );
}

function sampleCompleted(item: GoldItem, reviews: ReviewMap): boolean {
  return Boolean(reviews[item.id]?.completed_at);
}

/**
 * Password-gated human gold review — flat sample-by-sample queue.
 */
export function GoldReviewScreen({ onClose }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [reviews, setReviews] = useState<ReviewMap>({});
  const [index, setIndex] = useState(0);
  const [edits, setEdits] = useState<SampleEdits>({ source: '', reference: '' });
  const [showCompleted, setShowCompleted] = useState(false);
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [lastSavedIds, setLastSavedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadReviews().then(setReviews);
  }, []);

  const queue = useMemo(() => {
    let items = allReviewSamples();
    if (premiumOnly) items = items.filter(isPremiumSample);
    if (!showCompleted) items = items.filter((i) => !sampleCompleted(i, reviews));
    return items;
  }, [premiumOnly, showCompleted, reviews]);

  const sample: GoldItem | undefined = queue[Math.min(index, Math.max(queue.length - 1, 0))];

  useEffect(() => {
    setIndex(0);
  }, [showCompleted, premiumOnly]);

  useEffect(() => {
    if (!sample) {
      setEdits({ source: '', reference: '' });
      return;
    }
    const rev = reviews[sample.id];
    setEdits({
      source: rev?.source_final ?? sample.source,
      reference: rev?.reference_final ?? sample.reference,
    });
  }, [sample?.id, reviews]);

  // Keep index in range when queue shrinks after a save.
  useEffect(() => {
    if (!queue.length) {
      setIndex(0);
      return;
    }
    if (index > queue.length - 1) setIndex(queue.length - 1);
  }, [queue.length, index]);

  const totals = useMemo(() => {
    const all = allReviewSamples();
    const done = all.filter((i) => sampleCompleted(i, reviews)).length;
    return { done, total: all.length };
  }, [reviews]);

  const tryUnlock = () => {
    if (password.trim() === REVIEW_PASSWORD) {
      setUnlocked(true);
      setPassword('');
    } else {
      Alert.alert('Wrong password');
    }
  };

  const persistOne = useCallback(async (review: GoldReview) => {
    if (saving) return;
    setSaving(true);
    try {
      const map = await loadReviews();
      map[review.id] = review;
      await saveReviews(map);
      setReviews(map);
      setLastSavedIds([review.id]);
    } catch (e) {
      Alert.alert(
        'Save failed',
        e instanceof Error ? e.message : 'Could not save review on this device.',
      );
    } finally {
      setSaving(false);
    }
  }, [saving]);

  const buildReview = (): GoldReview | null => {
    if (!sample) return null;
    const src = edits.source.trim();
    const ref = edits.reference.trim();
    if (!src) {
      Alert.alert(`${sample.source_label} required`);
      return null;
    }
    if (!ref) {
      Alert.alert(`${sample.target_label} required`);
      return null;
    }
    const multi = isMultiSentence(src) || isMultiSentence(ref);
    return completeFromItem(sample, src, ref, {
      multi_sentence_flag: multi || undefined,
    });
  };

  const commitSample = async (allowMultiWithoutPrompt: boolean) => {
    const built = buildReview();
    if (!built) return;
    if (built.multi_sentence_flag && !allowMultiWithoutPrompt) {
      Alert.alert(
        'Multi-sentence sample',
        'Fine-tuning is sentence-level. Prefer Split when both sides align, or edit down to one sentence.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Accept anyway',
            onPress: () => void persistOne(built),
          },
        ],
      );
      return;
    }
    await persistOne(built);
  };

  const splitAligned = async () => {
    if (!sample) return;
    const pairs = suggestAlignedSplits(edits.source, edits.reference);
    if (!pairs) {
      Alert.alert(
        'Cannot auto-split',
        'Source and reference sentence counts differ. Edit to one sentence each.',
      );
      return;
    }
    try {
      const next = await completeSentenceSplits(sample, pairs);
      setReviews(next);
      setLastSavedIds([sample.id, ...pairs.map((_, i) => `${sample.id}__s${i + 1}`)]);
    } catch (e) {
      Alert.alert(
        'Split failed',
        e instanceof Error ? e.message : 'Could not save split reviews.',
      );
    }
  };

  const undoLast = async () => {
    const ids = lastSavedIds;
    if (!ids.length) {
      Alert.alert('Nothing to undo');
      return;
    }
    try {
      const map = await loadReviews();
      for (const id of ids) delete map[id];
      await saveReviews(map);
      setReviews(map);
      setLastSavedIds([]);
    } catch (e) {
      Alert.alert(
        'Undo failed',
        e instanceof Error ? e.message : 'Could not undo on this device.',
      );
    }
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

  const dismissKeyboard = () => Keyboard.dismiss();

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

  const multiDetect =
    Boolean(sample) &&
    (isMultiSentence(edits.source) || isMultiSentence(edits.reference));
  const splitPairs = sample
    ? suggestAlignedSplits(edits.source, edits.reference)
    : null;
  const needsIndicHint =
    Boolean(sample) &&
    (/[\u0900-\u097F]/.test(edits.source) || sample!.source_lang === 'ne');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Gold Review</Text>
          <Text style={styles.progress}>
            {totals.done}/{totals.total} samples
          </Text>
        </View>
        <Pressable onPress={() => void exportReviews()} hitSlop={8}>
          <Text style={styles.link}>Export</Text>
        </Pressable>
      </View>

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
          {queue.length ? `${Math.min(index + 1, queue.length)}/${queue.length}` : 'Done'}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissKeyboard}
      >
        <Pressable style={styles.tapDismiss} onPress={dismissKeyboard}>
          {!sample ? (
            <View style={styles.doneCard}>
              <Text style={styles.doneTitle}>
                {showCompleted ? 'No samples' : 'Queue complete'}
              </Text>
              <Text style={styles.doneBody}>
                {totals.done >= totals.total
                  ? 'All gold reviewed. Export → apply_app_reviews.py → pack_gold_for_app.py.'
                  : 'Export completed reviews, or turn on Include completed to revisit.'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.idLine}>{sample.id}</Text>
              <Text style={styles.kindLine}>{sampleKindLabel(sample)}</Text>
              <Text style={styles.prov}>
                {sample.provenance.dataset_id} · trust {sample.provenance.trust}
                {sample.provenance.note ? ` · ${sample.provenance.note}` : ''}
              </Text>
              <Text style={styles.windowHint}>
                FT window ~{IT2_WINDOW.fineTuneMaxLength} tok · prefer one sentence · sample{' '}
                {Math.min(index + 1, queue.length)} of {queue.length}
              </Text>

              {multiDetect ? (
                <View style={styles.warnCard}>
                  <Text style={styles.warnTitle}>Multi-sentence detected</Text>
                  <Text style={styles.warnBody}>
                    IndicTrans2 fine-tunes per sentence. Split when both sides align, or trim to a
                    single sentence before completing.
                  </Text>
                  {splitPairs ? (
                    <Pressable style={styles.splitBtn} onPress={() => void splitAligned()}>
                      <Text style={styles.splitBtnText}>
                        Split into {splitPairs.length} sentence pairs
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.warnBody}>
                      Counts differ — edit manually to one sentence each.
                    </Text>
                  )}
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>{sample.source_label}</Text>
              <AutoHeightInput
                value={edits.source}
                onChangeText={(t) => setEdits((e) => ({ ...e, source: t }))}
                autoCapitalize="sentences"
                autoCorrect={sample.source_lang !== 'ne'}
                keyboardType="default"
                maxHeight={140}
              />

              <Text style={styles.fieldLabel}>{sample.target_label}</Text>
              <AutoHeightInput
                value={edits.reference}
                onChangeText={(t) => setEdits((e) => ({ ...e, reference: t }))}
                style={styles.fieldTarget}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="default"
                maxHeight={180}
              />

              {needsIndicHint ? (
                <Text style={styles.kbdHint}>
                  {Platform.OS === 'ios'
                    ? 'iOS cannot auto-select Devanagari. Add Nepali (Devanagari) under Settings → General → Keyboard, then switch with the globe key.'
                    : 'Switch to a Nepali/Devanagari keyboard when editing Nepali fields.'}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  style={[styles.correctBtn, saving && styles.btnDisabled]}
                  onPress={() => void commitSample(false)}
                  disabled={saving}
                >
                  <Text style={styles.correctText}>✓ Correct</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryBtn, saving && styles.btnDisabled]}
                  onPress={() => void commitSample(false)}
                  disabled={saving}
                >
                  <Text style={styles.primaryBtnText}>
                    {saving ? 'Saving…' : 'Save & next'}
                  </Text>
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
                  disabled={index >= queue.length - 1}
                  onPress={() => setIndex((i) => Math.min(queue.length - 1, i + 1))}
                >
                  <Text
                    style={[styles.link, index >= queue.length - 1 && styles.disabled]}
                  >
                    Skip →
                  </Text>
                </Pressable>
              </View>
            </>
          )}

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
              App ships phrasebook until adapters pass gates · {goldPack.n_items} pack rows
            </Text>
          </View>

          <View style={styles.catalog}>
            <Text style={styles.catalogTitle}>Dataset trust (for later train pulls)</Text>
            {goldPack.dataset_catalog.map((d) => (
              <Text key={d.id} style={styles.catalogLine}>
                {d.trust.toUpperCase()} · {d.id} — {d.use}
              </Text>
            ))}
          </View>
        </Pressable>
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  meta: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  tapDismiss: {},
  benchCard: {
    marginTop: 22,
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
  idLine: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 2 },
  kindLine: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.crimson,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    marginBottom: 14,
  },
  fieldTarget: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  kbdHint: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
    marginBottom: 12,
    marginTop: -4,
  },
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
  btnDisabled: { opacity: 0.55 },
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
