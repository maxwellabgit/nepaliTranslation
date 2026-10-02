import { useEffect, useMemo } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { awardCoinCount, AWARD_COIN_FLIGHT_MS, AWARD_COIN_STAGGER_MS } from '../features/contribution/reviewCredits';
import { t, useUiLang } from '../i18n';
import { useCreditAwardOptional } from './CreditAwardProvider';

type Props = { credits: number; minutes: number; capped: boolean; flying: boolean; onCollect: () => void;
  totalCredits?: number; title?: string; body?: string; rewardName?: string };

export function CreditAwardOverlay({ credits, minutes, capped, flying, onCollect, title, body }: Props) {
  const lang = useUiLang();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const award = useCreditAwardOptional();
  const coins = useMemo(() => Array.from({ length: awardCoinCount(credits) }, () => new Animated.Value(0)), [credits]);
  useEffect(() => {
    if (!flying) return;
    Animated.stagger(AWARD_COIN_STAGGER_MS, coins.map(coin => Animated.timing(coin, {
      toValue: 1, duration: AWARD_COIN_FLIGHT_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }))).start();
  }, [coins, flying]);
  const target = award.coinTarget ?? { x: width - 85, y: 74 };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={flying ? 'none' : 'auto'} testID="credit-award-overlay">
      {!flying && <Modal transparent visible animationType="fade" onRequestClose={onCollect}>
      <View style={styles.scrim} accessibilityViewIsModal>
        <View style={[styles.card, { maxHeight: Math.max(120, height - insets.top - insets.bottom - 32) }]} testID="credit-award-card">
          <ScrollView style={styles.scroll}>
          <View style={styles.artFrame}>
            <Image source={require('../../assets/credits/credits-awarded-bg.png')} style={styles.art} resizeMode="cover" testID="credit-award-art" accessible={false} />
          </View>
          <View style={styles.cardContent}>
          <Text style={styles.title}>{title ?? t('creditsAward.title', lang)}</Text>
          <Text style={styles.body} testID="credit-award-body">{body ?? t('creditsAward.body', lang, { count: credits })}</Text>
          <View style={styles.amount}><Text style={styles.number}>{credits}</Text><Text style={styles.caption}>{t('creditsAward.added', lang)}</Text></View>
          {capped && <Text testID="credit-award-capped" style={styles.body}>{t('review.awardCapped', lang)}</Text>}
          <Pressable style={styles.button} testID="credit-award-collect" accessibilityRole="button"
            accessibilityLabel={t('review.awardA11y', lang, { credits, minutes })} onPress={onCollect}>
            <Text style={styles.buttonText}>{t('dailyOpen.continue', lang)}</Text>
          </Pressable>
          </View>
          </ScrollView>
        </View>
      </View></Modal>}
      {flying && coins.map((coin, index) => <Animated.View key={index} testID={`credit-award-coin-${index}`}
        pointerEvents="none" style={{ position: 'absolute', left: width / 2 - 12, top: height / 2 - 12,
          opacity: coin.interpolate({ inputRange: [0, .08, .85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: coin.interpolate({ inputRange: [0, .3, 1], outputRange: [(index - 3) * 10, (index - 3) * 14, target.x - width / 2] }) },
            { translateY: coin.interpolate({ inputRange: [0, 1], outputRange: [0, target.y - height / 2] }) },
            { scale: coin.interpolate({ inputRange: [0, .2, 1], outputRange: [.6, 1, .35] }) },
          ] }}><FontAwesome5 name="coins" size={24} color="#C4922A" /></Animated.View>)}
    </View>
  );
}
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(26,20,16,0.38)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 400, borderRadius: 24, backgroundColor: '#FFF8F0', overflow: 'hidden' },
  scroll: { flexGrow: 0 },
  artFrame: { width: '100%', height: 150, overflow: 'hidden' },
  art: { width: '100%', height: 340, position: 'absolute', top: 0 },
  cardContent: { padding: 28, alignItems: 'center', gap: 16 },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', color: '#1B2A4A', textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 23, color: '#3A3328', textAlign: 'center' },
  amount: { alignItems: 'center', gap: 2 }, number: { fontSize: 48, lineHeight: 56, fontWeight: '800', color: '#9B2335' },
  caption: { fontSize: 14, color: '#6B4A12' },
  button: { alignSelf: 'stretch', backgroundColor: '#9B2335', borderRadius: 26, minHeight: 50, justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '700', color: '#FFF8F0' },
});
