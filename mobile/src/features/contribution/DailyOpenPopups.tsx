import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { t, useUiLang } from '../../i18n';
import { useEntitlementOptional } from '../entitlements/EntitlementProvider';
import { presentCreditClaim, useCreditAwardOptional } from '../../translate/CreditAwardProvider';
import { minutesForCredits } from './reviewCredits';
import { dismissDailyAd, grantDailyOpenCoin, laterActiveUntil, readDailyOpen } from './dailyOpen';
import {
  DAILY_OPEN_CREDITS,
  FIRST_OPEN_CREDITS,
  FIRST_OPEN_WELCOME,
  openAwardCopy,
  type OpenAwardKind,
} from './openWelcome';
import { loadReviewDay } from './reviewDayStore';
import { nyDateKey } from './reviewDayPlan';

const ART = {
  english: require('../../../assets/review/english.png'),
  deva: require('../../../assets/review/devanagari.png'),
  roman: require('../../../assets/review/romanized.png'),
} as const;

type Step = 'welcome' | 'ad' | 'off';

type Plan = {
  kind: OpenAwardKind;
  credits: number;
  beforeUntilMs: number | null;
};

/**
 * After startup consent: first-open welcome cards, then the ad-free popup.
 * The credit award animation starts when that last popup closes.
 * First open grants 10 credits. Each later New York day's first open grants 5.
 */
export function DailyOpenPopups() {
  const lang = useUiLang();
  const award = useCreditAwardOptional();
  const entitlement = useEntitlementOptional();
  const [step, setStep] = useState<Step>('off');
  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const [peeked, setPeeked] = useState(false);
  const planRef = useRef<Plan | null>(null);
  const entitlementUntil = useRef<number | null>(null);
  const langRef = useRef(lang);
  const closing = useRef(false);
  entitlementUntil.current = entitlement?.earnedAdFreeUntilMs ?? null;
  langRef.current = lang;

  useEffect(() => {
    award.holdAwards();
    let cancelled = false;
    void (async () => {
      try {
        const today = nyDateKey(Date.now());
        const before = await readDailyOpen();
        const day = await loadReviewDay();
        if (cancelled) return;
        setPeeked(day.seen && day.reviewed.length === 0);
        const grantedToday = before?.nyDate === today;
        planRef.current = grantedToday
          ? null
          : {
              kind: before ? 'daily' : 'welcome',
              credits: before ? DAILY_OPEN_CREDITS : FIRST_OPEN_CREDITS,
              beforeUntilMs: before && before.untilMs > Date.now() ? before.untilMs : null,
            };
        if (!before && FIRST_OPEN_WELCOME.length > 0) {
          setWelcomeIndex(0);
          setStep('welcome');
          return;
        }
        if (!grantedToday || !before.adDismissed) {
          setStep('ad');
          return;
        }
        award.releaseAwards();
      } catch {
        if (!cancelled) award.releaseAwards();
      }
    })();
    return () => {
      cancelled = true;
    };
    // Hold once on mount. Award callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    if (closing.current) return;
    closing.current = true;
    void (async () => {
      const plan = planRef.current;
      const now = new Date();
      try {
        if (plan) {
          const nowMs = now.getTime();
          const beforeUntil = laterActiveUntil(plan.beforeUntilMs, entitlementUntil.current, nowMs);
          const presentation = presentCreditClaim({
            nowMs,
            earnedUntilMs: beforeUntil,
            credits: plan.credits,
            minutesApplied: minutesForCredits(plan.credits),
            capped: false,
          });
          const copy = openAwardCopy(plan.kind, langRef.current, plan.credits);
          await grantDailyOpenCoin(now, beforeUntil);
          await dismissDailyAd(now);
          award.startAward({ ...presentation, ...copy });
        } else {
          await dismissDailyAd(now);
        }
      } finally {
        setStep('off');
        award.releaseAwards();
      }
    })();
  };

  const closeWelcome = () => {
    const next = welcomeIndex + 1;
    if (next < FIRST_OPEN_WELCOME.length) {
      setWelcomeIndex(next);
      return;
    }
    setStep('ad');
  };

  if (step === 'off') return null;

  const card = FIRST_OPEN_WELCOME[welcomeIndex];

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={step === 'welcome' ? closeWelcome : finish}
    >
      <View style={styles.scrim}>
        {step === 'welcome' && card ? (
          <View style={styles.card} testID="welcome-card">
            <FontAwesome5 name="coins" size={28} color="#E8A317" />
            <Text style={styles.title} testID="welcome-title">
              {card.title[lang]}
            </Text>
            <Text style={styles.body} testID="welcome-body">
              {card.body[lang]}
            </Text>
            <Pressable style={styles.button} testID="welcome-continue" onPress={closeWelcome}>
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
            {peeked ? <Text style={styles.note}>{t('dailyOpen.noReview', lang)}</Text> : null}
            <Pressable style={styles.button} testID="daily-open-ad-close" onPress={finish}>
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
