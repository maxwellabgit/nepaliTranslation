import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  awardCoinCount,
  AWARD_COIN_FLIGHT_MS,
  AWARD_COIN_STAGGER_MS,
} from '../features/contribution/reviewCredits';
import { t, useUiLang } from '../i18n';

type Props = {
  credits: number;
  minutes: number;
  capped: boolean;
  flying: boolean;
  onCollect: () => void;
};

/**
 * Award message, then a coin stream that flies into the Home timer.
 * Burst size steps up every 10 credits and stops growing after 50.
 * The parent grows and shakes the timer while the coins are in flight.
 */
export function CreditAwardOverlay({ credits, minutes, capped, flying, onCollect }: Props) {
  const lang = useUiLang();
  const { height } = useWindowDimensions();
  const count = awardCoinCount(credits);
  const [card] = useState(() => new Animated.Value(0));
  const [cardFade] = useState(() => new Animated.Value(1));
  const coins = useMemo(
    () => Array.from({ length: count }, () => new Animated.Value(0)),
    [count],
  );
  const travelY = 18 - height * 0.46;

  useEffect(() => {
    Animated.spring(card, {
      toValue: 1,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [card]);

  useEffect(() => {
    if (!flying) return;
    Animated.timing(cardFade, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
    Animated.stagger(
      AWARD_COIN_STAGGER_MS,
      coins.map((coin) =>
        Animated.timing(coin, {
          toValue: 1,
          duration: AWARD_COIN_FLIGHT_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [cardFade, coins, flying]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          ...StyleSheet.absoluteFill,
          zIndex: 30,
        },
        dim: {
          ...StyleSheet.absoluteFill,
          backgroundColor: 'rgba(28, 18, 8, 0.45)',
        },
        cardWrap: {
          ...StyleSheet.absoluteFill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        card: {
          width: '86%',
          maxWidth: 360,
          borderRadius: 22,
          paddingHorizontal: 22,
          paddingTop: 22,
          paddingBottom: 18,
          backgroundColor: '#FFF8E8',
          borderWidth: 1,
          borderColor: '#E2C27A',
          alignItems: 'center',
          gap: 10,
        },
        title: { fontSize: 22, fontWeight: '800', color: '#6B4A12', textAlign: 'center' },
        body: { fontSize: 16, lineHeight: 22, textAlign: 'center', color: '#3A3018' },
        cap: { fontSize: 14, lineHeight: 20, textAlign: 'center', color: '#8A3B2A' },
        button: {
          marginTop: 6,
          backgroundColor: '#C4922A',
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 12,
        },
        buttonText: { color: '#FFF8E8', fontWeight: '800', fontSize: 16 },
        coin: { position: 'absolute', top: height * 0.46 },
      }),
    [height],
  );

  return (
    <View style={styles.root} testID="credit-award-overlay" accessibilityViewIsModal>
      <Animated.View style={[styles.dim, { opacity: cardFade }]} />
      <Animated.View
        style={[
          styles.cardWrap,
          {
            opacity: cardFade,
            transform: [
              { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
            ],
          },
        ]}
        testID="credit-award-card"
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t('review.awardTitle', lang)}</Text>
          <Text style={styles.body} testID="credit-award-body">
            {t('review.awardBody', lang, { credits, minutes })}
          </Text>
          {capped ? (
            <Text style={styles.cap} testID="credit-award-capped">
              {t('review.awardCapped', lang)}
            </Text>
          ) : null}
          <Pressable
            style={styles.button}
            testID="credit-award-collect"
            accessibilityRole="button"
            accessibilityLabel={t('review.awardA11y', lang, { credits, minutes })}
            onPress={onCollect}
            disabled={flying}
          >
            <Text style={styles.buttonText}>{t('review.awardCollect', lang)}</Text>
          </Pressable>
        </View>
      </Animated.View>
      {coins.map((coin, index) => {
        const across = count <= 1 ? 0.5 : index / (count - 1);
        const drift = (across - 0.5) * Math.min(240, 40 + count * 8);
        const lift = (index % 3) * 16;
        const translateY = coin.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [lift, travelY * 0.42 + lift * 0.4, travelY],
        });
        const translateX = coin.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [drift, drift * 0.62, drift * 0.08],
        });
        const scale = coin.interpolate({
          inputRange: [0, 0.18, 0.72, 1],
          outputRange: [0.35, 1.12, 0.9, 0.18],
        });
        const rotate = coin.interpolate({
          inputRange: [0, 1],
          outputRange: [`${(index % 2 === 0 ? -16 : 12)}deg`, '4deg'],
        });
        const opacity = coin.interpolate({
          inputRange: [0, 0.06, 0.82, 1],
          outputRange: [flying ? 1 : 0, 1, 1, 0],
        });
        return (
          <Animated.View
            key={index}
            testID={`credit-award-coin-${index}`}
            pointerEvents="none"
            style={[
              styles.coin,
              {
                left: '50%',
                marginLeft: -13,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }, { rotate }],
              },
            ]}
          >
            <FontAwesome5 name="coins" size={26} color="#E0A82E" />
          </Animated.View>
        );
      })}
    </View>
  );
}
