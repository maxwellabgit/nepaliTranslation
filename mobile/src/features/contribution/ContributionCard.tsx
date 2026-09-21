import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useEntitlement } from '../entitlements/EntitlementProvider';
import {
  fetchNextContribution,
  newIdempotencyKey,
  submitContribution,
  type PublicContribution,
} from './contributionApi';
import { useFeatureFlags } from '../../app/FeatureConfigProvider';
import { t, useUiLang } from '../../i18n';
import { useTheme } from '../../theme';

type CardPhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'editing'
  | 'sending'
  | 'received'
  | 'pending'
  | 'validated'
  | 'earned'
  | 'disputed'
  | 'unavailable'
  | 'retry'
  | 'lease_expired';

/**
 * Contribution queue card. Hidden while contributionsEnabled is false.
 * Never gates Auto/Conversation translation.
 */
export function ContributionCard() {
  const theme = useTheme();
  const lang = useUiLang();
  const auth = useAuth();
  const flags = useFeatureFlags();
  const entitlement = useEntitlement();
  const [task, setTask] = useState<PublicContribution | null>(null);
  const [phase, setPhase] = useState<CardPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [lastIdempotency, setLastIdempotency] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<
    'looks_correct' | 'edit' | 'skip' | 'report_task' | null
  >(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        box: {
          marginTop: 20,
          marginHorizontal: 16,
          padding: 16,
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          gap: 8,
        },
        title: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
        label: {
          fontSize: 12,
          fontWeight: '700',
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
        },
        body: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
        meta: { fontSize: 12, color: theme.colors.textPlaceholder },
        status: { fontSize: 14, fontWeight: '600', color: theme.colors.forest },
        error: { fontSize: 13, color: theme.colors.danger, marginTop: 4 },
        input: {
          minHeight: 88,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          borderRadius: 12,
          padding: 12,
          fontSize: 15,
          color: theme.colors.text,
          textAlignVertical: 'top',
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        actions: { gap: 8, marginTop: 4 },
        button: {
          minHeight: 44,
          borderRadius: 12,
          backgroundColor: theme.colors.text,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
        },
        buttonText: {
          color: theme.colors.onPrimary,
          fontWeight: '700',
          fontSize: 15,
        },
        secondary: {
          minHeight: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
        },
        secondaryText: {
          color: theme.colors.text,
          fontWeight: '600',
          fontSize: 15,
        },
        danger: {
          minHeight: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
        },
        dangerText: {
          color: theme.colors.danger,
          fontWeight: '600',
          fontSize: 15,
        },
      }),
    [theme],
  );

  const signedIn = auth.status === 'signed-in';

  const load = useCallback(async () => {
    setPhase('loading');
    setMessage(null);
    setEditText('');
    setEditError(null);
    try {
      const result = await fetchNextContribution({
        signedIn,
        authConfigured: auth.authConfigured,
      });
      if (!result.ok) {
        setTask(null);
        setPhase('unavailable');
        setMessage(
          result.reason === 'sign_in'
            ? t('contributions.signInSettings', lang)
            : result.reason === 'consent'
              ? t('contributions.consentSettings', lang)
              : result.reason === 'age'
                ? t('contributions.ageConfirmSettings', lang)
                : t('contributions.unavailable', lang),
        );
        return;
      }
      if (!result.assignment) {
        setTask(null);
        setPhase('idle');
        setMessage(t('contributions.noTasks', lang));
        return;
      }
      setTask(result.assignment);
      setPhase('ready');
    } catch {
      setTask(null);
      setPhase('unavailable');
      setMessage(t('contributions.unavailable', lang));
    }
  }, [auth.authConfigured, lang, signedIn]);

  const runSubmit = useCallback(
    async (
      action: 'looks_correct' | 'edit' | 'skip' | 'report_task',
      responseText?: string,
      idempotencyKey?: string,
    ) => {
      if (!task?.assignment_id) {
        setPhase('unavailable');
        setMessage(t('contributions.missingAssignment', lang));
        return;
      }
      if (action === 'edit' && !responseText?.trim()) {
        setEditError(t('contributions.editRequired', lang));
        return;
      }
      const key = idempotencyKey ?? newIdempotencyKey();
      setLastIdempotency(key);
      setLastAction(action);
      setPhase('sending');
      setMessage(null);
      setEditError(null);
      try {
        const result = await submitContribution({
          signedIn,
          authConfigured: auth.authConfigured,
          assignmentId: task.assignment_id,
          action,
          responseText,
          idempotencyKey: key,
        });
        if (!result.ok) {
          if (result.reason === 'lease_expired') {
            setPhase('lease_expired');
            setMessage(t('contributions.leaseExpired', lang));
            setTask(null);
            return;
          }
          if (result.reason === 'consent' || result.reason === 'consent_outdated') {
            setPhase('unavailable');
            setMessage(t('contributions.updateConsent', lang));
            return;
          }
          if (result.reason === 'age') {
            setPhase('unavailable');
            setMessage(t('contributions.ageConfirmSettings', lang));
            return;
          }
          setPhase('retry');
          setMessage(t('contributions.sendFailed', lang));
          return;
        }
        setPhase('received');
        setMessage(result.reward_label);
        try {
          await entitlement.refresh();
        } catch {
          /* soft-fail: receipt already accepted */
        }
        setPhase('pending');
        setTask(null);
      } catch {
        setPhase('retry');
        setMessage(t('contributions.sendFailed', lang));
      }
    },
    [auth.authConfigured, entitlement, lang, signedIn, task],
  );

  if (!flags.contributionsEnabled) {
    return (
      <View style={styles.box} testID="contribution-card-off">
        <Text style={styles.title}>{t('contributions.title', lang)}</Text>
        <Text style={styles.body}>
          {t('contributions.cardOffDetail', lang)}
        </Text>
      </View>
    );
  }

  const showActions = phase === 'ready' || phase === 'editing';
  const loadLabel =
    phase === 'loading'
      ? t('common.loading', lang)
      : phase === 'lease_expired'
        ? t('contributions.loadNew', lang)
        : phase === 'received' || phase === 'pending'
          ? t('contributions.loadAnother', lang)
          : t('contributions.loadTask', lang);

  return (
    <View style={styles.box} testID="contribution-card">
      <Text style={styles.title}>{t('contributions.cardTitle', lang)}</Text>

      {task && (phase === 'ready' || phase === 'editing' || phase === 'sending') ? (
        <>
          <Text style={styles.label}>{t('contributions.sourceLabel', lang)}</Text>
          <Text style={styles.body} testID="contribution-source">
            {task.source_text}
          </Text>
          <Text style={styles.label}>{t('contributions.modelLabel', lang)}</Text>
          <Text style={styles.body} testID="contribution-model">
            {task.model_output}
          </Text>
          <Text style={styles.meta} testID="contribution-reward-label">
            {task.reward_label}
          </Text>
        </>
      ) : null}

      {phase === 'editing' ? (
        <View>
          <TextInput
            style={styles.input}
            value={editText}
            onChangeText={(next) => {
              setEditText(next);
              setEditError(null);
            }}
            placeholder={t('contributions.editPlaceholder', lang)}
            placeholderTextColor={theme.colors.textPlaceholder}
            multiline
            testID="contribution-edit-input"
            accessibilityLabel={t('contributions.editInputA11y', lang)}
          />
          {editError ? (
            <Text style={styles.error} testID="contribution-edit-error">
              {editError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {message ? (
        <Text style={styles.body} testID="contribution-message">
          {message}
        </Text>
      ) : null}

      {phase === 'sending' ? (
        <View style={styles.row} testID="contribution-sending">
          <ActivityIndicator color={theme.colors.text} />
          <Text style={styles.body}>{t('contributions.sending', lang)}</Text>
        </View>
      ) : null}

      {phase === 'received' || phase === 'pending' ? (
        <Text style={styles.status} testID="contribution-status-received">
          {t('contributions.statusReceived', lang)}
        </Text>
      ) : null}
      {phase === 'validated' || phase === 'earned' ? (
        <Text style={styles.status} testID="contribution-status-earned">
          {t('contributions.statusValidated', lang)}
        </Text>
      ) : null}
      {phase === 'disputed' ? (
        <Text style={styles.status} testID="contribution-status-disputed">
          {t('contributions.statusDisputed', lang)}
        </Text>
      ) : null}

      {showActions ? (
        <View style={styles.actions}>
          <Pressable
            style={styles.button}
            onPress={() => void runSubmit('looks_correct')}
            accessibilityRole="button"
            accessibilityLabel={t('contributions.looksCorrect', lang)}
            testID="contribution-looks-correct"
          >
            <Text style={styles.buttonText}>
              {t('contributions.looksCorrect', lang)}
            </Text>
          </Pressable>
          {phase === 'editing' ? (
            <Pressable
              style={styles.button}
              onPress={() => void runSubmit('edit', editText)}
              accessibilityRole="button"
              accessibilityLabel={t('contributions.submitEditA11y', lang)}
              testID="contribution-submit-edit"
            >
              <Text style={styles.buttonText}>
                {t('contributions.submitEdit', lang)}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.secondary}
              onPress={() => {
                setPhase('editing');
                setEditText(task?.model_output ?? '');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('contributions.editTranslation', lang)}
              testID="contribution-edit"
            >
              <Text style={styles.secondaryText}>
                {t('contributions.editTranslation', lang)}
              </Text>
            </Pressable>
          )}
          <Pressable
            style={styles.secondary}
            onPress={() => void runSubmit('skip')}
            accessibilityRole="button"
            accessibilityLabel={t('contributions.skipA11y', lang)}
            testID="contribution-skip"
          >
            <Text style={styles.secondaryText}>
              {t('contributions.skip', lang)}
            </Text>
          </Pressable>
          <Pressable
            style={styles.danger}
            onPress={() => void runSubmit('report_task')}
            accessibilityRole="button"
            accessibilityLabel={t('contributions.reportA11y', lang)}
            testID="contribution-report"
          >
            <Text style={styles.dangerText}>
              {t('contributions.report', lang)}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {phase === 'retry' && lastAction && lastIdempotency ? (
        <Pressable
          style={styles.button}
          onPress={() =>
            void runSubmit(
              lastAction,
              lastAction === 'edit' ? editText : undefined,
              lastIdempotency,
            )
          }
          accessibilityRole="button"
          accessibilityLabel={t('contributions.retrySubmitA11y', lang)}
          testID="contribution-retry"
        >
          <Text style={styles.buttonText}>{t('contributions.retry', lang)}</Text>
        </Pressable>
      ) : null}

      {phase === 'idle' ||
      phase === 'loading' ||
      phase === 'unavailable' ||
      phase === 'lease_expired' ||
      phase === 'received' ||
      phase === 'pending' ||
      phase === 'retry' ? (
        <Pressable
          style={styles.button}
          onPress={() => void load()}
          disabled={phase === 'loading'}
          accessibilityRole="button"
          accessibilityLabel={t('contributions.loadA11y', lang)}
          testID="contribution-load"
        >
          <Text style={styles.buttonText}>{loadLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
