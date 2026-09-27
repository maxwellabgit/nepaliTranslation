import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../features/auth/AuthProvider';
import {
  fetchCurrentReviewWindow,
  firstUnsubmittedIndex,
  submitReview,
  type ReviewItem,
  type ReviewMine,
  type ReviewSubmitAction,
} from '../features/contribution/publicReviewApi';
import { AppButton } from '../components/AppPrimitives';
import { t, useNetworkOffline, useUiLang } from '../i18n';
import { useTheme } from '../theme';
import { useFeatureFlags } from '../app/FeatureConfigProvider';
import { isTestingGroundHarness } from '../features/contribution/testingGroundReview';

/**
 * Shared 10-item review window. Submissions go through `rpc_submit_review`,
 * which checks eligibility on the server. Rewards stay pending until the
 * 5:00 PM New York close.
 */

function samplePreview(text: string): string {
  const chars = Array.from(text.trim());
  if (chars.length <= 5) return chars.join('');
  return `${chars.slice(0, 5).join('')}...`;
}

type OverlayProps = {
  onClose: () => void;
};

type Status =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'submitted'
  | 'error';

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
  const offline = useNetworkOffline();
  const flags = useFeatureFlags();
  const testingGround = isTestingGroundHarness();

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<ErrorReason | null>(null);
  const [correction, setCorrection] = useState('');
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [mine, setMine] = useState<ReviewMine[]>([]);

  const shouldFetch =
    testingGround ||
    (!offline &&
      auth.status === 'signed-in' &&
      Boolean(flags.contributionTextEnabled));

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    const res = await fetchCurrentReviewWindow();
    if (!res.ok) {
      setError(res.reason);
      setStatus('error');
      return;
    }
    const loaded = res.items ?? [];
    const restored = res.mine ?? [];
    setWindowId(res.window?.window_id ?? null);
    setItems(loaded);
    setMine(restored);
    setReviewedIds(new Set(restored.map((row) => row.source_item_id)));
    setCursor(firstUnsubmittedIndex(loaded, restored));
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (shouldFetch) void refresh();
  }, [shouldFetch, refresh]);

  const active = items[cursor] ?? null;
  const remaining = items.filter((it) => !reviewedIds.has(it.source_item_id)).length;

  const submit = useCallback(
    async (action: ReviewSubmitAction) => {
      if (!windowId || !active) return;
      const correctedText = correction.trim();
      if (action === 'confirm' && !active.proposed_target?.trim()) {
        setError('invalid');
        return;
      }
      if (action === 'edit' && !correctedText) {
        setError('invalid');
        return;
      }
      setStatus('submitting');
      setError(null);
      const res = await submitReview({
        windowId,
        sourceItemId: active.source_item_id,
        action,
        correctedText: action === 'edit' ? correctedText : undefined,
      });
      if (!res.ok) {
        setStatus('ready');
        setError(res.reason as ErrorReason);
        return;
      }
      setReviewedIds((prev) => {
        const next = new Set(prev);
        next.add(active.source_item_id);
        return next;
      });
      setCorrection('');
      setCursor((c) => (c + 1 < items.length ? c + 1 : c));
      setStatus('submitted');
      setTimeout(() => setStatus('ready'), 800);
    },
    [windowId, active, correction, items.length],
  );

  const topGap = Math.max(insets.top, 47);

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
        pad: {
          paddingTop: topGap,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        section: {
          borderRadius: theme.radii.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        meta: { fontSize: 12, color: theme.colors.textSecondary },
        textarea: {
          minHeight: 80,
          borderRadius: theme.radii.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          padding: theme.spacing.sm,
          fontSize: 15,
          color: theme.colors.text,
        },
        actionsRow: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
        pager: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        sampleList: { flexDirection: 'row', gap: 16 },
        sampleColumn: { flex: 1, gap: 2 },
        sample: { fontSize: 14, color: theme.colors.textSecondary },
        sampleCurrent: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
        creditRow: {
          position: 'absolute',
          top: 12,
          right: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
        },
        creditText: {
          fontSize: 15,
          fontWeight: '800',
          color: theme.scheme === 'dark' ? '#F0C14A' : '#6B4A12',
        },
        footer: {
          fontSize: 12,
          lineHeight: 16,
          color: theme.colors.textSecondary,
        },
        progress: {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
        },
        progressCount: {
          fontSize: 22,
          fontWeight: '800',
          color: theme.colors.text,
        },
        progressOf: {
          fontSize: 14,
          fontWeight: '600',
          color: theme.colors.textSecondary,
        },
        stateNote: { fontSize: 14, color: theme.colors.textSecondary },
        errorNote: { fontSize: 13, color: theme.colors.errorText, fontWeight: '600' },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        headerSide: { width: 36 },
        titlePill: {
          flex: 1,
          alignItems: 'center',
        },
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
        itemColumn: { gap: theme.spacing.md },
        sourceCard: {
          position: 'relative',
          minHeight: 96,
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          padding: 16,
          justifyContent: 'center',
        },
        sourceText: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.text,
          paddingRight: 108,
        },
        back: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.text,
        },
      }),
    [theme, topGap],
  );

  const total = items.length;
  const done = reviewedIds.size;

  return (
    <KeyboardAvoidingView
      style={dynamic.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="review-screen"
    >
      <ScrollView contentContainerStyle={dynamic.pad}>
        <View style={dynamic.header}>
          <Pressable
            testID="review-close"
            accessibilityRole="button"
            accessibilityLabel={t('common.backHome', lang)}
            onPress={onClose}
            hitSlop={12}
            style={dynamic.headerSide}
          >
            <Text style={dynamic.back}>←</Text>
          </Pressable>
          <View style={dynamic.titlePill}>
            <View style={dynamic.titleChip}>
              <Text style={dynamic.title}>{t('review.title', lang)}</Text>
            </View>
          </View>
          <View style={dynamic.headerSide} />
        </View>

        {offline && !testingGround ? (
          <Text style={dynamic.stateNote} testID="review-state-offline">
            {t('review.stateOffline', lang)}
          </Text>
        ) : !flags.contributionTextEnabled && !testingGround ? (
          <Text style={dynamic.stateNote} testID="review-state-flag-off">
            {t('review.stateFlagOff', lang)}
          </Text>
        ) : auth.status !== 'signed-in' && !testingGround ? (
          <Text style={dynamic.stateNote} testID="review-state-sign-in">
            {t('review.stateSignIn', lang)}
          </Text>
        ) : status === 'loading' ? (
          <View style={dynamic.section} testID="review-state-loading">
            <ActivityIndicator />
            <Text style={dynamic.stateNote}>
              {t('review.stateLoading', lang)}
            </Text>
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
        ) : total === 0 && status !== 'idle' ? (
          <Text style={dynamic.stateNote} testID="review-state-all-done">
            {t('review.stateAllDone', lang)}
          </Text>
        ) : (
          <>
            {mine.length > 0 ? (
              <View testID="review-restored">
                {mine.map((row) => (
                  <Text
                    key={row.source_item_id}
                    style={dynamic.meta}
                    testID={`review-restored-${row.source_item_id}`}
                  >
                    {t(
                      row.action === 'edit'
                        ? 'review.actionEdit'
                        : row.action === 'skip'
                          ? 'review.actionSkip'
                          : row.action === 'report'
                            ? 'review.actionReport'
                            : 'review.actionConfirm',
                      lang,
                    )}
                    {row.corrected_text ? `: ${row.corrected_text}` : ''}
                    {' · '}
                    {t(
                      row.reward_granted
                        ? 'review.rewardEarned'
                        : 'review.rewardPending',
                      lang,
                    )}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={dynamic.sampleList} testID="review-sample-list">
              {[0, 1].map((column) => {
                const start = column === 0 ? 0 : Math.ceil(items.length / 2);
                const end = column === 0 ? Math.ceil(items.length / 2) : items.length;
                return (
                  <View key={column} style={dynamic.sampleColumn}>
                    {items.slice(start, end).map((item, offset) => {
                      const index = start + offset;
                      return (
                        <Pressable
                          key={item.source_item_id}
                          onPress={() => {
                            setCursor(index);
                            setCorrection('');
                          }}
                          testID={`review-sample-${index}`}
                        >
                          <Text
                            style={
                              index === cursor
                                ? dynamic.sampleCurrent
                                : dynamic.sample
                            }
                          >
                            {index + 1}. {samplePreview(item.source_text)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>
            <View style={dynamic.pager}>
              <Pressable
                testID="review-prev"
                accessibilityRole="button"
                accessibilityLabel={t('review.prevA11y', lang)}
                disabled={cursor <= 0}
                onPress={() => {
                  setCursor((current) => Math.max(0, current - 1));
                  setCorrection('');
                }}
                hitSlop={8}
              >
                <Ionicons
                  name="chevron-back"
                  size={28}
                  color={cursor <= 0 ? theme.colors.divider : theme.colors.text}
                />
              </Pressable>
              <View style={dynamic.progress} testID="review-progress">
                <Text style={dynamic.progressCount}>{done}</Text>
                <Text style={dynamic.progressOf}>of {total}</Text>
              </View>
              <Pressable
                testID="review-next"
                accessibilityRole="button"
                accessibilityLabel={t('review.nextA11y', lang)}
                disabled={cursor >= items.length - 1}
                onPress={() => {
                  setCursor((current) => Math.min(items.length - 1, current + 1));
                  setCorrection('');
                }}
                hitSlop={8}
              >
                <Ionicons
                  name="chevron-forward"
                  size={28}
                  color={
                    cursor >= items.length - 1
                      ? theme.colors.divider
                      : theme.colors.text
                  }
                />
              </Pressable>
            </View>
            {remaining === 0 ? (
              <Text style={dynamic.stateNote} testID="review-state-all-done">
                {t('review.stateAllDone', lang)}
              </Text>
            ) : active ? (
              <View testID="review-item" style={dynamic.itemColumn}>
                <View style={dynamic.sourceCard}>
                  <Text style={dynamic.sourceText} testID="review-item-source">
                    {active.source_text}
                  </Text>
                  <View style={dynamic.creditRow} testID="review-credits">
                    <FontAwesome5
                      name="coins"
                      size={16}
                      color={theme.scheme === 'dark' ? '#F0C14A' : '#6B4A12'}
                    />
                    <Text style={dynamic.creditText}>
                      {t('learn.credits', lang, { count: active.scheduled_credits })}
                    </Text>
                  </View>
                </View>
                <TextInput
                  testID="review-item-correction"
                  style={dynamic.textarea}
                  multiline
                  value={correction}
                  onChangeText={setCorrection}
                  editable={status !== 'submitting'}
                  placeholder={active.proposed_target?.trim() || undefined}
                  placeholderTextColor={theme.colors.textPlaceholder}
                />

                <View style={dynamic.actionsRow}>
                  <AppButton
                    testID="review-action-submit"
                    label={t('review.actionSubmit', lang)}
                    onPress={() =>
                      void submit(correction.trim() ? 'edit' : 'confirm')
                    }
                    disabled={
                      status === 'submitting' ||
                      (!correction.trim() && !active.proposed_target?.trim())
                    }
                  />
                  <AppButton
                    testID="review-action-skip"
                    label={t('review.actionSkip', lang)}
                    onPress={() => void submit('skip')}
                    disabled={status === 'submitting'}
                  />
                </View>
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
                {status === 'submitted' ? (
                  <Text style={dynamic.stateNote} testID="review-submitted">
                    {t('review.submittedAdvance', lang)}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text style={dynamic.footer} testID="review-credits-note">
              {t('credits.notMoney', lang)}
            </Text>
            <Text style={dynamic.footer}>{t('review.settle', lang)}</Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
