import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';

import { colors } from '../theme';
import { ALPHABET_SECTIONS, type AlphabetGlyph } from '../learn/alphabet';
import { RewardSummaryCard } from '../learn/RewardSummaryCard';
import { hasNepaliVoice } from '../stt/sttSupport';

type Props = {
  active: boolean;
  onOpenContributions?: () => void;
};

const COLUMNS = 5;

/**
 * Learn tab: earn-rewards summary, then the full alphabet in order.
 * Letters are on the page for everyone — nothing sits behind a second screen.
 */
export function LearnScreen({ active, onOpenContributions }: Props) {
  const [voiceOk, setVoiceOk] = useState(true);

  useEffect(() => {
    if (!active) return;
    void hasNepaliVoice().then(setVoiceOk);
  }, [active]);

  if (!active) {
    return <View testID="learn-screen-inactive" />;
  }

  const speak = (glyph: AlphabetGlyph) => {
    if (!voiceOk) return;
    Speech.stop();
    Speech.speak(glyph.dewanagari, { language: 'ne-NP', rate: 0.85 });
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="learn-screen"
    >
      <Pressable
        onPress={onOpenContributions}
        disabled={!onOpenContributions}
        accessibilityRole="button"
        accessibilityLabel="Earn rewards"
        testID="learn-earn-rewards"
      >
        <RewardSummaryCard active={active} />
      </Pressable>

      {ALPHABET_SECTIONS.map((section) => (
        <View key={section.id} testID={`learn-section-${section.id}`}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.titleNe} · {section.titleEn}
          </Text>
          <View style={styles.grid}>
            {section.glyphs.map((glyph) => (
              <View key={glyph.id} style={styles.cell}>
              <Pressable
                style={styles.tile}
                onPress={() => speak(glyph)}
                accessibilityRole="button"
                accessibilityLabel={`${glyph.dewanagari}, ${glyph.roman}`}
                testID={`learn-glyph-${glyph.id}`}
              >
                <Text style={styles.glyph}>{glyph.dewanagari}</Text>
                <Text style={styles.roman} testID={`learn-roman-${glyph.id}`}>
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
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 36, gap: 18 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / COLUMNS}%`,
    padding: 4,
  },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 72,
  },
  glyph: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 34,
  },
  roman: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
