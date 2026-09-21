import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="options-sheet">
        <View style={styles.sheet}>
          <Text style={styles.title}>Options</Text>
          <View style={styles.row}>
            <Choice
              label="Formal Nepali"
              selected={formality === 'formal'}
              onPress={() => onFormality(true)}
            />
            <Choice
              label="Informal Nepali"
              selected={formality === 'informal'}
              onPress={() => onFormality(false)}
            />
          </View>
          <View style={styles.row}>
            <Choice
              label="Devanagari"
              selected={script === 'deva'}
              onPress={() => onScript(true)}
            />
            <Choice
              label="Roman Nepali"
              selected={script === 'roman'}
              onPress={() => onScript(false)}
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
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26,20,16,0.35)',
  },
  sheet: {
    backgroundColor: colors.bg,
    padding: 20,
    gap: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  choiceOn: { backgroundColor: colors.crimson },
  choiceText: { fontWeight: '700', color: colors.text },
  choiceTextOn: { color: '#fff' },
});
