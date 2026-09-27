import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

import { t, useUiLang } from '../i18n';

const ROTATE_MS = 60_000;

type SlideId = 'adfree' | 'earn';

type Props = {
  onAdFree: () => void;
  onEarn: () => void;
};

/** Dark homepage strip. The two promos trade places every 60 seconds. */
export function PromoRotator({ onAdFree, onEarn }: Props) {
  const lang = useUiLang();
  const [active, setActive] = useState<SlideId>('adfree');

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((current) => (current === 'adfree' ? 'earn' : 'adfree'));
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const adFree = active === 'adfree';
  const title = adFree ? t('promo.adFreeTitle', lang) : t('earnBanner.title', lang);
  const body = adFree ? t('promo.adFreeBody', lang) : t('earnBanner.body', lang);
  const action = adFree ? t('promo.seeOptions', lang) : t('earnBanner.seeHow', lang);

  return (
    <Pressable
      onPress={adFree ? onAdFree : onEarn}
      accessibilityRole="button"
      accessibilityLabel={
        adFree ? t('promo.seeOptionsA11y', lang) : t('earnBanner.seeHowA11y', lang)
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
      <View style={styles.seeHow} testID={adFree ? 'promo-ad-free' : 'promo-earn'}>
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
