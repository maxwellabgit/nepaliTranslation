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
  REVIEW_LANES,
  allReviewUnits,
  unitsForLane,
  type ReviewLane,
  type ReviewUnit,
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

type PairEdits = {
  shared: string;
  left: string;
  right: string;
};

type AutoHeightProps = ComponentProps<typeof TextInput>;

/** Multiline field that grows with phrase length instead of a fixed tall box. */
function AutoHeightInput({ style, onContentSizeChange, value, ...rest }: AutoHeightProps) {
  const [height, setHeight] = useState(36);

  useEffect(() => {
    // Reset when navigating to a shorter phrase so the box shrinks.
    setHeight(36);
  }, [value]);

  const handleSize = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const next = Math.ceil(e.nativeEvent.contentSize.height);
    setHeight(Math.max(36, next));
    onContentSizeChange?.(e);
  };

  return (
    <TextInput
      {...rest}
      value={value}
      multiline
      textAlignVertical="top"
      scrollEnabled={false}
      onContentSizeChange={handleSize}
      style={[styles.field, style, { height: height + 28 }]}
    />
  );
}

function unitCompleted(unit: ReviewUnit, reviews: ReviewMap): boolean {
  if (!unit.itemIds.length) return false;
  return unit.itemIds.every((id) => Boolean(reviews[id]?.completed_at));
}

function unitPending(unit: ReviewUnit, reviews: ReviewMap, showCompleted: boolean): boolean {
  return showCompleted || !unitCompleted(unit, reviews);
}

/**
 * Password-gated human gold review — paired formal/informal + Deva/Roman cards.
 */
