import { useCallback, useState } from 'react';
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
import { colors } from '../../theme';

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
            ? 'Sign in with Apple in Settings to contribute.'
            : result.reason === 'consent'
              ? 'Save contribution consent in Settings first.'
              : result.reason === 'age'
                ? 'Confirm you are 13 or older in Settings.'
                : 'Contributions are unavailable right now.',
        );
        return;
      }
      if (!result.assignment) {
        setTask(null);
        setPhase('idle');
        setMessage('No tasks available right now.');
        return;
      }
      setTask(result.assignment);
      setPhase('ready');
    } catch {
      setTask(null);
      setPhase('unavailable');
      setMessage('Contributions are unavailable right now.');
    }
  }, [auth.authConfigured, signedIn]);

  const runSubmit = useCallback(
    async (
      action: 'looks_correct' | 'edit' | 'skip' | 'report_task',
      responseText?: string,
      idempotencyKey?: string,
    ) => {
      if (!task?.assignment_id) {
        setPhase('unavailable');
        setMessage('This task is missing an assignment. Load a new one.');
        return;
      }
      if (action === 'edit' && !responseText?.trim()) {
        setEditError('Enter an edited translation before submitting.');
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
            setMessage('This task expired. Load a new one to continue.');
            setTask(null);
            return;
          }
          if (result.reason === 'consent' || result.reason === 'consent_outdated') {
            setPhase('unavailable');
            setMessage('Update contribution consent in Settings, then try again.');
            return;
          }
          if (result.reason === 'age') {
            setPhase('unavailable');
            setMessage('Confirm you are 13 or older in Settings.');
            return;
          }
          setPhase('retry');
          setMessage('Could not send. Tap Retry to try again.');
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
        setMessage('Could not send. Tap Retry to try again.');
      }
    },
    [auth.authConfigured, entitlement, signedIn, task],
  );

  if (!flags.contributionsEnabled) {
    return (
      <View style={styles.box} testID="contribution-card-off">
        <Text style={styles.title}>Contributions</Text>
        <Text style={styles.body}>
          Contribution review is off in this build. Translation still works offline.
        </Text>
      </View>
    );
  }

  const showActions = phase === 'ready' || phase === 'editing';

  return (
    <View style={styles.box} testID="contribution-card">
      <Text style={styles.title}>Contribute a review</Text>

      {task && (phase === 'ready' || phase === 'editing' || phase === 'sending') ? (
        <>
          <Text style={styles.label}>Source</Text>
          <Text style={styles.body} testID="contribution-source">
            {task.source_text}
          </Text>
          <Text style={styles.label}>Model output</Text>
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
            onChangeText={(t) => {
              setEditText(t);
              setEditError(null);
            }}
            placeholder="Your corrected translation"
            placeholderTextColor={colors.textPlaceholder}
            multiline
            testID="contribution-edit-input"
            accessibilityLabel="Edited translation"
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
          <ActivityIndicator color={colors.text} />
          <Text style={styles.body}>Sending…</Text>
        </View>
      ) : null}

      {phase === 'received' || phase === 'pending' ? (
        <Text style={styles.status} testID="contribution-status-received">
          Received — pending validation
        </Text>
      ) : null}
      {phase === 'validated' || phase === 'earned' ? (
        <Text style={styles.status} testID="contribution-status-earned">
          Validated — credits applied when eligible
        </Text>
      ) : null}
      {phase === 'disputed' ? (
        <Text style={styles.status} testID="contribution-status-disputed">
          Needs admin review
        </Text>
      ) : null}

      {showActions ? (
        <View style={styles.actions}>
          <Pressable
            style={styles.button}
            onPress={() => void runSubmit('looks_correct')}
            accessibilityRole="button"
            accessibilityLabel="Looks correct"
            testID="contribution-looks-correct"
          >
            <Text style={styles.buttonText}>Looks correct</Text>
          </Pressable>
          {phase === 'editing' ? (
            <Pressable
              style={styles.button}
              onPress={() => void runSubmit('edit', editText)}
              accessibilityRole="button"
              accessibilityLabel="Submit edited translation"
              testID="contribution-submit-edit"
            >
              <Text style={styles.buttonText}>Submit edit</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.secondary}
              onPress={() => {
                setPhase('editing');
                setEditText(task?.model_output ?? '');
              }}
              accessibilityRole="button"
              accessibilityLabel="Edit translation"
              testID="contribution-edit"
            >
              <Text style={styles.secondaryText}>Edit translation</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.secondary}
            onPress={() => void runSubmit('skip')}
            accessibilityRole="button"
            accessibilityLabel="Skip task"
            testID="contribution-skip"
          >
            <Text style={styles.secondaryText}>Skip</Text>
          </Pressable>
          <Pressable
            style={styles.danger}
            onPress={() => void runSubmit('report_task')}
            accessibilityRole="button"
            accessibilityLabel="Report task"
            testID="contribution-report"
          >
            <Text style={styles.dangerText}>Report task</Text>
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
          accessibilityLabel="Retry contribution submit"
          testID="contribution-retry"
        >
          <Text style={styles.buttonText}>Retry</Text>
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
          accessibilityLabel="Load contribution task"
          testID="contribution-load"
        >
          <Text style={styles.buttonText}>
            {phase === 'loading'
              ? 'Loading…'
              : phase === 'lease_expired'
                ? 'Load new task'
                : phase === 'received' || phase === 'pending'
                  ? 'Load another'
                  : 'Load task'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 20,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  meta: { fontSize: 12, color: colors.textPlaceholder },
  status: { fontSize: 14, fontWeight: '600', color: colors.forest },
  error: { fontSize: 13, color: colors.danger, marginTop: 4 },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { gap: 8, marginTop: 4 },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  danger: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dangerText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
});
