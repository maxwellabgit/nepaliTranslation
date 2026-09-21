import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';
import type { Formality, NepaliScript } from '../mt/onDeviceTranslate';

type Props = {
  visible: boolean;
  formality: Formality;
  script: NepaliScript;
  onClose: () => void;
  onFormality: (formal: boolean) => void;
  onScript: (deva: boolean) => void;
};

export function OptionsSheet({
  visible,
  formality,
  script,
  onClose,
  onFormality,
  onScript,
}: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor:
            theme.scheme === 'dark'
              ? 'rgba(0,0,0,0.55)'
              : 'rgba(26,20,16,0.35)',
        },
        sheet: {
          backgroundColor: theme.colors.bg,
          padding: 20,
          gap: 12,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        },
        title: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.colors.text,
        },
        row: { flexDirection: 'row', gap: 8 },
        choice: {
          flex: 1,
          minHeight: 44,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: 10,
        },
        choiceOn: { backgroundColor: theme.colors.crimson },
        choiceText: { fontWeight: '700', color: theme.colors.text },
        choiceTextOn: { color: theme.colors.onPrimary },
      }),
    [theme],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="options-sheet">
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('translate.optionsTitle', lang)}</Text>
          <View style={styles.row}>
            <Choice
              label={t('translate.formal', lang)}
              selected={formality === 'formal'}
              onPress={() => onFormality(true)}
              styles={styles}
            />
            <Choice
              label={t('translate.informal', lang)}
              selected={formality === 'informal'}
              onPress={() => onFormality(false)}
              styles={styles}
            />
          </View>
          <View style={styles.row}>
            <Choice
              label={t('translate.devanagari', lang)}
              selected={script === 'deva'}
              onPress={() => onScript(true)}
              styles={styles}
            />
            <Choice
              label={t('translate.roman', lang)}
              selected={script === 'roman'}
              onPress={() => onScript(false)}
              styles={styles}
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function Choice({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: {
    choice: object;
    choiceOn: object;
    choiceText: object;
    choiceTextOn: object;
  };
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}
