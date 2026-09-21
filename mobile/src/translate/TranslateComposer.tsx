import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import type { Side } from './translationSessionReducer';

type Props = {
  value: string;
  side: Side;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onOpenOptions: () => void;
};

export function TranslateComposer({
  value,
  side,
  onChangeText,
  onSubmit,
  onOpenOptions,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.or}>or type</Text>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={side === 'en' ? 'Type to translate...' : 'टाइप गर्नुहोस्...'}
          placeholderTextColor={colors.textPlaceholder}
          style={styles.input}
          maxLength={240}
          testID="translate-input"
          accessibilityLabel="Translate input"
          returnKeyType="done"
        />
        <Pressable
          onPress={onOpenOptions}
          accessibilityRole="button"
          accessibilityLabel="Translation options"
          testID="translate-options"
          hitSlop={8}
          style={styles.options}
        >
          <Ionicons name="options-outline" size={20} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.count}>
        {value.length}/240
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingHorizontal: 20 },
  or: { textAlign: 'center', color: colors.textSecondary, fontSize: 13 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
  },
  options: { paddingHorizontal: 12, paddingVertical: 12 },
  count: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: colors.textPlaceholder,
  },
});
