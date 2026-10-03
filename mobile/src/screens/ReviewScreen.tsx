import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../features/auth/AuthProvider';
import {
  deliverSampleProgress,
  recordCompletedSample,
} from '../features/contribution/sampleAllotment';
import {
  fetchCurrentReviewWindow,
  submitReview,
  type ReviewItem,
  type ReviewSubmitAction,
} from '../features/contribution/publicReviewApi';
import {
  REVIEW_CATEGORY_ORDER,
  creditAwardDeadline,
  firstUnsubmittedIn,
  formatCountdown,
  groupReviewItems,
  comparisonChoices,
  judgmentToSubmit,
  responseCompletesQuestion,
  type ReviewCategoryId,
  type ReviewJudgment,
} from '../features/contribution/reviewFlow';
import { BackArrow } from '../components/BackArrow';
import { AppButton } from '../components/AppPrimitives';
import { REVIEW_CATEGORY_FACE, ReviewCategoryImage } from './reviewCategoryArt';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';
import {
  readReviewProgress,
  writeReviewProgress,
} from '../features/contribution/reviewProgress';
import {
  loadReviewDay,
  markCategoryCleared,
  markExtraBegun,
  markReviewed,
  markSampleSeen,
  selectReviewSet,
} from '../features/contribution/reviewDayStore';
import { captureReviewResponse, readReviewResponses, flushReviewResponses, type ReviewResponse } from '../features/contribution/reviewResponses';
import { globalDayIndex, hasExtraSet, type ReviewDayState } from '../features/contribution/reviewDayPlan';
import { REVIEW_DAYS } from '../features/contribution/reviewRoster';

/**
 * Today's 10. Pick a working-from category, type a blind translation, then
 * choose which line is better. Answers remain editable and extras stay local.
 */

const ANSWER_LIMIT = 200;

