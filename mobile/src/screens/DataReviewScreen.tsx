import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import { allGoldItems } from '../gold/pack';
import type { GoldReviewItem } from '../gold/types';
import { allMeaningUnits } from '../meaning/pack';
import type { MeaningUnit } from '../meaning/types';
import { romanToDevanagari } from '../mt/romanize';
import {
  completeGoldSend,
  loadGoldReviews,
  saveGoldReviews,
  type GoldReviewMap,
} from '../storage/goldReviews';
import {
  completeMeaningAccept,
  loadMeaningReviews,
  saveMeaningReviews,
  type MeaningReviewMap,
} from '../storage/meaningReviews';
import {
  dropQueuedReviewSync,
  enqueueReviewSync,
  flushReviewSync,
  loadReviewSyncConfig,
  loadReviewSyncStatus,
  saveReviewSyncConfig,
  type ReviewSyncStatus,
} from '../sync/reviewSync';
import { colors } from '../theme';

const REVIEW_PASSWORD = '1234';

type Deck = 'gold' | 'train';
type Props = { onClose: () => void };

type TrainEdits = {
  ne_formal: string;
  ne_informal: string;
  roman_formal: string;
  roman_informal: string;
};

type GoldEdits = { source: string; reference: string; deva: string };

type AutoHeightProps = ComponentProps<typeof TextInput> & {
  maxHeight?: number;
  resetKey?: string;
};

const FIELD_MIN = 72;
const FIELD_MAX_DEFAULT = 160;

