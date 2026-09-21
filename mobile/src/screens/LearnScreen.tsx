import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton, AppCard } from '../components/AppPrimitives';
import { colors } from '../theme';
import { AlphabetLesson } from '../learn/AlphabetLesson';
import { RewardSummaryCard } from '../learn/RewardSummaryCard';
import { AdSlot } from '../features/ads/AdSlot';
import { RewardedAdButton } from '../features/ads/RewardedAdButton';

type Props = {
  active: boolean;
  onOpenContributions?: () => void;
};

type LearnView = 'landing' | 'alphabet';

/**
 * Learn tab landing: Nepali alphabet (offline) + contribution/reward entry.
 * Alphabet detail never requires an account.
 */
export function LearnScreen({ active, onOpenContributions }: Props) {
  const [view, setView] = useState<LearnView>('landing');

  if (!active) {
    return <View testID="learn-screen-inactive" />;
  }

  if (view === 'alphabet') {
    return <AlphabetLesson onBack={() => setView('landing')} />;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="learn-screen"
    >
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
        Learn
      </Text>
      <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
        Alphabet offline. Contributions are optional.
      </Text>

      <AppCard style={styles.card} testID="learn-card-alphabet">
        <Text style={styles.cardTitle} maxFontSizeMultiplier={1.4}>
          Nepali alphabet
        </Text>
        <Text style={styles.cardBody} maxFontSizeMultiplier={1.4}>
          Vowels, consonants, and common conjuncts — offline, no account needed.
        </Text>
        <AppButton
          label="Open alphabet"
          onPress={() => setView('alphabet')}
          accessibilityLabel="Nepali alphabet, offline, no account needed"
          testID="learn-open-alphabet"
          style={styles.cardAction}
        />
      </AppCard>

      <AdSlot surface="learn_landing" eligible={view === 'landing'} />

      <AppCard style={styles.card} testID="learn-card-contribute">
        <Text style={styles.cardTitle} maxFontSizeMultiplier={1.4}>
          Help improve translations
        </Text>
        <Text style={styles.cardBody} maxFontSizeMultiplier={1.4}>
          Review a contribution when signed in, track drafts, and see reward
          progress. Never required for alphabet study.
        </Text>
        <View style={styles.summaryWrap}>
          <RewardSummaryCard active={active && view === 'landing'} />
        </View>
        <RewardedAdButton />
        <AppButton
          label="Open contributions"
          variant="secondary"
          onPress={() => onOpenContributions?.()}
          disabled={!onOpenContributions}
          accessibilityLabel="Help improve translations"
          testID="learn-open-contributions"
          style={styles.cardAction}
        />
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  card: { gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  summaryWrap: { marginTop: 10 },
  cardAction: { marginTop: 12 },
});
