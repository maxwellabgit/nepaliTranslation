import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  Alert,
  Keyboard,
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
import { allMeaningUnits } from '../meaning/pack';
import type { MeaningUnit } from '../meaning/types';
import {
  buildMeaningExportPayload,
  completeMeaningAccept,
  completeMeaningSkip,
  loadMeaningReviews,
  saveMeaningReviews,
  type MeaningReview,
  type MeaningReviewMap,
} from '../storage/meaningReviews';
import { colors } from '../theme';

const REVIEW_PASSWORD = '1234';

type Props = {
  onClose: () => void;
};

type FieldEdits = {
  ne_formal: string;
  ne_informal: string;
  roman_formal: string;
  roman_informal: string;
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

function sampleCompleted(unit: MeaningUnit, reviews: MeaningReviewMap): boolean {
  return Boolean(reviews[unit.meaning_id]?.completed_at);
}

function hasEdits(unit: MeaningUnit, edits: FieldEdits): boolean {
  return (
    edits.ne_formal.trim() !== unit.ne_formal.trim() ||
    edits.ne_informal.trim() !== unit.ne_informal.trim() ||
    edits.roman_formal.trim() !== unit.roman_formal.trim() ||
    edits.roman_informal.trim() !== unit.roman_informal.trim()
  );
}

/**
 * Meaning-unit review: English read-only; Accept all / Skip only.
 * Skip auto-flags for founder review.
 */
export function MeaningReviewScreen({ onClose }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [reviews, setReviews] = useState<MeaningReviewMap>({});
  const [index, setIndex] = useState(0);
  const [edits, setEdits] = useState<FieldEdits>({
    ne_formal: '',
    ne_informal: '',
    roman_formal: '',
    roman_informal: '',
  });
  const [showCompleted, setShowCompleted] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadMeaningReviews().then(setReviews);
  }, []);

  const queue = useMemo(() => {
    let items = allMeaningUnits();
    if (!showCompleted) items = items.filter((i) => !sampleCompleted(i, reviews));
    return items;
  }, [showCompleted, reviews]);

  const unit: MeaningUnit | undefined =
    queue[Math.min(index, Math.max(queue.length - 1, 0))];

  useEffect(() => {
    setIndex(0);
  }, [showCompleted]);

  useEffect(() => {
    if (!unit) {
      setEdits({
        ne_formal: '',
        ne_informal: '',
        roman_formal: '',
        roman_informal: '',
      });
      return;
    }
    const rev = reviews[unit.meaning_id];
    setEdits({
      ne_formal: rev?.ne_formal_final ?? unit.ne_formal,
      ne_informal: rev?.ne_informal_final ?? unit.ne_informal,
      roman_formal: rev?.roman_formal_final ?? unit.roman_formal,
      roman_informal: rev?.roman_informal_final ?? unit.roman_informal,
    });
  }, [unit?.meaning_id, reviews]);

  useEffect(() => {
    if (!queue.length) {
      setIndex(0);
      return;
    }
    if (index > queue.length - 1) setIndex(queue.length - 1);
  }, [queue.length, index]);

  const totals = useMemo(() => {
    const all = allMeaningUnits();
    const done = all.filter((i) => sampleCompleted(i, reviews)).length;
    const edited = Object.values(reviews).filter((r) => r.action === 'edited').length;
    const skipped = Object.values(reviews).filter((r) => r.action === 'skipped').length;
    return { done, total: all.length, edited, skipped };
  }, [reviews]);

  const tryUnlock = () => {
    if (password.trim() === REVIEW_PASSWORD) {
      setUnlocked(true);
      setPassword('');
    } else {
      Alert.alert('Wrong password');
    }
  };

  const persistOne = useCallback(
    async (review: MeaningReview) => {
      if (saving) return;
      setSaving(true);
      try {
        const map = await loadMeaningReviews();
        map[review.meaning_id] = review;
        await saveMeaningReviews(map);
        setReviews(map);
        setLastSavedId(review.meaning_id);
      } catch (e) {
        Alert.alert(
          'Save failed',
          e instanceof Error ? e.message : 'Could not save review on this device.',
        );
      } finally {
        setSaving(false);
      }
    },
    [saving],
  );

  const doAccept = async () => {
    if (!unit || saving) return;
    const nf = edits.ne_formal.trim();
    const ni = edits.ne_informal.trim();
    if (!nf && !ni) {
      Alert.alert('Need Nepali', 'Add at least formal or informal Nepali before accepting.');
      return;
    }
    const review = completeMeaningAccept(unit, {
      ne_formal: nf,
      ne_informal: ni,
      roman_formal: edits.roman_formal,
      roman_informal: edits.roman_informal,
    });
    await persistOne(review);
  };

  const onAcceptAll = () => {
    if (!unit || saving) return;
    if (!hasEdits(unit, edits)) {
      Alert.alert(
        'No edits made',
        'No edits made, everything looks correct?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, accept', onPress: () => void doAccept() },
        ],
      );
      return;
    }
    void doAccept();
  };

  const onSkip = () => {
    if (!unit || saving) return;
    void persistOne(completeMeaningSkip(unit));
  };

  const undoLast = async () => {
    if (!lastSavedId) {
      Alert.alert('Nothing to undo');
      return;
    }
    try {
      const map = await loadMeaningReviews();
      delete map[lastSavedId];
      await saveMeaningReviews(map);
      setReviews(map);
      setLastSavedId(null);
    } catch (e) {
      Alert.alert(
        'Undo failed',
        e instanceof Error ? e.message : 'Could not undo on this device.',
      );
    }
  };

  const exportReviews = async () => {
    const payload = buildMeaningExportPayload(reviews);
    const text = JSON.stringify(payload, null, 2);
    try {
      await Share.share({
        message: text,
        title: `NepTranslate meaning reviews (${payload.n_completed})`,
      });
    } catch {
      await Clipboard.setStringAsync(text);
      Alert.alert(
        'Copied',
        `${payload.n_completed} reviews on clipboard.\nPC: python training/route_corrections.py <file>`,
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
          <Text style={styles.title}>Meaning Review</Text>
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
          <Text style={styles.title}>Meaning Review</Text>
          <Text style={styles.progress}>
            {totals.done} reviewed
            {totals.edited ? ` · ${totals.edited} edited` : ''}
            {totals.skipped ? ` · ${totals.skipped} flagged` : ''}
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
        <Pressable onPress={() => void undoLast()}>
          <Text style={styles.link}>Undo</Text>
        </Pressable>
        <Text style={styles.meta}>
          {queue.length ? `Next up` : 'Done'}
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
                {showCompleted ? 'No meanings' : 'Queue complete'}
              </Text>
              <Text style={styles.doneBody}>
                Export reviews, then on PC run:{'\n'}
                python training/route_corrections.py &lt;export.json&gt;
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.idLine}>{unit.meaning_id}</Text>
              <Text style={styles.kindLine}>{unit.surface}</Text>
              <Text style={styles.prov}>{unit.provenance}</Text>

              <Text style={styles.fieldLabel}>English (read-only)</Text>
              <Text style={styles.englishReadonly}>{unit.english}</Text>

              <Text style={styles.fieldLabel}>Nepali formal · तपाईं</Text>
              <AutoHeightInput
                value={edits.ne_formal}
                onChangeText={(t) => setEdits((e) => ({ ...e, ne_formal: t }))}
                style={styles.fieldTarget}
                maxHeight={200}
              />

              <Text style={styles.fieldLabel}>Nepali informal · तिमी</Text>
              <AutoHeightInput
                value={edits.ne_informal}
                onChangeText={(t) => setEdits((e) => ({ ...e, ne_informal: t }))}
                style={styles.fieldTarget}
                maxHeight={200}
              />

              <Text style={styles.fieldLabel}>Roman formal</Text>
              <AutoHeightInput
                value={edits.roman_formal}
                onChangeText={(t) => setEdits((e) => ({ ...e, roman_formal: t }))}
                style={styles.fieldTarget}
                maxHeight={140}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Roman informal</Text>
              <AutoHeightInput
                value={edits.roman_informal}
                onChangeText={(t) => setEdits((e) => ({ ...e, roman_informal: t }))}
                style={styles.fieldTarget}
                maxHeight={140}
                autoCapitalize="none"
              />

              <View style={styles.actions}>
                <Pressable
                  style={[styles.primaryBtn, saving && styles.btnDisabled]}
                  onPress={onAcceptAll}
                  disabled={saving}
                >
                  <Text style={styles.primaryBtnText}>Accept all</Text>
                </Pressable>
                <Pressable
                  style={[styles.skipBtn, saving && styles.btnDisabled]}
                  onPress={onSkip}
                  disabled={saving}
                >
                  <Text style={styles.skipText}>Skip · flag for my review</Text>
                </Pressable>
              </View>

              <View style={styles.navRow}>
                <Pressable
                  onPress={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index <= 0}
                  style={index <= 0 ? styles.disabled : undefined}
                >
                  <Text style={styles.link}>Prev</Text>
                </Pressable>
                <Pressable
                  onPress={() => setIndex((i) => Math.min(queue.length - 1, i + 1))}
                  disabled={index >= queue.length - 1}
                  style={index >= queue.length - 1 ? styles.disabled : undefined}
                >
                  <Text style={styles.link}>Next</Text>
                </Pressable>
              </View>
            </>
          )}
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
  lockBox: { marginTop: 48, paddingHorizontal: 28, gap: 14 },
  lockHint: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  idLine: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  kindLine: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.crimson,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  prov: { fontSize: 12, color: colors.forest, marginBottom: 12 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.crimson,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  englishReadonly: {
    backgroundColor: colors.pasteBg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textSecondary,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
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
  actions: { gap: 10, marginTop: 4 },
  primaryBtn: {
    backgroundColor: colors.crimson,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  skipBtn: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  skipText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
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
  doneTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  doneBody: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
});