function AutoHeightInput({
  style,
  onContentSizeChange,
  value,
  maxHeight = FIELD_MAX_DEFAULT,
  resetKey,
  ...rest
}: AutoHeightProps) {
  const [height, setHeight] = useState(FIELD_MIN);

  useEffect(() => {
    setHeight(FIELD_MIN);
  }, [resetKey]);

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

function goldChanged(item: GoldReviewItem, edits: GoldEdits): boolean {
  return (
    edits.source.trim() !== item.source.trim() ||
    edits.reference.trim() !== item.reference.trim() ||
    edits.deva.trim() !== (item.deva || '').trim()
  );
}

function trainChanged(unit: MeaningUnit, edits: TrainEdits): boolean {
  return (
    edits.ne_formal.trim() !== unit.ne_formal.trim() ||
    edits.ne_informal.trim() !== unit.ne_informal.trim() ||
    edits.roman_formal.trim() !== unit.roman_formal.trim() ||
    edits.roman_informal.trim() !== unit.roman_informal.trim()
  );
}

/**
 * Password-gated review: gold bench first, then training meanings.
 * Send to PC queues + flushes to the laptop review server.
 */
export function DataReviewScreen({ onClose }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [laptopDraft, setLaptopDraft] = useState('');
  const [laptopReady, setLaptopReady] = useState(false);
  const [deck, setDeck] = useState<Deck>('gold');
  const [goldReviews, setGoldReviews] = useState<GoldReviewMap>({});
  const [trainReviews, setTrainReviews] = useState<MeaningReviewMap>({});
  const [index, setIndex] = useState(0);
  const [goldEdits, setGoldEdits] = useState<GoldEdits>({
    source: '',
    reference: '',
    deva: '',
  });
  const [trainEdits, setTrainEdits] = useState<TrainEdits>({
    ne_formal: '',
    ne_informal: '',
    roman_formal: '',
    roman_informal: '',
  });
  const [showCompleted, setShowCompleted] = useState(false);
  const [lastSavedKey, setLastSavedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<ReviewSyncStatus | null>(null);

  const refreshSync = useCallback(async () => {
    setSyncStatus(await loadReviewSyncStatus());
  }, []);

  useEffect(() => {
    void (async () => {
      const [gold, train, cfg] = await Promise.all([
        loadGoldReviews(),
        loadMeaningReviews(),
        loadReviewSyncConfig(),
      ]);
      setGoldReviews(gold);
      setTrainReviews(train);
      setLaptopDraft(cfg.endpointUrl);
      setLaptopReady(Boolean(cfg.endpointUrl.trim()));
      await refreshSync();
    })();
  }, [refreshSync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        void flushReviewSync({ reason: 'app_background' });
      }
    });
    return () => sub.remove();
  }, []);

  const goldQueue = useMemo(() => {
    let items = allGoldItems();
    if (!showCompleted) items = items.filter((i) => !goldReviews[i.id]?.completed_at);
    return items;
  }, [showCompleted, goldReviews]);

  const trainQueue = useMemo(() => {
    let items = allMeaningUnits();
    if (!showCompleted) items = items.filter((i) => !trainReviews[i.meaning_id]?.completed_at);
    return items;
  }, [showCompleted, trainReviews]);

  const queueLen = deck === 'gold' ? goldQueue.length : trainQueue.length;
  const goldItem = goldQueue[Math.min(index, Math.max(goldQueue.length - 1, 0))];
  const trainUnit = trainQueue[Math.min(index, Math.max(trainQueue.length - 1, 0))];

  useEffect(() => {
    setIndex(0);
  }, [showCompleted, deck]);

  useEffect(() => {
    if (!goldItem) {
      setGoldEdits({ source: '', reference: '', deva: '' });
      return;
    }
    const prev = goldReviews[goldItem.id];
    setGoldEdits({
      source: prev?.source_final ?? goldItem.source,
      reference: prev?.reference_final ?? goldItem.reference,
      deva: prev?.deva_final ?? goldItem.deva ?? '',
    });
  }, [goldItem?.id, goldReviews]);

  useEffect(() => {
    if (!trainUnit) {
      setTrainEdits({
        ne_formal: '',
        ne_informal: '',
        roman_formal: '',
        roman_informal: '',
      });
      return;
    }
    const prev = trainReviews[trainUnit.meaning_id];
    setTrainEdits({
      ne_formal: prev?.ne_formal_final ?? trainUnit.ne_formal,
      ne_informal: prev?.ne_informal_final ?? trainUnit.ne_informal,
      roman_formal: prev?.roman_formal_final ?? trainUnit.roman_formal,
      roman_informal: prev?.roman_informal_final ?? trainUnit.roman_informal,
    });
  }, [trainUnit?.meaning_id, trainReviews]);

  useEffect(() => {
    if (!queueLen) {
      setIndex(0);
      return;
    }
    if (index > queueLen - 1) setIndex(queueLen - 1);
  }, [queueLen, index]);

  const goldTotals = useMemo(() => {
    const all = allGoldItems();
    const done = all.filter((i) => goldReviews[i.id]?.completed_at).length;
    return { done, total: all.length };
  }, [goldReviews]);

  const trainTotals = useMemo(() => {
    const all = allMeaningUnits();
    const done = all.filter((i) => trainReviews[i.meaning_id]?.completed_at).length;
    return { done, total: all.length };
  }, [trainReviews]);

  const tryUnlock = () => {
    if (password.trim() === REVIEW_PASSWORD) {
      setUnlocked(true);
      setPassword('');
    } else {
      Alert.alert('Wrong password');
    }
  };

  const saveLaptop = async () => {
    const cfg = await loadReviewSyncConfig();
    const url = laptopDraft.trim();
    if (!url) {
      Alert.alert('Laptop address', 'Enter this PC’s Wi-Fi address, e.g. 192.168.1.42');
      return;
    }
    await saveReviewSyncConfig({ ...cfg, enabled: true, endpointUrl: url });
    const saved = await loadReviewSyncConfig();
    setLaptopDraft(saved.endpointUrl);
    setLaptopReady(Boolean(saved.endpointUrl));
  };

  const sendFlush = async (reason: string) => {
    const result = await flushReviewSync({ reason, force: true });
    await refreshSync();
    return result;
  };

  const persistGold = async (item: GoldReviewItem, confirmAsIs: boolean) => {
    if (saving) return;
    const source = goldEdits.source.trim();
    const reference = goldEdits.reference.trim();
    if (!source || !reference) {
      Alert.alert('Need both sides', 'Source and reference must not be empty.');
      return;
    }
    if (!goldChanged(item, goldEdits) && !confirmAsIs) {
      Alert.alert('Looks correct?', 'Send this gold pair to the PC as-is?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send as-is', onPress: () => void persistGold(item, true) },
      ]);
      return;
    }
    setSaving(true);
    try {
      const review = completeGoldSend(item, {
        source,
        reference,
        deva: goldEdits.deva,
      });
      const map = { ...(await loadGoldReviews()), [item.id]: review };
      await saveGoldReviews(map);
      setGoldReviews(map);
      setLastSavedKey(review.review_key);
      await enqueueReviewSync(review);
      const flush = await sendFlush('after_save');
      if (!flush.ok) {
        Alert.alert(
          'Saved on phone',
          `${flush.error}\nQueued until this PC is reachable. Tap Send pending.`,
        );
      }
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const persistTrain = async (unit: MeaningUnit, confirmAsIs: boolean) => {
    if (saving) return;
    const nf = trainEdits.ne_formal.trim();
    const ni = trainEdits.ne_informal.trim();
    if (!nf && !ni) {
      Alert.alert('Need Nepali', 'Add formal or informal Nepali before sending.');
      return;
    }
    if (!trainChanged(unit, trainEdits) && !confirmAsIs) {
      Alert.alert('Looks correct?', 'Send this training meaning to the PC as-is?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send as-is', onPress: () => void persistTrain(unit, true) },
      ]);
      return;
    }
    setSaving(true);
    try {
      const review = completeMeaningAccept(unit, {
        ne_formal: nf,
        ne_informal: ni,
        roman_formal: trainEdits.roman_formal,
        roman_informal: trainEdits.roman_informal,
      });
      const map = { ...(await loadMeaningReviews()), [unit.meaning_id]: review };
      await saveMeaningReviews(map);
      setTrainReviews(map);
      setLastSavedKey(review.review_key || unit.meaning_id);
      await enqueueReviewSync(review);
      const flush = await sendFlush('after_save');
      if (!flush.ok) {
        Alert.alert(
          'Saved on phone',
          `${flush.error}\nQueued until this PC is reachable. Tap Send pending.`,
        );
      }
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const onSend = () => {
    if (deck === 'gold') {
      if (!goldItem) return;
      void persistGold(goldItem, false);
    } else if (trainUnit) {
      void persistTrain(trainUnit, false);
    }
  };

  const onSendPending = async () => {
    const result = await sendFlush('manual');
    if (result.ok) {
      Alert.alert(
        'Sent to PC',
        result.sent ? `Delivered ${result.sent} review(s).` : 'Nothing pending.',
      );
    } else {
      Alert.alert('Could not reach PC', result.error);
    }
  };

  const undoLast = async () => {
    if (!lastSavedKey) {
      Alert.alert('Nothing to undo');
      return;
    }
    try {
      if (lastSavedKey.startsWith('gold:')) {
        const id = lastSavedKey.slice('gold:'.length);
        const map = await loadGoldReviews();
        delete map[id];
        await saveGoldReviews(map);
        setGoldReviews(map);
      } else {
        const map = await loadMeaningReviews();
        const id = lastSavedKey.replace(/^train:/, '');
        delete map[id];
        await saveMeaningReviews(map);
        setTrainReviews(map);
      }
      await dropQueuedReviewSync(lastSavedKey);
      await refreshSync();
      setLastSavedKey(null);
    } catch (e) {
      Alert.alert('Undo failed', e instanceof Error ? e.message : 'Could not undo.');
    }
  };

  const regenerateNepaliFromRoman = () => {
    const rf = trainEdits.roman_formal.trim();
    const ri = trainEdits.roman_informal.trim();
    if (!rf && !ri) {
      Alert.alert('Need Roman', 'Type Roman first, then regenerate.');
      return;
    }
    setTrainEdits((e) => ({
      ...e,
      ne_formal: rf ? romanToDevanagari(rf) : e.ne_formal,
      ne_informal: ri ? romanToDevanagari(ri) : rf ? romanToDevanagari(rf) : e.ne_informal,
    }));
  };

  const dismissKeyboard = () => Keyboard.dismiss();

  if (!unlocked) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.link}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Data review</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.lockBox}>
          <Text style={styles.lockHint}>Reviewer password</Text>
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

  if (!laptopReady) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.link}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Laptop</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.lockBox}>
          <Text style={styles.lockHint}>
            Same Wi-Fi as this PC. The review server prints the address when it starts.
          </Text>
          <TextInput
            style={styles.address}
            value={laptopDraft}
            onChangeText={setLaptopDraft}
            placeholder="192.168.1.42"
            placeholderTextColor={colors.textPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Pressable style={styles.primaryBtn} onPress={() => void saveLaptop()}>
            <Text style={styles.primaryBtnText}>Save laptop address</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const pending = syncStatus?.pending ?? 0;
  const currentLabel =
    deck === 'gold'
      ? goldItem
        ? goldItem.class_id.replace(/_/g, ' ')
        : 'Done'
      : 'training';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Data review</Text>
          <Text style={styles.progress}>
            Gold {goldTotals.done}/{goldTotals.total} · Train {trainTotals.done}/
            {trainTotals.total}
          </Text>
        </View>
        <Pressable onPress={() => setLaptopReady(false)} hitSlop={8}>
          <Text style={styles.tinyLink}>PC</Text>
        </Pressable>
      </View>

      <View style={styles.deckRow}>
        <Pressable
          style={[styles.deckBtn, deck === 'gold' && styles.deckBtnOn]}
          onPress={() => setDeck('gold')}
        >
          <Text style={[styles.deckText, deck === 'gold' && styles.deckTextOn]}>
            Benchmark
          </Text>
        </Pressable>
        <Pressable
          style={[styles.deckBtn, deck === 'train' && styles.deckBtnOn]}
          onPress={() => setDeck('train')}
        >
          <Text style={[styles.deckText, deck === 'train' && styles.deckTextOn]}>
            Training
          </Text>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <Pressable onPress={() => setShowCompleted((v) => !v)}>
          <Text style={styles.link}>
            {showCompleted ? 'Pending only' : 'Include sent'}
          </Text>
        </Pressable>
        <Pressable onPress={() => void undoLast()}>
          <Text style={styles.link}>Undo</Text>
        </Pressable>
        <Pressable onPress={() => void onSendPending()}>
          <Text style={styles.link}>
            Send pending{pending ? ` (${pending})` : ''}
          </Text>
        </Pressable>
      </View>
      {syncStatus?.lastError ? (
        <Text style={styles.syncError}>PC: {syncStatus.lastError}</Text>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScrollBeginDrag={dismissKeyboard}
      >
        <Pressable style={styles.tapDismiss} onPress={dismissKeyboard}>
          {deck === 'gold' && !goldItem ? (
            <View style={styles.doneCard}>
              <Text style={styles.doneTitle}>Gold bench done</Text>
              <Text style={styles.doneBody}>
                Switch to Training to send meaning-bank pairs. Fair eval comes
                from this gold set — keep it off the train mix.
              </Text>
            </View>
          ) : null}
          {deck === 'train' && !trainUnit ? (
            <View style={styles.doneCard}>
              <Text style={styles.doneTitle}>Training queue done</Text>
              <Text style={styles.doneBody}>
                Sent pairs land in the meaning bank on this PC. Retrain after
                you have a batch you trust.
              </Text>
            </View>
          ) : null}

          {deck === 'gold' && goldItem ? (
            <>
              <Text style={styles.classChip}>{currentLabel}</Text>
              <Text style={styles.fieldLabel}>{goldItem.source_label}</Text>
              <AutoHeightInput
                resetKey={goldItem.id}
                value={goldEdits.source}
                onChangeText={(t) => setGoldEdits((e) => ({ ...e, source: t }))}
                style={styles.fieldTarget}
                maxHeight={160}
              />
              {goldItem.script === 'roman' ? (
                <>
                  <Text style={styles.fieldLabel}>Devanagari (optional)</Text>
                  <AutoHeightInput
                    resetKey={`${goldItem.id}-deva`}
                    value={goldEdits.deva}
                    onChangeText={(t) => setGoldEdits((e) => ({ ...e, deva: t }))}
                    style={styles.fieldTarget}
                    maxHeight={140}
                  />
                </>
              ) : null}
              <Text style={styles.fieldLabel}>{goldItem.target_label}</Text>
              <AutoHeightInput
                resetKey={`${goldItem.id}-ref`}
                value={goldEdits.reference}
                onChangeText={(t) => setGoldEdits((e) => ({ ...e, reference: t }))}
                style={styles.fieldTarget}
                maxHeight={200}
              />
            </>
          ) : null}

          {deck === 'train' && trainUnit ? (
            <>
              <Text style={styles.fieldLabel}>English (read-only)</Text>
              <Text style={styles.englishReadonly}>{trainUnit.english}</Text>
              <Text style={styles.fieldLabel}>Roman formal</Text>
              <AutoHeightInput
                resetKey={trainUnit.meaning_id}
                value={trainEdits.roman_formal}
                onChangeText={(t) => setTrainEdits((e) => ({ ...e, roman_formal: t }))}
                style={styles.fieldTarget}
                maxHeight={140}
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>Roman informal</Text>
              <AutoHeightInput
                resetKey={`${trainUnit.meaning_id}-ri`}
                value={trainEdits.roman_informal}
                onChangeText={(t) => setTrainEdits((e) => ({ ...e, roman_informal: t }))}
                style={styles.fieldTarget}
                maxHeight={140}
                autoCapitalize="none"
              />
              <Pressable style={styles.regenBtn} onPress={regenerateNepaliFromRoman}>
                <Text style={styles.regenText}>Regenerate Nepali from Roman</Text>
              </Pressable>
              <Text style={styles.fieldLabel}>Nepali formal · तपाईं</Text>
              <AutoHeightInput
                resetKey={`${trainUnit.meaning_id}-nf`}
                value={trainEdits.ne_formal}
                onChangeText={(t) => setTrainEdits((e) => ({ ...e, ne_formal: t }))}
                style={styles.fieldTarget}
                maxHeight={200}
              />
              <Text style={styles.fieldLabel}>Nepali informal · तिमी</Text>
              <AutoHeightInput
                resetKey={`${trainUnit.meaning_id}-ni`}
                value={trainEdits.ne_informal}
                onChangeText={(t) => setTrainEdits((e) => ({ ...e, ne_informal: t }))}
                style={styles.fieldTarget}
                maxHeight={200}
              />
            </>
          ) : null}

          {(deck === 'gold' && goldItem) || (deck === 'train' && trainUnit) ? (
            <>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.primaryBtn, saving && styles.btnDisabled]}
                  onPress={onSend}
                  disabled={saving}
                >
                  <Text style={styles.primaryBtnText}>Send to PC</Text>
                </Pressable>
                <Pressable
                  style={[styles.skipBtn, saving && styles.btnDisabled]}
                  onPress={() => setIndex((i) => Math.min(queueLen - 1, i + 1))}
                  disabled={saving || index >= queueLen - 1}
                >
                  <Text style={styles.skipText}>Later</Text>
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
                  onPress={() => setIndex((i) => Math.min(queueLen - 1, i + 1))}
                  disabled={index >= queueLen - 1}
                  style={index >= queueLen - 1 ? styles.disabled : undefined}
                >
                  <Text style={styles.link}>Next</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  tinyLink: { fontSize: 13, fontWeight: '700', color: colors.crimson },
  disabled: { opacity: 0.35 },
  lockBox: { marginTop: 36, paddingHorizontal: 28, gap: 14 },
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
  address: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    textAlign: 'center',
    color: colors.text,
  },
  deckRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  deckBtn: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  deckBtnOn: { backgroundColor: colors.crimson },
  deckText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  deckTextOn: { color: '#fff' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  syncError: {
    marginHorizontal: 16,
    marginBottom: 6,
    fontSize: 12,
    color: colors.danger,
  },
  classChip: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.mintBg,
    color: colors.forest,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  meta: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  tapDismiss: {},
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 140 },
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
  regenBtn: {
    alignSelf: 'flex-start',
    marginTop: -4,
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.mintBg,
    borderWidth: 1,
    borderColor: colors.forestSoft,
  },
  regenText: { fontSize: 13, fontWeight: '700', color: colors.forest },
  actions: { gap: 10, marginTop: 8, marginBottom: 24 },
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
    marginTop: 8,
    marginBottom: 24,
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
