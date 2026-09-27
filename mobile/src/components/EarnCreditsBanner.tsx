import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { t, useUiLang } from '../i18n';

type Props = {
  onSeeHow?: () => void;
};

/** Thin earn-credits strip. */
export function EarnCreditsBanner({ onSeeHow }: Props) {
  const lang = useUiLang();

  return (
    <Pressable
      onPress={onSeeHow}
      accessibilityRole="button"
      accessibilityLabel={t('earnBanner.seeHowA11y', lang)}
      style={styles.wrap}
      testID="earn-credits-banner"
    >
      <FontAwesome5 name="coins" size={16} color="#F0C14A" />
      <View style={styles.copy}>
        <Text style={styles.title}>{t('earnBanner.title', lang)}</Text>
        <Text style={styles.body} numberOfLines={1}>
          {t('earnBanner.body', lang)}
        </Text>
      </View>
      <View style={styles.seeHow} testID="earn-credits-see-how">
        <Text style={styles.seeHowText}>{t('earnBanner.seeHow', lang)} →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 8,
    marginBottom: 8,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 12,
    backgroundColor: '#3C3214',
    gap: 8,
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: '#F7F1EA',
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 17,
  },
  body: {
    color: '#E8D7A8',
    fontSize: 11,
    lineHeight: 14,
  },
  seeHow: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E8D7A8',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seeHowText: {
    color: '#F7F1EA',
    fontWeight: '700',
    fontSize: 12,
  },
});
