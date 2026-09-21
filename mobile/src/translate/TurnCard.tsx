import { useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatNepaliScript } from '../mt/onDeviceTranslate';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';
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
  const theme = useTheme();
  const lang = useUiLang();
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          padding: 14,
          gap: 6,
        },
        source: { fontSize: 15, color: theme.colors.textSecondary },
        translation: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.text,
        },
        roman: { fontSize: 14, color: theme.colors.textSecondary },
        actions: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 16,
          marginTop: 6,
        },
        action: {
          fontSize: 13,
          fontWeight: '700',
          color: theme.colors.crimson,
          minHeight: 44,
          textAlignVertical: 'center',
        },
        actionOff: {
          fontSize: 13,
          fontWeight: '700',
          color: theme.colors.textSecondary,
          opacity: 0.5,
          minHeight: 44,
          textAlignVertical: 'center',
        },
        mark: { color: theme.colors.text },
      }),
    [theme],
  );

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
          accessibilityLabel={t('translate.playA11y', lang)}
        >
          <Text style={styles.action}>{t('common.play', lang)}</Text>
        </Pressable>
        <Pressable
          onPress={() => void Clipboard.setStringAsync(shown)}
          accessibilityRole="button"
          accessibilityLabel={t('translate.copyA11y', lang)}
          testID={isLatest ? 'translate-copy' : undefined}
        >
          <Text style={styles.action}>{t('common.copy', lang)}</Text>
        </Pressable>
        {canRetry ? (
          <Pressable
            onPress={() => onRetry(turn)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={
              busy
                ? t('translate.retryBusyA11y', lang)
                : t('translate.retryA11y', lang)
            }
            accessibilityState={{ disabled: busy }}
            testID={isLatest ? 'translate-retry' : undefined}
          >
            <Text style={[styles.action, busy && styles.actionOff]}>
              {t('common.retry', lang)}
            </Text>
          </Pressable>
        ) : null}
        {isLatest && onMarkIncorrect ? (
          <Pressable
            onPress={onMarkIncorrect}
            accessibilityRole="button"
            accessibilityLabel={t('translate.markIncorrectA11y', lang)}
            testID="mark-incorrect"
          >
            <Text style={[styles.action, styles.mark]}>
              {t('translate.markIncorrect', lang)}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
