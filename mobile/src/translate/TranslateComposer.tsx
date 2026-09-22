import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';
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
  const theme = useTheme();
  const lang = useUiLang();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: 8, paddingHorizontal: 20 },
        or: {
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontSize: 13,
        },
        field: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          paddingLeft: 14,
        },
        input: {
          flex: 1,
          minHeight: 48,
          fontSize: 16,
          color: theme.colors.text,
        },
        options: {
          minWidth: 44,
          minHeight: 44,
          paddingHorizontal: 12,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        count: {
          alignSelf: 'flex-end',
          fontSize: 11,
          color: theme.colors.textPlaceholder,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.or}>{t('translate.orType', lang)}</Text>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={
            side === 'en'
              ? t('translate.placeholderEn', lang)
              : t('translate.placeholderNe', lang)
          }
          placeholderTextColor={theme.colors.textPlaceholder}
          style={styles.input}
          maxLength={240}
          testID="translate-input"
          accessibilityLabel={t('translate.inputA11y', lang)}
          returnKeyType="done"
        />
        <Pressable
          onPress={onOpenOptions}
          accessibilityRole="button"
          accessibilityLabel={t('translate.optionsA11y', lang)}
          testID="translate-options"
          hitSlop={8}
          style={styles.options}
        >
          <Ionicons name="options-outline" size={20} color={theme.colors.text} />
        </Pressable>
      </View>
      <Text style={styles.count}>{value.length}/240</Text>
    </View>
  );
}
