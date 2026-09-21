import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { formatNepaliScript } from '../mt/onDeviceTranslate';
import { colors } from '../theme';
import { isRetryableTurn, type SessionTurn } from './translationSessionReducer';
import type { NepaliScript } from '../mt/onDeviceTranslate';

type Props = {
  turn: SessionTurn;
  turns: SessionTurn[];
  script: NepaliScript;
  isLatest: boolean;
  onRetry: (turn: SessionTurn) => void;
  onMarkIncorrect?: () => void;
};

export function TurnCard({
  turn,
  turns,
  script,
  isLatest,
  onRetry,
  onMarkIncorrect,
}: Props) {
  const targetIsNepali = turn.from === 'en';
  const shown =
    targetIsNepali && script === 'roman'
      ? formatNepaliScript(turn.translation, 'roman')
      : turn.translation;
  const roman =
    targetIsNepali && script === 'deva'
      ? formatNepaliScript(turn.translation, 'roman')
      : '';

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
          onPress={() =>
            Speech.speak(turn.translation, {
              language: targetIsNepali ? 'ne-NP' : 'en-US',
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Speak translation aloud"
        >
          <Text style={styles.action}>Play</Text>
        </Pressable>
        {isRetryableTurn(turn, turns) ? (
          <Pressable
            onPress={() => onRetry(turn)}
            accessibilityRole="button"
            accessibilityLabel="Retry translation"
            testID={isLatest ? 'translate-retry' : undefined}
          >
            <Text style={styles.action}>Retry</Text>
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
  actions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  action: { fontSize: 13, fontWeight: '700', color: colors.crimson },
  mark: { color: colors.text },
});
