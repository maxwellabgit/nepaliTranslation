import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  awardCoinCount,
  AWARD_COIN_FLIGHT_MS,
  AWARD_COIN_STAGGER_MS,
} from '../features/contribution/reviewCredits';
import { t, useUiLang } from '../i18n';

const background = require('../../assets/credits/credits-awarded-bg.png');

type Props = {
  credits: number;
  minutes: number;
  capped: boolean;
  flying: boolean;
  onCollect: () => void;
  /** Remaining ad-free credits after this award. Hidden until the claim has a balance. */
  totalCredits?: number;
};

/**
 * Award message, then a coin stream that flies into the Home timer.
 * Burst size steps up every 10 credits and stops growing after 50.
 * The parent grows and shakes the timer while the coins are in flight.
 */
export function CreditAwardOverlay({
  credits,
  minutes,
  capped,
  flying,
  onCollect,
  totalCredits,
}: Props) {
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
          backgroundColor: '#1A1410',
        },
        frame: {
          flex: 1,
          paddingHorizontal: 22,
          paddingTop: 28,
          paddingBottom: 18,
        },
        title: {
          color: '#1B2A4A',
          fontSize: 34,
          lineHeight: 40,
          fontWeight: '800',
          textAlign: 'center',
        },
        body: {
          marginTop: 10,
          color: '#24344F',
          fontSize: 17,
          lineHeight: 24,
          fontWeight: '600',
          textAlign: 'center',
        },
        cap: {
          marginTop: 8,
          fontSize: 14,
          lineHeight: 20,
          textAlign: 'center',
          color: '#8A3B2A',
        },
        spacer: { flex: 1, minHeight: 80 },
        card: {
          backgroundColor: 'rgba(255,248,240,0.94)',
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: '#E4C98A',
          paddingVertical: 6,
          paddingHorizontal: 16,
        },
        row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
        rowIcon: { width: 28 },
        rowLabel: { flex: 1, color: '#3A3328', fontSize: 16, fontWeight: '600' },
        rowValue: { color: '#1B2A4A', fontSize: 16, fontWeight: '800', marginLeft: 8 },
        rule: { height: StyleSheet.hairlineWidth, backgroundColor: '#E6D7BE' },
        button: {
          marginTop: 16,
          backgroundColor: '#9B2335',
          borderRadius: 28,
          minHeight: 52,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        buttonText: { color: '#FFF8F0', fontWeight: '700', fontSize: 17 },
        view: {
          marginTop: 14,
          textAlign: 'center',
          color: '#FFF8F0',
          fontSize: 16,
          fontWeight: '700',
        },
        coin: { position: 'absolute', top: height * 0.46 },
      }),
    [height],
  );

  const showTotal = typeof totalCredits === 'number' && totalCredits > 0;

  return (
    <View style={styles.root} testID="credit-award-overlay" accessibilityViewIsModal>
      <ImageBackground source={background} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <Animated.View
        style={[
          styles.frame,
          {
            opacity: cardFade,
            transform: [
              { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
            ],
          },
        ]}
        testID="credit-award-card"
      >
        <Text style={styles.title}>{t('creditsAward.title', lang)}</Text>
        <Text style={styles.body} testID="credit-award-body">
          {t('creditsAward.body', lang, { count: credits })}
        </Text>
        {capped ? (
          <Text style={styles.cap} testID="credit-award-capped">
            {t('review.awardCapped', lang)}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        <View style={styles.card}>
          <View style={styles.row}>
            <FontAwesome5 name="star" size={16} color="#E8A317" solid style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{t('creditsAward.added', lang)}</Text>
            <Text style={styles.rowValue}>{credits}</Text>
          </View>
          {showTotal ? (
            <>
              <View style={styles.rule} />
              <View style={styles.row}>
                <FontAwesome5 name="coins" size={16} color="#C4A35A" solid style={styles.rowIcon} />
                <Text style={styles.rowLabel}>{t('creditsAward.total', lang)}</Text>
                <Text style={styles.rowValue}>{totalCredits}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.rule} />
          <View style={styles.row}>
            <FontAwesome5 name="gift" size={16} color="#C23B22" solid style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{t('creditsAward.reward', lang)}</Text>
            <Text style={styles.rowValue}>{t('creditsAward.rewardName', lang)}</Text>
          </View>
        </View>
        <Pressable
          style={styles.button}
          testID="credit-award-collect"
          accessibilityRole="button"
          accessibilityLabel={t('review.awardA11y', lang, { credits, minutes })}
          onPress={onCollect}
          disabled={flying}
        >
          <Text style={styles.buttonText}>{t('creditsAward.continue', lang)}</Text>
          <FontAwesome5 name="chevron-right" size={14} color="#FFF8F0" />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCollect} disabled={flying}>
          <Text style={styles.view}>{t('creditsAward.view', lang)}</Text>
        </Pressable>
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
