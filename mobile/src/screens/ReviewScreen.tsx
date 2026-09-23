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
import { useAuth } from '../features/auth/AuthProvider';
import {
  creditLabelForTier,
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

/**
 * R3 mobile Review screen.
 *
 * Renders the shared 10-item public review window. All submissions route
 * through `rpc_submit_review` which, under R3's migration, first calls
 * `private.assert_review_eligibility(auth.uid())` so the client cannot
 * bypass eligibility. Copy honestly says the reward is pending until the
 * 5:00 PM New York close; late rejection preserves the granted display.
 *
 * State matrix:
 *   * offline               → offline banner (no fetch)
 *   * flag_off              → paused message
 *   * guest                 → sign-in message (still no fetch)
 *   * consent-required      → pointer to Settings
 *   * fetching              → spinner
 *   * items empty           → all-done message
 *   * items[cursor]         → source / target / correction textarea + 4 actions
 *   * window_closed on submit → offline-safe error banner
 */

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
  const lang = useUiLang();
  const auth = useAuth();
  const offline = useNetworkOffline();
  const flags = useFeatureFlags();

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [windowId, setWindowId] = useState<string | null>(null);
  const [closeAt, setCloseAt] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<ErrorReason | null>(null);
  const [correction, setCorrection] = useState('');
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [mine, setMine] = useState<ReviewMine[]>([]);

  const shouldFetch =
    !offline &&
    auth.status === 'signed-in' &&
    Boolean(flags.contributionTextEnabled);

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
    setCloseAt(res.window?.ny_close_at ?? null);
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
      // Announce success briefly, then move back to ready for the next item.
      setTimeout(() => setStatus('ready'), 800);
    },
    [windowId, active, correction, items.length],
  );

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
        pad: { padding: theme.spacing.lg, gap: theme.spacing.md },
        title: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.text,
        },
        subtitle: { fontSize: 14, color: theme.colors.textSecondary },
        section: {
          borderRadius: theme.radii.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        label: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
        body: { fontSize: 15, color: theme.colors.text },
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
        stateNote: { fontSize: 14, color: theme.colors.textSecondary },
        errorNote: { fontSize: 13, color: theme.colors.errorText, fontWeight: '600' },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
      }),
    [theme],
  );

  const closeLabel = closeAt
    ? new Date(closeAt).toLocaleString(lang === 'ne' ? 'ne-NP' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

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
          <Text style={dynamic.title}>{t('review.title', lang)}</Text>
          <Pressable
            testID="review-close"
            accessibilityRole="button"
            onPress={onClose}
          >
            <Text style={dynamic.label}>{t('common.close', lang)}</Text>
          </Pressable>
        </View>
        <Text style={dynamic.subtitle}>{t('review.subtitle', lang)}</Text>

        {offline ? (
          <Text style={dynamic.stateNote} testID="review-state-offline">
            {t('review.stateOffline', lang)}
          </Text>
        ) : !flags.contributionTextEnabled ? (
          <Text style={dynamic.stateNote} testID="review-state-flag-off">
            {t('review.stateFlagOff', lang)}
          </Text>
        ) : auth.status !== 'signed-in' ? (
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
            <Text style={dynamic.meta} testID="review-progress">
              {t('review.progress', lang, {
                done: String(done),
                total: String(total),
              })}
            </Text>
            <Text style={dynamic.meta} testID="review-close-at">
              {t('review.closeAt', lang, { localTime: closeLabel })}
            </Text>
            {remaining === 0 ? (
              <Text style={dynamic.stateNote} testID="review-state-all-done">
                {t('review.stateAllDone', lang)}
              </Text>
            ) : active ? (
              <View style={dynamic.section} testID="review-item">
                <Text style={dynamic.meta}>
                  {t('review.itemDirection', lang, {
                    direction: active.direction,
                  })}
                  {'  ·  '}
                  {t('review.itemRegister', lang, {
                    register: active.register,
                  })}
                  {'  ·  '}
                  {creditLabelForTier(active.length_tier)}
                </Text>
                <Text style={dynamic.label}>
                  {t('review.itemSource', lang)}
                </Text>
                <Text style={dynamic.body} testID="review-item-source">
                  {active.source_text}
                </Text>
                <Text style={dynamic.label}>
                  {t('review.itemProposed', lang)}
                </Text>
                <Text style={dynamic.body} testID="review-item-proposed">
                  {active.proposed_target ?? '—'}
                </Text>
                <Text style={dynamic.label}>
                  {t('review.itemCorrection', lang)}
                </Text>
                <TextInput
                  testID="review-item-correction"
                  style={dynamic.textarea}
                  multiline
                  value={correction}
                  onChangeText={setCorrection}
                  editable={status !== 'submitting'}
                />

                <View style={dynamic.actionsRow}>
                  <AppButton
                    testID="review-action-confirm"
                    label={t('review.actionConfirm', lang)}
                    onPress={() => void submit('confirm')}
                    disabled={status === 'submitting'}
                  />
                  <AppButton
                    testID="review-action-edit"
                    label={t('review.actionEdit', lang)}
                    onPress={() => void submit('edit')}
                    disabled={status === 'submitting' || !correction.trim()}
                  />
                  <AppButton
                    testID="review-action-skip"
                    label={t('review.actionSkip', lang)}
                    onPress={() => void submit('skip')}
                    disabled={status === 'submitting'}
                  />
                  <AppButton
                    testID="review-action-report"
                    label={t('review.actionReport', lang)}
                    onPress={() => void submit('report')}
                    disabled={status === 'submitting'}
                  />
                </View>
                <Text style={dynamic.meta}>
                  {t('review.pendingReward', lang)}
                </Text>
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
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
