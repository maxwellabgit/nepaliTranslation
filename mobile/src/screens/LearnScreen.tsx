import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Font from 'expo-font';
import * as Speech from 'expo-speech';

import { BackArrow } from '../components/BackArrow';
import { EmptyState } from '../components/EmptyState';
import { t, useUiLang } from '../i18n';
import { ALPHABET_SECTIONS, type AlphabetGlyph } from '../learn/alphabet';
import { AdSlot } from '../features/ads/AdSlot';
import { requestInterstitialOpportunity } from '../features/ads/InterstitialController';
import { hasNepaliVoice } from '../stt/sttSupport';
import { useTheme } from '../theme';

type Props = {
  active: boolean;
  onOpenTodaysReview?: () => void;
  onGoHome?: () => void;
};

const COLUMNS = 5;

const TODAYS_TITLE_FONT = {
  'PlusJakarta-ExtraBold': require('../../assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
};

/**
 * Learn: the full alphabet in order.
 * Letters are on the page for everyone — nothing sits behind a second screen.
 */
export function LearnScreen({ active, onGoHome, onOpenTodaysReview }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const [voiceOk, setVoiceOk] = useState(true);
  const [voiceChecked, setVoiceChecked] = useState(false);
  const [titleFont, setTitleFont] = useState(false);

  useEffect(() => {
    if (!active) return;
    void hasNepaliVoice().then((ok) => {
      setVoiceOk(ok);
      setVoiceChecked(true);
    });
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    void Font.loadAsync(TODAYS_TITLE_FONT).then(() => {
      if (!cancelled) setTitleFont(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
        backRow: {
          paddingHorizontal: 8,
          paddingTop: 4,
        },
        content: {
          padding: theme.spacing.lg,
          paddingBottom: 36,
          gap: 18,
        },
        sectionBanner: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 16,
        },
        sectionBannerVowels: {
          backgroundColor: theme.scheme === 'dark' ? '#4A1820' : '#FDE8EA',
        },
        sectionBannerConsonants: {
          backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
        },
        sectionBannerOther: {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.divider,
        },
        sectionNe: {
          fontSize: 28,
          fontWeight: '700',
          color: theme.colors.text,
          lineHeight: 34,
        },
        sectionEn: {
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: theme.colors.crimson,
        },
        sectionEnConsonants: {
          color: theme.scheme === 'dark' ? theme.colors.saffron : '#8A6A32',
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
        todaysCard: {
          borderRadius: 18,
          overflow: 'hidden',
          aspectRatio: 1024 / 384,
          justifyContent: 'center',
        },
        todaysImage: {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: '100%',
          height: '100%',
        },
        todaysCopy: {
          width: '54%',
          paddingLeft: 16,
          paddingRight: 8,
          gap: 4,
        },
        todaysTitle: {
          fontFamily: titleFont ? 'PlusJakarta-ExtraBold' : undefined,
          fontSize: 28,
          fontWeight: titleFont ? '400' : '800',
          color: '#1A1410',
        },
        todaysEarn: {
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '600',
          color: '#3D342C',
        },
      }),
    [theme, titleFont],
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
    <View style={dynamic.root} testID="learn-screen">
    <View style={dynamic.backRow}>
      <BackArrow
        onPress={onGoHome}
        accessibilityLabel={t('common.backHome', lang)}
        testID="back-home"
      />
    </View>
    <ScrollView
      style={dynamic.root}
      contentContainerStyle={dynamic.content}
      keyboardShouldPersistTaps="handled"
    >
      <AdSlot surface="learn_landing" eligible={active} appActive={active} />

      <Pressable
        testID="learn-todays-10"
        accessibilityRole="button"
        accessibilityLabel={t('learn.earnRewardsA11y', lang)}
        onPress={onOpenTodaysReview}
        style={dynamic.todaysCard}
      >
        <Image
          source={require('../../assets/review/todays10-card.png')}
          resizeMode="cover"
          style={dynamic.todaysImage}
        />
        <View style={dynamic.todaysCopy}>
          <Text style={dynamic.todaysTitle}>{t('learn.earnRewards', lang)}</Text>
          <Text style={dynamic.todaysEarn}>{t('learn.reviewEarn', lang)}</Text>
        </View>
      </Pressable>

      {ALPHABET_SECTIONS.map((section) => (
        <View key={section.id} testID={`learn-section-${section.id}`}>
          <View
            style={[
              dynamic.sectionBanner,
              section.id === 'vowels'
                ? dynamic.sectionBannerVowels
                : section.id === 'consonants'
                  ? dynamic.sectionBannerConsonants
                  : dynamic.sectionBannerOther,
            ]}
            accessibilityRole="header"
          >
            <Text style={dynamic.sectionNe}>{section.titleNe}</Text>
            <Text
              style={[
                dynamic.sectionEn,
                section.id === 'consonants' && dynamic.sectionEnConsonants,
              ]}
            >
              {section.titleEn}
            </Text>
          </View>
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
    </View>
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
