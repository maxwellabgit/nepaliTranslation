import { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

import { t, useUiLang } from '../i18n';

const ROTATE_MS = 60_000;
/** One height for Earn credits, the Google banner, and Go ad-free. */
const SLOT_HEIGHT = 52;

type SlideId = 'earn' | 'ad' | 'adfree';

type Props = {
  onAdFree: () => void;
  onEarn: () => void;
  /**
   * Google banner (or the testing-ground stand-in) for this same top slot.
   * Earn credits is the house creative: it has its own turn, and it also
   * fills the Google turn when no banner is loaded.
   */
  ad?: ReactNode;
  /** False while the Google banner has nothing to show. */
  adFilled?: boolean;
};

/** Top homepage strip. Earn credits, the Google banner, and go ad-free share one slot. */
export function PromoRotator({ onAdFree, onEarn, ad, adFilled = false }: Props) {
  const lang = useUiLang();
  const [tick, setTick] = useState(0);
  const slides: SlideId[] = ad ? ['earn', 'ad', 'adfree'] : ['earn', 'adfree'];
  const active = slides[tick % slides.length] ?? 'earn';
  const showNetwork = active === 'ad' && adFilled;

  useEffect(() => {
    const timer = setInterval(() => setTick((current) => current + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const house = (earn: boolean, covered = false) => {
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
        style={covered ? [styles.wrap, styles.covered] : styles.wrap}
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
  };

  if (active === 'ad') {
    return (
      <View style={styles.adWrap} testID="promo-ad-slide">
        {showNetwork ? (
          ad
        ) : (
          <>
            <View style={styles.preload} pointerEvents="none">
              {ad}
            </View>
            {house(true, true)}
          </>
        )}
      </View>
    );
  }

  return house(active === 'earn');
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 8,
    marginBottom: 8,
    height: SLOT_HEIGHT,
    paddingVertical: 0,
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
    height: SLOT_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
  },
  covered: {
    marginHorizontal: 0,
    marginBottom: 0,
    zIndex: 1,
  },
  preload: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
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
