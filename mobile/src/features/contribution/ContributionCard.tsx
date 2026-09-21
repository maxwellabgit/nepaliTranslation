import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchNextContribution, type PublicContribution } from './contributionApi';
import { useFeatureFlags } from '../../app/FeatureConfigProvider';
import { colors } from '../../theme';

/**
 * Contribution queue card. Hidden while contributionsEnabled is false.
 * Never gates Auto/Conversation translation.
 */
export function ContributionCard() {
  const auth = useAuth();
  const flags = useFeatureFlags();
  const [task, setTask] = useState<PublicContribution | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const load = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await fetchNextContribution({
        signedIn: auth.status === 'signed-in',
        authConfigured: auth.authConfigured,
      });
      if (!result.ok) {
        setTask(null);
        setMessage(
          result.reason === 'sign_in'
            ? 'Sign in with Apple in Settings to contribute.'
            : result.reason === 'consent'
              ? 'Save contribution consent in Settings first.'
              : 'Contributions are unavailable right now.',
        );
        return;
      }
      setTask(result.assignment);
      if (!result.assignment) setMessage('No tasks available right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box} testID="contribution-card">
      <Text style={styles.title}>Contribute a review</Text>
      {task ? (
        <>
          <Text style={styles.label}>Source</Text>
          <Text style={styles.body}>{task.source_text}</Text>
          <Text style={styles.label}>Model output</Text>
          <Text style={styles.body}>{task.model_output}</Text>
          <Text style={styles.meta}>{task.reward_label}</Text>
        </>
      ) : (
        <Text style={styles.body}>
          {message ?? 'Load a task when you want to help improve translations.'}
        </Text>
      )}
      <Pressable
        style={styles.button}
        onPress={() => void load()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Load contribution task"
        testID="contribution-load"
      >
        <Text style={styles.buttonText}>{busy ? 'Loading…' : 'Load task'}</Text>
      </Pressable>
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
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
