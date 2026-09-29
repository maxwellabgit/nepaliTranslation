import { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

import { t, useUiLang } from '../i18n';

const ROTATE_MS = 60_000;

type SlideId = 'earn' | 'ad' | 'adfree';

type Props = {
  onAdFree: () => void;
  onEarn: () => void;
  /**
   * Network banner (or the testing-ground stand-in) shown in this same top slot.
   * Earn credits stays in the rotation when this is present, including once a
   * live ad fills the slot.
   */
  ad?: ReactNode;
};

/** Top homepage strip. Earn credits, the banner ad, and go ad-free share one slot. */
export function PromoRotator({ onAdFree, onEarn, ad }: Props) {
  const lang = useUiLang();
  const [tick, setTick] = useState(0);
  const slides: SlideId[] = ad ? ['earn', 'ad', 'adfree'] : ['earn', 'adfree'];
  const active = slides[tick % slides.length] ?? 'earn';

  useEffect(() => {
    const timer = setInterval(() => setTick((current) => current + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  if (active === 'ad') {
    return (
      <View style={styles.adWrap} testID="promo-ad-slide">
        {ad}
      </View>
    );
  }

  const earn = active === 'earn';
  const title = earn ? t('earnBanner.title', lang) : t('promo.adFreeTitle', lang);
  const body = earn ? t('earnBanner.body', lang) : t('promo.adFreeBody', lang);
  const action = earn ? t('earnBanner.seeHow', lang) : t('promo.seeOptions', lang);

  return (
    <Pressable
      onPress={earn ? onEarn : onAdFree}
      accessibilityRole="button"
      accessibilityLabel={
        earn ? t('earnBanner.seeHowA11y', lang) : t('promo.seeOptionsA11y', lang)
      }
      style={styles.wrap}
      testID="promo-rotator"
    >
      <FontAwesome5 name="coins" size={16} color="#F0C14A" />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body} numberOfLines={1}>
          {body}
        </Text>
      </View>
      <View style={styles.seeHow} testID={earn ? 'promo-earn' : 'promo-ad-free'}>
        <Text style={styles.seeHowText}>{action} →</Text>
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
  adWrap: {
    alignSelf: 'stretch',
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
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
