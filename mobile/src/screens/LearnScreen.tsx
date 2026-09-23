import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';

import { EmptyState } from '../components/EmptyState';
import { StatusBanner } from '../components/StatusBanner';
import { t, useUiLang } from '../i18n';
import { ALPHABET_SECTIONS, type AlphabetGlyph } from '../learn/alphabet';
import { RewardSummaryCard } from '../learn/RewardSummaryCard';
import { AdSlot } from '../features/ads/AdSlot';
import { requestInterstitialOpportunity } from '../features/ads/InterstitialController';
import { hasNepaliVoice } from '../stt/sttSupport';
import { useTheme } from '../theme';

type Props = {
  active: boolean;
  onOpenTodaysReview?: () => void;
};

const COLUMNS = 5;

/**
 * Learn: earn-rewards summary, then the full alphabet in order.
 * Letters are on the page for everyone — nothing sits behind a second screen.
 */
export function LearnScreen({ active, onOpenTodaysReview }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const [voiceOk, setVoiceOk] = useState(true);
  const [voiceChecked, setVoiceChecked] = useState(false);

  useEffect(() => {
    if (!active) return;
    void hasNepaliVoice().then((ok) => {
      setVoiceOk(ok);
      setVoiceChecked(true);
    });
  }, [active]);

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
        content: {
          padding: theme.spacing.lg,
          paddingBottom: 36,
          gap: 18,
        },
        sectionTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 10,
        },
        tile: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          minHeight: 72,
        },
        glyph: {
          fontSize: theme.typography.glyph.fontSize,
          fontWeight: theme.typography.glyph.fontWeight,
          color: theme.colors.text,
          lineHeight: theme.typography.glyph.lineHeight,
        },
        roman: {
          marginTop: 2,
          fontSize: 13,
          color: theme.colors.textSecondary,
        },
      }),
    [theme],
  );

  if (!active) {
    return <View testID="learn-screen-inactive" />;
  }

  if (voiceChecked && ALPHABET_SECTIONS.length === 0) {
    return (
      <View style={dynamic.root} testID="learn-screen">
        <EmptyState
          kind="empty"
          title={t('common.empty', lang)}
          testID="learn-empty"
        />
      </View>
    );
  }

  const speak = (glyph: AlphabetGlyph) => {
    if (!voiceOk) return;
    Speech.stop();
    Speech.speak(glyph.dewanagari, {
      language: 'ne-NP',
      rate: 0.85,
      onDone: () => {
        requestInterstitialOpportunity({
          transition: 'learn_activity_completed',
          surface: 'learn_landing',
        });
      },
    });
  };

  return (
    <ScrollView
      style={dynamic.root}
      contentContainerStyle={dynamic.content}
      keyboardShouldPersistTaps="handled"
      testID="learn-screen"
    >
      {voiceChecked && !voiceOk ? (
        <StatusBanner
          tone="warn"
          message={`${t('learn.noVoiceTitle', lang)}. ${t('learn.noVoiceDetail', lang)}`}
          testID="learn-no-voice-banner"
        />
      ) : null}

      <Pressable
        onPress={onOpenTodaysReview}
        disabled={!onOpenTodaysReview}
        accessibilityRole="button"
        accessibilityLabel={t('learn.earnRewardsA11y', lang)}
        testID="learn-earn-rewards"
      >
        <RewardSummaryCard active={active} />
      </Pressable>

      <AdSlot surface="learn_landing" eligible={active} appActive={active} />

      {ALPHABET_SECTIONS.map((section) => (
        <View key={section.id} testID={`learn-section-${section.id}`}>
          <Text style={dynamic.sectionTitle} accessibilityRole="header">
            {section.titleNe} · {section.titleEn}
          </Text>
          <View style={styles.grid}>
            {section.glyphs.map((glyph) => (
              <View key={glyph.id} style={styles.cell}>
                <Pressable
                  style={dynamic.tile}
                  onPress={() => speak(glyph)}
                  accessibilityRole="button"
                  accessibilityLabel={`${glyph.dewanagari}, ${glyph.roman}`}
                  testID={`learn-glyph-${glyph.id}`}
                >
                  <Text style={dynamic.glyph}>{glyph.dewanagari}</Text>
                  <Text style={dynamic.roman} testID={`learn-roman-${glyph.id}`}>
                    {glyph.roman}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / COLUMNS}%`,
    padding: 4,
  },
});
