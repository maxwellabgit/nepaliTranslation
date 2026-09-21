import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';

import {
  AppButton,
  AppCard,
  AppHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/AppPrimitives';
import { hasNepaliVoice } from '../stt/sttSupport';
import { colors } from '../theme';
import {
  ALPHABET_SECTIONS,
  advanceLesson,
  buildRomanQuiz,
  gradeQuizChoice,
  placeLabel,
  sectionById,
  type AlphabetSectionId,
  type LessonPosition,
} from './alphabet';
import { loadLessonPosition, saveLessonPosition } from './learnProgress';

/** Deterministic RNG factory (mutates only its own closed state). */
function mulberrySeed(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const RATE_NORMAL = 0.85;
const RATE_SLOW = 0.45;

type Props = {
  onBack: () => void;
};

export function AlphabetLesson({ onBack }: Props) {
  const [position, setPosition] = useState<LessonPosition>({
    sectionId: 'vowels',
    glyphIndex: 0,
  });
  const [ready, setReady] = useState(false);
  const [neVoice, setNeVoice] = useState<boolean | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizSeed, setQuizSeed] = useState(0);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    void (async () => {
      const pos = await loadLessonPosition();
      setPosition(pos);
      setReady(true);
      const has = await hasNepaliVoice();
      setNeVoice(has);
    })();
  }, []);

  const section = sectionById(position.sectionId);
  const glyph = section.glyphs[position.glyphIndex] ?? section.glyphs[0];
  const place = placeLabel(glyph.place);

  const quiz = useMemo(() => {
    const seed = quizSeed + position.glyphIndex * 17 + 1;
    return buildRomanQuiz(glyph, section.glyphs, mulberrySeed(seed));
  }, [glyph, position.glyphIndex, quizSeed, section.glyphs]);

  const persist = useCallback(async (next: LessonPosition) => {
    setPosition(next);
    await saveLessonPosition(next);
  }, []);

  const speak = useCallback(
    async (rate: number) => {
      if (neVoice === false) return;
      setSpeechError(null);
      try {
        Speech.stop();
        Speech.speak(glyph.dewanagari, {
          language: 'ne-NP',
          rate,
          onError: () => {
            setSpeechError('Could not play pronunciation on this device.');
          },
        });
      } catch {
        setSpeechError('Could not play pronunciation on this device.');
      }
    },
    [glyph.dewanagari, neVoice],
  );

  const goSection = useCallback(
    async (id: AlphabetSectionId) => {
      setQuizFeedback(null);
      setCompleted(false);
      setQuizSeed((s) => s + 1);
      await persist({ sectionId: id, glyphIndex: 0 });
    },
    [persist],
  );

  const next = useCallback(async () => {
    setQuizFeedback(null);
    setQuizSeed((s) => s + 1);
    const advanced = advanceLesson(position);
    if (advanced.kind === 'complete') {
      setCompleted(true);
      return;
    }
    setCompleted(false);
    await persist(advanced.position);
  }, [persist, position]);

  const restart = useCallback(async () => {
    setCompleted(false);
    setQuizFeedback(null);
    setQuizSeed((s) => s + 1);
    await persist({ sectionId: 'vowels', glyphIndex: 0 });
  }, [persist]);

  const handleBack = useCallback(() => {
    try {
      Speech.stop();
    } catch {
      /* ignore */
    }
    onBack();
  }, [onBack]);

  return (
    <View style={styles.root} testID="alphabet-lesson">
      <AppHeader title="Nepali alphabet" onBack={handleBack} testID="alphabet-header" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="alphabet-scroll"
      >
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
          Offline · no account needed
        </Text>

        {neVoice === false ? (
          <View style={styles.banner} testID="learn-no-voice">
            <Text style={styles.bannerText} maxFontSizeMultiplier={1.5}>
              No Nepali voice is installed on this device. You can still study the
              letters; install a Nepali Siri voice in iOS Settings to hear them.
            </Text>
          </View>
        ) : null}

        {speechError ? (
          <ErrorState
            title="Speech error"
            detail={speechError}
            testID="learn-speech-error"
          />
        ) : null}

        <Text style={styles.overviewLabel} accessibilityRole="header">
          Sections
        </Text>
        <View style={styles.sectionRow} testID="alphabet-section-overview">
          {ALPHABET_SECTIONS.map((s) => (
            <AppButton
              key={s.id}
              label={s.titleEn}
              variant={position.sectionId === s.id ? 'primary' : 'secondary'}
              onPress={() => void goSection(s.id)}
              accessibilityLabel={`${s.titleEn} section`}
              testID={`learn-section-${s.id}`}
              style={styles.sectionChip}
              labelStyle={styles.sectionChipLabel}
            />
          ))}
        </View>

        {!ready ? (
          <LoadingState title="Loading lesson…" testID="learn-loading" />
        ) : completed ? (
          <EmptyState
            title="Alphabet complete"
            detail="You finished every section. Restart anytime — progress stays on this device."
            testID="learn-complete"
          />
        ) : (
          <>
            <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.5}>
              {section.titleNe} · {section.titleEn}
            </Text>
            <Text style={styles.progress} testID="learn-progress" maxFontSizeMultiplier={1.4}>
              {position.glyphIndex + 1} / {section.glyphs.length}
            </Text>

            <AppCard style={styles.glyphCard} testID="learn-glyph-card">
              <Text
                style={styles.glyph}
                accessibilityLabel={`Letter ${glyph.dewanagari}, roman ${glyph.roman}${place ? `, ${place}` : ''}`}
                maxFontSizeMultiplier={1.6}
              >
                {glyph.dewanagari}
              </Text>
              <Text style={styles.roman} testID="learn-roman" maxFontSizeMultiplier={1.5}>
                {glyph.roman}
              </Text>
              {place ? (
                <Text
                  style={styles.place}
                  testID="learn-place"
                  maxFontSizeMultiplier={1.4}
                >
                  {place}
                </Text>
              ) : null}
              <View style={styles.speakRow}>
                <AppButton
                  label={neVoice === false ? 'Speak unavailable' : 'Speak'}
                  variant="secondary"
                  onPress={() => void speak(RATE_NORMAL)}
                  disabled={neVoice === false}
                  accessibilityLabel="Speak letter at normal speed"
                  testID="learn-speak"
                  style={styles.speakBtn}
                />
                <AppButton
                  label="Slow"
                  variant="secondary"
                  onPress={() => void speak(RATE_SLOW)}
                  disabled={neVoice === false}
                  accessibilityLabel="Speak letter slowly"
                  testID="learn-speak-slow"
                  style={styles.speakBtn}
                />
              </View>
            </AppCard>

            <Text style={styles.quizLabel} maxFontSizeMultiplier={1.4}>
              Which roman matches?
            </Text>
            <View style={styles.choices} testID="learn-quiz-choices">
              {quiz.choices.map((choice) => (
                <AppButton
                  key={choice}
                  label={choice}
                  variant="secondary"
                  onPress={() => {
                    const ok = gradeQuizChoice(choice, quiz.answer);
                    setQuizFeedback(ok ? 'Correct' : 'Try again');
                  }}
                  accessibilityLabel={`Choice ${choice}`}
                  testID={`learn-choice-${choice}`}
                  style={styles.choice}
                />
              ))}
            </View>
            {quizFeedback ? (
              <Text
                style={[
                  styles.feedback,
                  quizFeedback === 'Correct' ? styles.ok : styles.bad,
                ]}
                testID="learn-quiz-feedback"
                accessibilityLiveRegion="polite"
              >
                {quizFeedback}
              </Text>
            ) : null}

            <AppButton
              label="Next letter"
              onPress={() => void next()}
              accessibilityLabel="Next letter"
              testID="learn-next"
              style={styles.nextBtn}
            />
          </>
        )}

        {completed ? (
          <AppButton
            label="Restart alphabet"
            onPress={() => void restart()}
            accessibilityLabel="Restart alphabet"
            testID="learn-restart"
            style={styles.nextBtn}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  banner: {
    backgroundColor: colors.pasteBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sectionChip: { paddingHorizontal: 12, paddingVertical: 8, minWidth: 0 },
  sectionChipLabel: { fontSize: 13 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  progress: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  glyphCard: { alignItems: 'center', paddingVertical: 24, marginBottom: 20 },
  glyph: { fontSize: 72, color: colors.text },
  roman: { marginTop: 8, fontSize: 22, fontWeight: '600', color: colors.forest },
  place: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  speakRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  speakBtn: { minWidth: 120 },
  quizLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: '45%', flexGrow: 1 },
  feedback: { marginTop: 10, fontSize: 14, fontWeight: '700' },
  ok: { color: colors.forest },
  bad: { color: colors.danger },
  nextBtn: { marginTop: 24 },
});