export function GoldReviewScreen({ onClose }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [lane, setLane] = useState<ReviewLane>('en_ne');
  const [reviews, setReviews] = useState<ReviewMap>({});
  const [index, setIndex] = useState(0);
  const [edits, setEdits] = useState<PairEdits>({ shared: '', left: '', right: '' });
  const [showCompleted, setShowCompleted] = useState(false);
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [lastUndoneIds, setLastUndoneIds] = useState<string[]>([]);

  useEffect(() => {
    void loadReviews().then(setReviews);
  }, []);

  const laneUnits = useMemo(() => {
    let units = unitsForLane(lane);
    if (premiumOnly) {
      units = units.filter((u) => {
        const items = [u.left, u.right].filter(Boolean) as GoldItem[];
        return items.some(
          (i) =>
            i.provenance.trust === 'gold' ||
            i.provenance.trust === 'high' ||
            i.provenance.tier === 'premium' ||
            i.provenance.tier === 'premium_word_choice',
        );
      });
    }
    return units;
  }, [lane, premiumOnly]);

  const pending = useMemo(
    () => laneUnits.filter((u) => unitPending(u, reviews, showCompleted)),
    [laneUnits, reviews, showCompleted],
  );

  const unit: ReviewUnit | undefined = pending[Math.min(index, Math.max(pending.length - 1, 0))];

  useEffect(() => {
    setIndex(0);
  }, [lane, showCompleted, premiumOnly]);

  useEffect(() => {
    if (!unit) {
      setEdits({ shared: '', left: '', right: '' });
      return;
    }
    const leftRev = unit.left ? reviews[unit.left.id] : undefined;
    const rightRev = unit.right ? reviews[unit.right.id] : undefined;

    let shared = unit.shared;
    if (unit.lane === 'en_ne') {
      shared =
        leftRev?.source_final ??
        rightRev?.source_final ??
        unit.left?.source ??
        unit.right?.source ??
        '';
    } else {
      shared =
        leftRev?.reference_final ??
        rightRev?.reference_final ??
        unit.left?.reference ??
        unit.right?.reference ??
        '';
    }

    const leftText =
      unit.lane === 'en_ne'
        ? (leftRev?.reference_final ?? unit.left?.reference ?? '')
        : (leftRev?.source_final ?? unit.left?.source ?? '');
    const rightText =
      unit.lane === 'en_ne'
        ? (rightRev?.reference_final ?? unit.right?.reference ?? '')
        : (rightRev?.source_final ?? unit.right?.source ?? '');

    setEdits({ shared, left: leftText, right: rightText });
  }, [unit?.id, reviews]);

  const totals = useMemo(() => {
    const all = allReviewUnits();
    const done = all.filter((u) => unitCompleted(u, reviews)).length;
    return { done, total: all.length, items: goldPack.n_items };
  }, [reviews]);

  const laneDone = useMemo(
    () => laneUnits.filter((u) => unitCompleted(u, reviews)).length,
    [laneUnits, reviews],
  );

  const tryUnlock = () => {
    if (password.trim() === REVIEW_PASSWORD) {
      setUnlocked(true);
      setPassword('');
    } else {
      Alert.alert('Wrong password');
    }
  };

  const persistMany = useCallback(async (nextReviews: GoldReview[]) => {
    const map = await loadReviews();
    for (const review of nextReviews) {
      map[review.id] = review;
    }
    await saveReviews(map);
    setReviews(map);
    setLastUndoneIds(nextReviews.map((r) => r.id));
  }, []);

  const buildPairReviews = (action: 'correct' | 'edited'): GoldReview[] | null => {
    if (!unit) return null;
    const shared = edits.shared.trim();
    const leftVal = edits.left.trim();
    const rightVal = edits.right.trim();
    if (!shared) {
      Alert.alert('English required');
      return null;
    }
    if (unit.left && !leftVal) {
      Alert.alert(`${unit.leftLabel} required`);
      return null;
    }
    if (unit.right && !rightVal) {
      Alert.alert(`${unit.rightLabel} required`);
      return null;
    }

    const out: GoldReview[] = [];
    if (unit.left) {
      const src = unit.lane === 'en_ne' ? shared : leftVal;
      const ref = unit.lane === 'en_ne' ? leftVal : shared;
      const multi = isMultiSentence(src) || isMultiSentence(ref);
      out.push(
        completeFromItem(unit.left, src, ref, {
          multi_sentence_flag: multi || undefined,
        }),
      );
    }
    if (unit.right) {
      const src = unit.lane === 'en_ne' ? shared : rightVal;
      const ref = unit.lane === 'en_ne' ? rightVal : shared;
      const multi = isMultiSentence(src) || isMultiSentence(ref);
      out.push(
        completeFromItem(unit.right, src, ref, {
          multi_sentence_flag: multi || undefined,
        }),
      );
    }
    if (action === 'correct') {
      // completeFromItem already sets accepted vs edited from content diff
    }
    return out;
  };

  const markCorrect = async () => {
    const built = buildPairReviews('correct');
    if (!built?.length) return;
    const multi = built.some((r) => r.multi_sentence_flag);
    if (multi) {
      Alert.alert(
        'Multi-sentence pair',
        'Fine-tuning is sentence-level. Prefer Split when both sides align, or edit down to one sentence.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Accept anyway',
            onPress: () => void persistMany(built),
          },
        ],
      );
      return;
    }
    await persistMany(built);
  };

  const markCompleteEdits = async () => {
    const built = buildPairReviews('edited');
    if (!built?.length) return;
    await persistMany(built);
  };

  const splitAligned = async () => {
    if (!unit?.left && !unit?.right) return;
    // Split only applies cleanly to a single item; prefer left then right.
    const item = unit.left ?? unit.right!;
    const src =
      unit.lane === 'en_ne' ? edits.shared || item.source : edits.left || item.source;
    const ref =
      unit.lane === 'en_ne'
        ? (unit.left ? edits.left : edits.right) || item.reference
        : edits.shared || item.reference;
    const pairs = suggestAlignedSplits(src, ref);
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
    const ids = lastUndoneIds;
    if (!ids.length) {
      Alert.alert('Nothing to undo');
      return;
    }
    const map = await loadReviews();
    for (const id of ids) {
      delete map[id];
    }
    await saveReviews(map);
    setReviews(map);
    setLastUndoneIds([]);
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
    Boolean(unit) &&
    (isMultiSentence(edits.shared) ||
      isMultiSentence(edits.left) ||
      isMultiSentence(edits.right));

  const primaryItem = unit?.left ?? unit?.right;
  const splitPairs =
    unit && primaryItem
      ? suggestAlignedSplits(
          unit.lane === 'en_ne' ? edits.shared : edits.left || edits.right,
          unit.lane === 'en_ne' ? edits.left || edits.right : edits.shared,
        )
      : null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Gold Review</Text>
          <Text style={styles.progress}>
            {totals.done}/{totals.total} units · {laneDone}/{laneUnits.length} this lane ·{' '}
            {totals.items} rows
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
        keyboardShouldPersistTaps="handled"
      >
        {REVIEW_LANES.map((l) => {
          const units = unitsForLane(l.id);
          const d = units.filter((u) => unitCompleted(u, reviews)).length;
          const on = l.id === lane;
          return (
            <Pressable
              key={l.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setLane(l.id)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{l.label}</Text>
              <Text style={[styles.chipSub, on && styles.chipTextOn]}>
                {d}/{units.length}
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissKeyboard}
      >
        <Pressable style={styles.tapDismiss} onPress={dismissKeyboard}>
          {!unit ? (
            <View style={styles.doneCard}>
              <Text style={styles.doneTitle}>
                {showCompleted ? 'No rows in this lane' : 'Lane complete'}
              </Text>
              <Text style={styles.doneBody}>
                {totals.done >= totals.total
                  ? 'All gold reviewed. Export → apply_app_reviews.py → pack_gold_for_app.py.'
                  : 'Pick the other lane, or Export completed reviews.'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.idLine}>
                {unit.itemIds.join(' · ')}
                {unit.left && unit.right ? ' · paired' : ' · solo'}
              </Text>
              {primaryItem ? (
                <Text style={styles.prov}>
                  {primaryItem.provenance.dataset_id} · trust {primaryItem.provenance.trust}
                  {primaryItem.provenance.note ? ` · ${primaryItem.provenance.note}` : ''}
                </Text>
              ) : null}
              <Text style={styles.windowHint}>
                FT window ~{IT2_WINDOW.fineTuneMaxLength} tok (model max{' '}
                {IT2_WINDOW.maxSourcePositions}) · prefer one sentence · approve both variants
                together
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

              <Text style={styles.fieldLabel}>{unit.sharedLabel}</Text>
              <AutoHeightInput
                value={edits.shared}
                onChangeText={(t) => setEdits((e) => ({ ...e, shared: t }))}
                autoCapitalize="sentences"
              />

              <View style={styles.pairRow}>
                {unit.left ? (
                  <View style={styles.pairCol}>
                    <Text style={styles.fieldLabel}>{unit.leftLabel}</Text>
                    <AutoHeightInput
                      value={edits.left}
                      onChangeText={(t) => setEdits((e) => ({ ...e, left: t }))}
                      style={styles.fieldTarget}
                      autoCorrect={false}
                      autoCapitalize="none"
                      // iOS cannot force Devanagari; keep default keyboard so the
                      // user's last Indic layout can surface when enabled.
                      keyboardType="default"
                    />
                  </View>
                ) : null}
                {unit.right ? (
                  <View style={styles.pairCol}>
                    <Text style={styles.fieldLabel}>{unit.rightLabel}</Text>
                    <AutoHeightInput
                      value={edits.right}
                      onChangeText={(t) => setEdits((e) => ({ ...e, right: t }))}
                      style={styles.fieldTarget}
                      autoCorrect={false}
                      autoCapitalize="none"
                      keyboardType="default"
                    />
                  </View>
                ) : null}
              </View>

              {unit.lane === 'ne_en' && unit.left ? (
                <Text style={styles.kbdHint}>
                  {Platform.OS === 'ios'
                    ? 'iOS cannot auto-select Devanagari. Add Nepali (Devanagari) under Settings → General → Keyboard, then switch with the globe key when editing the left field.'
                    : 'Android cannot force an Indic IME from the app. Switch to a Nepali/Devanagari keyboard when editing the left field.'}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Pressable style={styles.correctBtn} onPress={() => void markCorrect()}>
                  <Text style={styles.correctText}>
                    ✓ Correct {unit.left && unit.right ? 'both' : ''}
                  </Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={() => void markCompleteEdits()}>
                  <Text style={styles.primaryBtnText}>
                    Save & complete {unit.left && unit.right ? 'both' : ''}
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
                  disabled={index >= pending.length - 1}
                  onPress={() => setIndex((i) => Math.min(pending.length - 1, i + 1))}
                >
                  <Text
                    style={[styles.link, index >= pending.length - 1 && styles.disabled]}
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
              Formal register OK {(100 * (benchSnapshot.classes[0].register_ok ?? 0)).toFixed(0)}% ·
              Informal {(100 * (benchSnapshot.classes[1].register_ok ?? 0)).toFixed(0)}% · App ships
              phrasebook until adapters pass gates
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
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
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
  tapDismiss: { flexGrow: 1 },
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    marginBottom: 14,
  },
  fieldTarget: {},
  pairRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  pairCol: { flex: 1, minWidth: 0 },
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
