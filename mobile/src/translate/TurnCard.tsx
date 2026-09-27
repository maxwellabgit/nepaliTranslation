import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { companionNepaliScript, formatNepaliScript } from '../mt/onDeviceTranslate';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';
import { useRuntime } from '../runtime/RuntimeContext';
import type { SessionTurn } from './translationSessionReducer';
import type { NepaliScript } from '../mt/onDeviceTranslate';

type Props = {
  turn: SessionTurn;
  turns: SessionTurn[];
  script: NepaliScript;
  isLatest: boolean;
  /** True while this turn still belongs to the person holding the phone. */
  sent?: boolean;
  /** Show the original wording instead of the translation. */
  original?: boolean;
  /** Alternate shade against the neighboring bubble. */
  alt?: boolean;
};

export function TurnCard({
  turn,
  script,
  isLatest,
  sent = false,
  original = false,
  alt = false,
}: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const runtime = useRuntime();
  const nepaliText = original
    ? turn.from === 'ne'
      ? turn.source
      : ''
    : turn.from === 'en'
      ? turn.translation
      : '';
  const shown = nepaliText
    ? formatNepaliScript(nepaliText, script)
    : original
      ? turn.source
      : turn.translation;
  const scriptLine = nepaliText ? companionNepaliScript(nepaliText, script) : '';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          alignSelf: 'stretch',
          width: '100%',
          backgroundColor: sent
            ? alt
              ? '#F8E6E8'
              : '#F3D5D8'
            : alt
              ? theme.colors.pasteBg
              : theme.colors.surface,
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 4,
        },
        translation: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.colors.text,
        },
        roman: {
          fontSize: 13,
          color: theme.colors.textSecondary,
        },
        play: {
          alignSelf: 'flex-start',
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [alt, sent, theme],
  );

  return (
    <View style={styles.card} testID={isLatest ? 'translate-turn' : undefined}>
      <Text
        style={styles.translation}
        selectable
        testID={isLatest ? 'translate-output' : undefined}
      >
        {shown}
      </Text>
      {scriptLine && scriptLine !== shown ? (
        <Text style={styles.roman} testID={isLatest ? 'translate-result-script' : undefined}>
          {scriptLine}
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          if (!shown.trim()) return;
          runtime.speechSynthesis.stop();
          runtime.speechSynthesis.speak(shown, {
            language: nepaliText ? 'ne-NP' : 'en-US',
          });
        }}
        accessibilityRole="button"
        accessibilityLabel={t('translate.playA11y', lang)}
        testID={isLatest ? 'translate-play' : undefined}
        style={styles.play}
      >
        <Ionicons
          name="play"
          size={22}
          color={theme.colors.text}
        />
      </Pressable>
    </View>
  );
}