const REVIEW_DISPLAY_FONTS = {
  'PlusJakarta-Regular': require('../../assets/fonts/PlusJakartaSans-Regular.ttf'),
  'PlusJakarta-Bold': require('../../assets/fonts/PlusJakartaSans-Bold.ttf'),
  'PlusJakarta-ExtraBold': require('../../assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
};

type OverlayProps = {
  onClose: () => void;
};

type Status = 'idle' | 'loading' | 'ready' | 'submitting' | 'error';

type Phase = 'intro' | 'compose' | 'compare' | 'thanks';

type ErrorReason =
  | 'unavailable'
  | 'sign_in'
  | 'consent_required'
  | 'flag_disabled'
  | 'window_closed'
  | 'already_submitted'
  | 'invalid';

export function ReviewScreen({ onClose }: OverlayProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const lang = useUiLang();
  const auth = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [closeAt, setCloseAt] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<ErrorReason | null>(null);
  const [correction, setCorrection] = useState('');
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('intro');
  const [category, setCategory] = useState<ReviewCategoryId | null>(null);
  const [judgment, setJudgment] = useState<ReviewJudgment | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [displayFont, setDisplayFont] = useState(false);
  const [progressReady, setProgressReady] = useState(false);
  const [responses, setResponses] = useState<ReviewResponse[]>([]);
  const [dayState, setDayState] = useState<ReviewDayState | null>(null);
  const [editingSet, setEditingSet] = useState(false);
  const [resolvedOwner, setResolvedOwner] = useState<string | null | undefined>(undefined);
  const ownerRef = useRef<string | null>(null);
  ownerRef.current = auth.status === 'signed-in' ? auth.userId : null;
  const refreshGeneration = useRef(0);
  const mounted = useRef(true);
  const drafts = useRef<Record<string, string>>({});
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; refreshGeneration.current += 1; }; }, []);

  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    setStatus('loading');
    setError(null);
    const ownerUserId = auth.status === 'signed-in' ? auth.userId : null;
    const generation = ++refreshGeneration.current;
    const isCurrent = () => mounted.current && refreshGeneration.current === generation && ownerRef.current === ownerUserId;
    const res = await fetchCurrentReviewWindow(ownerUserId);
    if (!isCurrent()) return;
    drafts.current = {};
    if (!res.ok) {
      setResolvedOwner(ownerUserId);
      setError(res.reason);
      setStatus('error');
      return;
    }
    const loaded = res.items ?? [];
    const restored = res.mine ?? [];
    const loadedWindowId = res.window?.window_id ?? null;
    const saved = await readReviewProgress(new Date());
    const history = (await readReviewResponses()).filter((row) => row.userId === null || row.userId === ownerUserId);
    const day = await loadReviewDay();
    if (!isCurrent()) return;
    const reviewed = new Set(restored.filter((row) => responseCompletesQuestion(row.action, row.corrected_text)).map((row) => row.source_item_id));
    if (saved && loadedWindowId && saved.windowId === loadedWindowId) {
      // Migrate completion from actual answers rather than old skip-counting IDs.
      for (const row of history) if (row.windowId === loadedWindowId && responseCompletesQuestion(row.action, row.answer)) reviewed.add(row.sourceItemId);
    }
    setWindowId(loadedWindowId);
    setCloseAt(res.window?.ny_close_at ?? null);
    setItems(loaded);
    setReviewedIds(reviewed);
    setDayState(day);
    setResponses(history);
    setProgressReady(true);
    setPhase('intro');
    setCategory(null);
    setCursor(0);
    setCorrection('');
    setJudgment(null);
    setStatus('ready');
    setResolvedOwner(ownerUserId);
  }, [auth.status, auth.userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => { void flushReviewResponses(auth.status === 'signed-in' ? auth.userId : null).catch(() => undefined); }, [auth.status, auth.userId]);

  useEffect(() => {
    let cancelled = false;
    void Font.loadAsync(REVIEW_DISPLAY_FONTS).then(() => {
      if (!cancelled) setDisplayFont(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!progressReady || !windowId) return;
    void writeReviewProgress({
      windowId,
      closeAt,
      reviewedIds: [...reviewedIds],
      now: new Date(),
    });
  }, [progressReady, windowId, closeAt, reviewedIds]);

  useEffect(() => {
    if (phase !== 'thanks') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const grouped = useMemo(() => groupReviewItems(items), [items]);
  const activeList = useMemo(
    () => (category ? grouped[category] : []),
    [category, grouped],
  );
  const active = activeList[cursor] ?? null;
  useEffect(() => {
    if (editingSet && active) setCorrection(drafts.current[active.source_item_id] ?? responses.filter((r) => r.sourceItemId === active.source_item_id && r.action !== 'skip').at(-1)?.answer ?? '');
  }, [active, editingSet, responses]);

  const startExtra = useCallback(
    async (id: ReviewCategoryId) => {
      if (!grouped[id].length || !grouped[id].every((item) => reviewedIds.has(item.source_item_id))) return;
      await markExtraBegun(id);
      await refresh();
    },
    [refresh, grouped, reviewedIds],
  );


  const openCategory = useCallback(
    (id: ReviewCategoryId) => {
      const list = grouped[id];
      const index = firstUnsubmittedIn(list, reviewedIds);
      if (!list.length) return;
      setEditingSet(index < 0);
      setCategory(id);
      setCursor(index < 0 ? 0 : index);
      const target = list[index < 0 ? 0 : index];
      setCorrection(drafts.current[target.source_item_id] ?? (index < 0 ? responses.filter((r) => r.sourceItemId === target.source_item_id).at(-1)?.answer ?? '' : ''));
      setJudgment(null);
      setError(null);
      setPhase('compose');
      void markSampleSeen();
    },
    [grouped, reviewedIds, responses],
  );

  const advanceAfter = useCallback(
    (doneId: string, completed: boolean) => {
      const nextDone = new Set(reviewedIds);
      if (completed) nextDone.add(doneId);
      setReviewedIds(nextDone);
      const allDone = activeList.every((item) => nextDone.has(item.source_item_id));
      const next = editingSet && cursor + 1 < activeList.length ? cursor + 1 : activeList.findIndex(
        (item, index) => index > cursor && !nextDone.has(item.source_item_id),
      );
      const fallback = activeList.findIndex((item) => !nextDone.has(item.source_item_id));
      const target = next < 0 ? fallback : next;
      setCorrection(editingSet && target >= 0 ? responses.filter((r) => r.sourceItemId === activeList[target].source_item_id).at(-1)?.answer ?? '' : '');
      setJudgment(null);
      setCursor(target < 0 ? cursor : target);
      setPhase(next < 0 && allDone ? 'thanks' : 'compose');
      if (completed) void markReviewed(doneId);
      if (next < 0 && allDone && category) {
        void markCategoryCleared(category);
      }
    },
    [activeList, category, cursor, reviewedIds, editingSet, responses],
  );

  const send = useCallback(
    async (action: ReviewSubmitAction, correctedText?: string) => {
      if (!windowId || !active) return;
      const ownerUserId = auth.status === 'signed-in' ? auth.userId : null;
      const generation = refreshGeneration.current;
      const isCurrent = () => mounted.current && generation === refreshGeneration.current && ownerRef.current === ownerUserId;
      setStatus('submitting');
      setError(null);
      const res = await submitReview({
        windowId,
        sourceItemId: active.source_item_id,
        action,
        correctedText,
      });
      if (!isCurrent()) return;
      if (!res.ok) {
        setStatus('ready');
        setError(res.reason as ErrorReason);
        return;
      }
      try {
        const row = await captureReviewResponse({ windowId, item: active, action, answer: correction, correctedText, userId: ownerUserId, consentVersion: auth.consentVersion, ageConfirmed: auth.ageConfirmed, deletionDueAt: auth.deletionDueAt, isCurrent });
        if (!isCurrent()) return;
        setResponses((rows) => [...rows, row]);
      } catch { if (isCurrent()) { setStatus('ready'); setError('unavailable'); } return; }
      void flushReviewResponses(auth.status === 'signed-in' ? auth.userId : null).catch(() => undefined);
      setStatus('ready');
      if (action === 'confirm' || action === 'edit') {
        const userId = auth.status === 'signed-in' ? auth.userId : null;
        void recordCompletedSample({
          sampleId: active.source_item_id,
          userId,
        }).then((state) => {
          if (state.pendingDelivery?.userId) {
            void deliverSampleProgress(state.pendingDelivery.userId);
          }
        });
      }
      advanceAfter(active.source_item_id, responseCompletesQuestion(action, correction));
    },
    [active, advanceAfter, auth.status, auth.userId, auth.consentVersion, auth.ageConfirmed, auth.deletionDueAt, windowId, correction],
  );

  const backToSets = useCallback(() => {
    if (status === 'submitting') return;
    if (dayState && globalDayIndex(Date.now()) > dayState.heldDay) { void refresh(); return; }
    setPhase('intro');
    setCategory(null);
    setCorrection('');
    setJudgment(null);
    setError(null);
  }, [dayState, refresh, status]);

  const backWithinSet = useCallback(() => {
    if (status === 'submitting') return;
    setError(null);
    setJudgment(null);
    if (phase === 'compare') { setPhase('compose'); return; }
    if (cursor === 0) { backToSets(); return; }
    const previous = activeList[cursor - 1];
    if (!previous) return;
    setEditingSet(true);
    setCursor(cursor - 1);
    setCorrection(drafts.current[previous.source_item_id] ?? responses.filter((row) => row.sourceItemId === previous.source_item_id && row.action !== 'skip').at(-1)?.answer ?? '');
    setPhase('compose');
  }, [activeList, backToSets, cursor, phase, responses, status]);

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
        column: {
          flex: 1,
          paddingTop: 4,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: Math.max(insets.bottom, theme.spacing.md),
        },
        scroll: { flex: 1 },
        header: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
        headerSide: { width: 44, alignItems: 'center', justifyContent: 'center' },
        titlePill: { flex: 1, alignItems: 'center' },
        titleChip: {
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
        },
        title: {
          fontSize: 20,
          fontWeight: '700',
          color: theme.scheme === 'dark' ? theme.colors.saffron : '#8A6A32',
        },
        introTitle: {
          fontFamily: displayFont ? 'PlusJakarta-ExtraBold' : undefined,
          fontSize: 28,
          fontWeight: displayFont ? '400' : '800',
          color: theme.colors.text,
          textAlign: 'center',
        },
        introSub: {
          fontFamily: displayFont ? 'PlusJakarta-Regular' : undefined,
          marginTop: 4,
          fontSize: 14,
          fontWeight: '400',
          color: theme.colors.textSecondary,
          textAlign: 'center',
        },
        cardList: { gap: 12 },
        categoryCard: {
          minHeight: 148,
          borderRadius: 22,
          paddingHorizontal: 18,
          paddingVertical: 16,
          overflow: 'hidden',
          justifyContent: 'center',
        },
        categoryKicker: {
          fontFamily: displayFont ? 'PlusJakarta-Bold' : undefined,
          fontSize: 12,
          fontWeight: displayFont ? '400' : '700',
          letterSpacing: 1.6,
          marginBottom: 2,
        },
        categoryTitle: {
          fontFamily: displayFont ? 'PlusJakarta-ExtraBold' : undefined,
          fontSize: 28,
          fontWeight: displayFont ? '400' : '800',
          letterSpacing: -0.4,
          color: theme.colors.text,
          marginBottom: 8,
        },
        categorySub: {
          fontFamily: displayFont ? 'PlusJakarta-Regular' : undefined,
          fontSize: 14,
          fontWeight: '400',
          lineHeight: 20,
          color: theme.colors.textSecondary,
        },
        coinSpot: {
          position: 'absolute',
          right: 14,
          bottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          zIndex: 2,
        },
        coinLabel: {
          color: '#8A6A12',
          fontSize: 12,
          fontWeight: '800',
        },
        arrow: {
          position: 'absolute',
          right: 14,
          top: '50%',
          marginTop: -20,
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.65)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.72)',
          shadowColor: '#FFFFFF',
          shadowOpacity: 0.55,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 1 },
        },
        arrowSheen: {
          position: 'absolute',
          top: 3,
          left: 7,
          right: 7,
          height: 14,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.55)',
        },
        progressRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        },
        track: {
          flex: 1,
          height: 4,
          borderRadius: 999,
          backgroundColor: theme.colors.divider,
          overflow: 'hidden',
        },
        fill: { height: 4, backgroundColor: theme.colors.crimson },
        progressLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
        directionChip: {
          alignSelf: 'flex-start',
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          marginBottom: 18,
        },
        directionText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
        sourceText: {
          fontSize: 26,
          lineHeight: 34,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 22,
        },
        fieldLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
        fieldHint: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 },
        field: {
          minHeight: 112,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          backgroundColor: theme.colors.surface,
          padding: 14,
          fontSize: 16,
          color: theme.colors.text,
          textAlignVertical: 'top',
        },
        counter: {
          alignSelf: 'flex-end',
          marginTop: 6,
          fontSize: 12,
          color: theme.colors.textSecondary,
        },
        creditPill: {
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 16,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
        },
        creditText: {
          fontSize: 14,
          fontWeight: '700',
          color: theme.scheme === 'dark' ? '#F0C14A' : '#6B4A12',
        },
        actions: { gap: 8, marginTop: 12 },
        skip: { alignItems: 'center', paddingVertical: 8 },
        skipText: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
        answerCard: {
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          padding: 14,
          marginBottom: 16,
        },
        answerText: { fontSize: 16, lineHeight: 24, color: theme.colors.text },
        choice: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 14,
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 8,
        },
        choiceSelected: {
          borderWidth: 2,
          borderColor: theme.colors.crimson,
        },
        choiceText: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
        thanksCard: {
          borderRadius: 18,
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          padding: 20,
          gap: 10,
          marginTop: 12,
        },
        thanksTitle: { fontSize: 28, fontWeight: '700', color: theme.colors.text },
        thanksBody: { fontSize: 15, lineHeight: 22, color: theme.colors.textSecondary },
        countdownLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 8 },
        countdown: {
          fontSize: 36,
          fontWeight: '700',
          letterSpacing: 1,
          color: theme.colors.text,
        },
        footer: { marginTop: 12, gap: 4 },
        footerText: { fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary },
        stateNote: { fontSize: 14, color: theme.colors.textSecondary },
        errorNote: { fontSize: 13, color: theme.colors.errorText, fontWeight: '600' },
        dim: { opacity: 0.45 },
      }),
    [theme, insets.bottom, displayFont],
  );

  const blocking =
    resolvedOwner !== ownerRef.current ||
    status === 'loading' ||
    error === 'consent_required' ||
    error === 'unavailable';

  const deadline = creditAwardDeadline(new Date(now), closeAt);
  const countdown = formatCountdown(deadline.getTime() - now);
  const extraAvailable = category && dayState && hasExtraSet(REVIEW_DAYS, dayState, globalDayIndex(now), category);

  return (
    <KeyboardAvoidingView
      style={dynamic.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="review-screen"
    >
      <View style={dynamic.column}>
        <View style={dynamic.header}>
          {phase === 'intro' ? (
            <BackArrow
              testID="review-close"
              accessibilityLabel={t('common.backHome', lang)}
              onPress={onClose}
            />
          ) : (
            <BackArrow
              testID="review-back"
              accessibilityLabel={t('review.backToSets', lang)}
              onPress={backToSets}
            />
          )}
          <View style={dynamic.titlePill}>
            {phase === 'intro' ? (
              <>
                <Text style={dynamic.introTitle}>{t('review.title', lang)}</Text>
                {!blocking ? (
                  <Text style={dynamic.introSub}>{t('review.chooseSet', lang)}</Text>
                ) : null}
              </>
            ) : (
              <View style={dynamic.titleChip}>
                <Text style={dynamic.title}>{t('review.title', lang)}</Text>
              </View>
            )}
          </View>
          <View style={dynamic.headerSide} />
        </View>

        <ScrollView style={dynamic.scroll} contentContainerStyle={{ paddingBottom: 8 }}>
          {status === 'loading' || resolvedOwner !== ownerRef.current ? (
            <View testID="review-state-loading">
              <ActivityIndicator />
              <Text style={dynamic.stateNote}>{t('review.stateLoading', lang)}</Text>
            </View>
          ) : error === 'consent_required' ? (
            <Text style={dynamic.stateNote} testID="review-state-consent">
              {t('review.stateConsent', lang)}
            </Text>
          ) : error === 'flag_disabled' ? (
            <Text style={dynamic.stateNote} testID="review-state-flag-off">
              {t('review.stateFlagOff', lang)}
            </Text>
          ) : error === 'window_closed' ? (
            <Text style={dynamic.stateNote} testID="review-state-window-closed">
              {t('review.stateWindowClosed', lang)}
            </Text>
          ) : error === 'unavailable' ? (
            <Text style={dynamic.errorNote} testID="review-state-unavailable">
              {t('review.stateUnavailable', lang)}
            </Text>
          ) : phase === 'intro' ? (
            <View testID="review-intro" style={dynamic.cardList}>
              {items.length === 0 && status !== 'idle' ? <Text style={dynamic.stateNote} testID="review-state-all-done">{t('review.noExtraSets', lang)}</Text> : null}
              {REVIEW_CATEGORY_ORDER.map((id) => {
                const list = grouped[id];
                const done =
                  list.length > 0 &&
                  list.every((item) => reviewedIds.has(item.source_item_id));
                const disabled = list.length === 0 && !(dayState?.categoryHistory?.[id]?.length);
                const face = REVIEW_CATEGORY_FACE[id];
                const directionKey =
                  id === 'english' ? 'review.directionEnNe' : 'review.directionNeEn';
                return (
                  <Pressable
                    key={id}
                    testID={`review-category-${id}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    onPress={() => openCategory(id)}
                    style={[
                      dynamic.categoryCard,
                      { backgroundColor: theme.scheme === 'dark' ? face.bgDark : face.bg },
                      disabled ? dynamic.dim : null,
                    ]}
                  >
                    <ReviewCategoryImage id={id} />
                    <Text style={[dynamic.categoryKicker, { color: face.accent }]}>
                      {t(face.kicker, lang)}
                    </Text>
                    <Text style={dynamic.categoryTitle}>{t(face.title, lang)}</Text>
                    <Text style={dynamic.categorySub}>{t(directionKey, lang)}</Text>
                    <Text style={dynamic.categorySub}>
                      {done
                        ? t('review.categoryDone', lang)
                        : t('review.categoryCount', lang, { count: list.length })}
                    </Text>
                    {done ? (
                      <Pressable
                        testID={`review-extra-${id}`}
                        accessibilityRole="button"
                        onPress={() => { setCategory(id); setPhase('thanks'); setNow(Date.now()); }}
                        style={dynamic.coinSpot}
                      >
                        <FontAwesome5 name="coins" size={18} color="#E8A317" />
                        <Text style={dynamic.coinLabel}>{t('review.extra10', lang)}</Text>
                      </Pressable>
                    ) : null}
                    {(dayState?.categoryHistory?.[id] ?? []).map((index) => {
                      const finished = (REVIEW_DAYS[index] ?? []).every((meaning) => responses.some((row) => row.sourceItemId === `${meaning.id}:${id}` && responseCompletesQuestion(row.action, row.answer)));
                      return <View key={index} style={{ flexDirection: 'row', gap: 12 }}>
                        <Pressable testID={`review-set-${id}-${index}`} accessibilityRole="button" onPress={() => void selectReviewSet(id, index).then(async () => { await refresh(); setCategory(id); setCursor(0); setEditingSet(true); setPhase('compose'); })}>
                          <Text style={dynamic.categorySub}>{t('review.reopenSet', lang, { number: index + 1 })}</Text>
                        </Pressable>
                        {finished ? <Pressable testID={`review-extra-${id}-${index}`} accessibilityRole="button" accessibilityLabel={t('review.extra10', lang)} onPress={() => void selectReviewSet(id, index).then(async () => { await refresh(); setCategory(id); setPhase('thanks'); setNow(Date.now()); })}>
                          <Text style={dynamic.coinLabel}>{t('review.extra10', lang)}</Text>
                        </Pressable> : null}
                      </View>;
                    })}
                    <View
                      style={[
                        dynamic.arrow,
                        {
                          backdropFilter: 'blur(16px) saturate(1.6)',
                          WebkitBackdropFilter: 'blur(16px) saturate(1.6)',
                        } as object,
                      ]}
                    >
                      <View style={dynamic.arrowSheen} />
                      <Ionicons name="chevron-forward" size={22} color="#6B4A12" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : phase === 'thanks' ? (
            <View style={dynamic.thanksCard} testID="review-thanks">
              <Text style={dynamic.thanksTitle}>{t('review.thanksTitle', lang)}</Text>
              <Text style={dynamic.thanksBody}>{t('review.thanksBody', lang)}</Text>
              <Text style={dynamic.countdownLabel}>{t('review.countdownLabel', lang)}</Text>
              <Text style={dynamic.countdown} testID="review-countdown">
                {countdown}
              </Text>
              {category && extraAvailable ? <AppButton testID="review-extra-card" label={t('review.wantExtra10', lang)} onPress={() => void startExtra(category)} /> : <Text style={dynamic.thanksBody}>{t('review.noExtraSets', lang)}</Text>}
            </View>
          ) : active ? (
            <View testID="review-item">
              <View style={dynamic.progressRow}>
                <View style={dynamic.track}>
                  <View
                    style={[
                      dynamic.fill,
                      {
                        width: `${Math.round(((cursor + 1) / Math.max(activeList.length, 1)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={dynamic.progressLabel} testID="review-progress">
                  {t('review.questionOf', lang, {
                    current: cursor + 1,
                    total: activeList.length,
                  })}
                </Text>
              </View>
              {phase === 'compose' ? (
                <>
                  <View style={dynamic.directionChip}>
                    <Text style={dynamic.directionText}>
                      {t(
                        active.direction === 'en-ne'
                          ? 'review.directionEnNe'
                          : 'review.directionNeEn',
                        lang,
                      )}
                    </Text>
                  </View>
                  <Text style={dynamic.sourceText} testID="review-item-source">
                    {active.source_text}
                  </Text>
                  <Text style={dynamic.fieldLabel}>{t('review.yourTranslation', lang)}</Text>
                  <TextInput
                    testID="review-item-correction"
                    style={dynamic.field}
                    multiline
                    maxLength={ANSWER_LIMIT}
                    value={correction}
                    onChangeText={(text) => { setCorrection(text); drafts.current[active.source_item_id] = text; }}
                    editable={status !== 'submitting'}
                    placeholder={t('review.typeHere', lang)}
                    placeholderTextColor={theme.colors.textPlaceholder}
                  />
                  <Text style={dynamic.counter} testID="review-char-count">
                    {correction.length}/{ANSWER_LIMIT}
                  </Text>
                </>
              ) : (
                <View testID="review-compare">
                  <Text style={dynamic.fieldLabel}>{t('review.yourTranslation', lang)}</Text>
                  <Text style={dynamic.fieldHint}>({t('review.yourEntered', lang)})</Text>
                  <View style={dynamic.answerCard}>
                    <Text style={dynamic.answerText} testID="review-your-answer">
                      {correction.trim()}
                    </Text>
                  </View>
                  {active.proposed_target?.trim() ? (
                    <>
                      <Text style={dynamic.fieldLabel}>{t('review.currentTranslation', lang)}</Text>
                      <Text style={dynamic.fieldHint}>({t('review.fromSystem', lang)})</Text>
                      <View style={dynamic.answerCard}>
                        <Text style={dynamic.answerText} testID="review-system-answer">
                          {active.proposed_target.trim()}
                        </Text>
                      </View>
                    </>
                  ) : null}
                  <Text style={dynamic.fieldLabel}>{t('review.whichBetter', lang)}</Text>
                  <View style={{ height: 8 }} />
                  {(
                    [
                      ['ours', 'checkmark-circle-outline', 'review.currentTranslation'],
                      ['mine', 'person-outline', 'review.mineBetter'],
                      ['same', 'thumbs-up-outline', 'review.sameMeaning'],
                      ['neither', 'thumbs-down-outline', 'review.neitherRight'],
                    ] as const
                  )
                    .filter(([id]) => comparisonChoices(active.proposed_target).includes(id))
                    .map(([id, icon, label]) => (
                    <Pressable
                      key={id}
                      testID={`review-judgment-${id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: judgment === id }}
                      onPress={() => setJudgment(id)}
                      style={[dynamic.choice, judgment === id ? dynamic.choiceSelected : null]}
                    >
                      <Ionicons name={icon} size={20} color={theme.colors.text} />
                      <Text style={dynamic.choiceText}>{t(label, lang)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>

        {!blocking && phase === 'compose' && active ? (
          <View style={dynamic.actions}>
            <AppButton
              testID="review-action-submit"
              label={t('review.actionSubmit', lang)}
              onPress={() => {
                if (!correction.trim()) return;
                setJudgment(null);
                setError(null);
                setPhase('compare');
              }}
              disabled={status === 'submitting' || !correction.trim()}
              style={{ alignSelf: 'stretch' }}
            />
            <Pressable
              testID="review-action-skip"
              accessibilityRole="button"
              onPress={() => void send('skip')}
              disabled={status === 'submitting'}
              style={dynamic.skip}
            >
              <Text style={dynamic.skipText}>{t('review.actionSkip', lang)}</Text>
            </Pressable>
            <Pressable testID="review-action-back" accessibilityRole="button" onPress={backWithinSet} disabled={status === 'submitting'} style={[dynamic.skip, { minHeight: 44, justifyContent: 'center' }]}>
              <Text style={dynamic.skipText}>{t('review.actionBack', lang)}</Text>
            </Pressable>
          </View>
        ) : null}

        {!blocking && phase === 'compare' && active ? (
          <View style={dynamic.actions}>
            <AppButton
              testID="review-action-next"
              label={t('review.actionNext', lang)}
              onPress={() => {
                if (!judgment) return;
                const mapped = judgmentToSubmit(
                  judgment,
                  correction,
                  active.proposed_target,
                );
                void send(mapped.action, mapped.correctedText);
              }}
              disabled={status === 'submitting' || !judgment}
              style={{ alignSelf: 'stretch' }}
            />
            <Pressable testID="review-action-back" accessibilityRole="button" onPress={backWithinSet} disabled={status === 'submitting'} style={[dynamic.skip, { minHeight: 44, justifyContent: 'center' }]}>
              <Text style={dynamic.skipText}>{t('review.actionBack', lang)}</Text>
            </Pressable>
          </View>
        ) : null}

        {!blocking && phase === 'thanks' ? (
          <View style={dynamic.actions}>
            <AppButton
              testID="review-continue"
              label={t('review.continue', lang)}
              onPress={backToSets}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        ) : null}

        {error === 'already_submitted' ? (
          <Text style={dynamic.errorNote} testID="review-error-already">
            {t('review.errorAlreadySubmitted', lang)}
          </Text>
        ) : null}
        {error === 'invalid' ? (
          <Text style={dynamic.errorNote} testID="review-error-invalid">
            {t('review.errorInvalid', lang)}
          </Text>
        ) : null}

      </View>
    </KeyboardAvoidingView>
  );
}
