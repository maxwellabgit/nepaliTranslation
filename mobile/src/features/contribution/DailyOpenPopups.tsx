import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { t, useUiLang } from '../../i18n';
import { dismissDailyAd, grantDailyOpenCoin, readDailyOpen } from './dailyOpen';
import { loadReviewDay } from './reviewDayStore';
import { nyDateKey } from './reviewDayPlan';

const ART = {
  english: require('../../../assets/review/english.png'),
  deva: require('../../../assets/review/devanagari.png'),
  roman: require('../../../assets/review/romanized.png'),
} as const;

type Step = 'coin' | 'ad' | 'off';

/**
 * First open of a New York day: one coin, then a placeholder ad-free ad
 * that uses the three Today's 10 category pictures.
 */
export function DailyOpenPopups() {
  const lang = useUiLang();
  const [step, setStep] = useState<Step>('off');
  const [peeked, setPeeked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const today = nyDateKey(Date.now());
      const before = await readDailyOpen();
      if (before?.nyDate === today && before.adDismissed) return;
      await grantDailyOpenCoin();
      const day = await loadReviewDay();
      if (cancelled) return;
      setPeeked(day.seen && day.reviewed.length === 0);
      setStep(before?.nyDate === today ? 'ad' : 'coin');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (step === 'off') return null;

  const closeCoin = () => setStep('ad');
  const closeAd = () => {
    setStep('off');
    void dismissDailyAd();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={step === 'coin' ? closeCoin : closeAd}>
      <View style={styles.scrim}>
        {step === 'coin' ? (
          <View style={styles.card} testID="daily-open-coin">
            <FontAwesome5 name="coins" size={28} color="#E8A317" />
            <Text style={styles.title}>{t('dailyOpen.title', lang)}</Text>
            <Text style={styles.body}>{t('dailyOpen.body', lang)}</Text>
            {peeked ? <Text style={styles.note}>{t('dailyOpen.noReview', lang)}</Text> : null}
            <Pressable style={styles.button} testID="daily-open-continue" onPress={closeCoin}>
              <Text style={styles.buttonText}>{t('dailyOpen.continue', lang)}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card} testID="daily-open-ad">
            <View style={styles.artRow}>
              <Image source={ART.english} style={styles.art} />
              <Image source={ART.deva} style={styles.art} />
              <Image source={ART.roman} style={styles.art} />
            </View>
            <Text style={styles.title}>{t('dailyOpen.adTitle', lang)}</Text>
            <Text style={styles.body}>{t('dailyOpen.adBody', lang)}</Text>
            <Pressable style={styles.button} testID="daily-open-ad-close" onPress={closeAd}>
              <Text style={styles.buttonText}>{t('dailyOpen.adClose', lang)}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(26,20,16,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF8F0',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1B2A4A', textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 22, color: '#3A3328', textAlign: 'center' },
  note: { fontSize: 14, lineHeight: 20, color: '#8A3B2A', textAlign: 'center' },
  button: {
    marginTop: 6,
    backgroundColor: '#9B2335',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: { color: '#FFF8F0', fontWeight: '700', fontSize: 16 },
  artRow: { flexDirection: 'row', gap: 8 },
  art: { width: 88, height: 64, borderRadius: 10 },
});
