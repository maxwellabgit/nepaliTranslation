import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatNepaliScript } from '../mt/onDeviceTranslate';
import { colors } from '../theme';
import { useRuntime } from '../runtime/RuntimeContext';
import { isRetryableTurn, type SessionTurn } from './translationSessionReducer';
import type { NepaliScript } from '../mt/onDeviceTranslate';

type Props = {
  turn: SessionTurn;
  turns: SessionTurn[];
  script: NepaliScript;
  isLatest: boolean;
  busy?: boolean;
  onRetry: (turn: SessionTurn) => void;
  onMarkIncorrect?: () => void;
};

export function TurnCard({
  turn,
  turns,
  script,
  isLatest,
  busy = false,
  onRetry,
  onMarkIncorrect,
}: Props) {
  const runtime = useRuntime();
  const targetIsNepali = turn.from === 'en';
  const shown =
    targetIsNepali && script === 'roman'
      ? formatNepaliScript(turn.translation, 'roman')
      : turn.translation;
  const roman =
    targetIsNepali && script === 'deva'
      ? formatNepaliScript(turn.translation, 'roman')
      : '';
  const canRetry = isRetryableTurn(turn, turns);

  return (
    <View style={styles.card} testID={isLatest ? 'translate-turn' : undefined}>
      <Text style={styles.source}>{turn.source}</Text>
      <Text
        style={styles.translation}
        selectable
        testID={isLatest ? 'translate-output' : undefined}
      >
        {shown}
      </Text>
      {roman ? (
        <Text style={styles.roman} testID={isLatest ? 'translate-roman' : undefined}>
          {roman}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            runtime.speechSynthesis.stop();
            runtime.speechSynthesis.speak(turn.translation, {
              language: targetIsNepali ? 'ne-NP' : 'en-US',
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Speak translation aloud"
        >
          <Text style={styles.action}>Play</Text>
        </Pressable>
        <Pressable
          onPress={() => void Clipboard.setStringAsync(shown)}
          accessibilityRole="button"
          accessibilityLabel="Copy translation"
          testID={isLatest ? 'translate-copy' : undefined}
        >
          <Text style={styles.action}>Copy</Text>
        </Pressable>
        {canRetry ? (
          <Pressable
            onPress={() => onRetry(turn)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={
              busy ? 'Retry unavailable while translating' : 'Retry translation'
            }
            accessibilityState={{ disabled: busy }}
            testID={isLatest ? 'translate-retry' : undefined}
          >
            <Text style={[styles.action, busy && styles.actionOff]}>Retry</Text>
          </Pressable>
        ) : null}
        {isLatest && onMarkIncorrect ? (
          <Pressable
            onPress={onMarkIncorrect}
            accessibilityRole="button"
            accessibilityLabel="Mark incorrect"
            testID="mark-incorrect"
          >
            <Text style={[styles.action, styles.mark]}>Mark incorrect</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  source: { fontSize: 15, color: colors.textSecondary },
  translation: { fontSize: 22, fontWeight: '700', color: colors.text },
  roman: { fontSize: 14, color: colors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  action: { fontSize: 13, fontWeight: '700', color: colors.crimson },
  actionOff: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, opacity: 0.5 },
  mark: { color: colors.text },
});
