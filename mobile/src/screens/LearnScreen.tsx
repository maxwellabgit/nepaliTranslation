import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';

import { colors } from '../theme';
import { hasNepaliVoice } from '../stt/sttSupport';
import {
  ALPHABET_SECTIONS,
  advanceLesson,
  buildRomanQuiz,
  gradeQuizChoice,
  sectionById,
  type AlphabetSectionId,
  type LessonPosition,
} from '../learn/alphabet';
import { loadLessonPosition, saveLessonPosition } from '../learn/learnProgress';

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

type Props = {
  active: boolean;
};

export function LearnScreen({ active }: Props) {
  const [position, setPosition] = useState<LessonPosition>({
    sectionId: 'vowels',
    glyphIndex: 0,
  });
  const [ready, setReady] = useState(false);
  const [neVoice, setNeVoice] = useState<boolean | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizSeed, setQuizSeed] = useState(0);

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

  const quiz = useMemo(() => {
    const seed = quizSeed + position.glyphIndex * 17 + 1;
    return buildRomanQuiz(glyph, section.glyphs, mulberrySeed(seed));
  }, [glyph, position.glyphIndex, quizSeed, section.glyphs]);

  const persist = useCallback(async (next: LessonPosition) => {
    setPosition(next);
    await saveLessonPosition(next);
  }, []);

  const speak = useCallback(async () => {
    if (neVoice === false) return;
    try {
      Speech.stop();
      Speech.speak(glyph.dewanagari, { language: 'ne-NP', rate: 0.85 });
    } catch {
      /* ignore */
    }
  }, [glyph.dewanagari, neVoice]);

  const goSection = useCallback(
    async (id: AlphabetSectionId) => {
      setQuizFeedback(null);
      setQuizSeed((s) => s + 1);
      await persist({ sectionId: id, glyphIndex: 0 });
    },
    [persist],
  );

  const next = useCallback(async () => {
    setQuizFeedback(null);
    setQuizSeed((s) => s + 1);
    const advanced = advanceLesson(position);
    await persist(advanced.position);
  }, [persist, position]);

  if (!active) {
    return <View testID="learn-screen-inactive" />;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="learn-screen"
    >
      <Text style={styles.title}>Learn</Text>
      <Text style={styles.subtitle}>
        Nepali alphabet · offline · no account needed
      </Text>

      {neVoice === false ? (
        <View style={styles.banner} testID="learn-no-voice">
          <Text style={styles.bannerText}>
            No Nepali voice is installed on this device. You can still study the
            letters; install a Nepali Siri voice in iOS Settings to hear them.
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        {ALPHABET_SECTIONS.map((s) => (
          <Pressable
            key={s.id}
            style={[
              styles.sectionChip,
              position.sectionId === s.id && styles.sectionChipOn,
            ]}
            onPress={() => void goSection(s.id)}
            accessibilityRole="button"
            accessibilityLabel={`${s.titleEn} section`}
            testID={`learn-section-${s.id}`}
          >
            <Text
              style={[
                styles.sectionChipLabel,
                position.sectionId === s.id && styles.sectionChipLabelOn,
              ]}
            >
              {s.titleEn}
            </Text>
          </Pressable>
        ))}
      </View>

      {!ready ? (
        <Text style={styles.muted}>Loading lesson…</Text>
      ) : (
        <>
          <Text style={styles.sectionTitle}>
            {section.titleNe} · {section.titleEn}
          </Text>
          <Text style={styles.progress} testID="learn-progress">
            {position.glyphIndex + 1} / {section.glyphs.length}
          </Text>

          <View style={styles.card} testID="learn-glyph-card">
            <Text style={styles.glyph}>{glyph.dewanagari}</Text>
            <Text style={styles.roman}>{glyph.roman}</Text>
            <Pressable
              style={[styles.speakBtn, neVoice === false && styles.speakBtnOff]}
              onPress={() => void speak()}
              disabled={neVoice === false}
              accessibilityRole="button"
              accessibilityLabel="Speak letter"
              testID="learn-speak"
            >
              <Text style={styles.speakLabel}>
                {neVoice === false ? 'Speak unavailable' : 'Speak'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.quizLabel}>Which roman matches?</Text>
          <View style={styles.choices}>
            {quiz.choices.map((choice) => (
              <Pressable
                key={choice}
                style={styles.choice}
                onPress={() => {
                  const ok = gradeQuizChoice(choice, quiz.answer);
                  setQuizFeedback(ok ? 'Correct' : 'Try again');
                }}
                accessibilityRole="button"
                accessibilityLabel={`Choice ${choice}`}
                testID={`learn-choice-${choice}`}
              >
                <Text style={styles.choiceLabel}>{choice}</Text>
              </Pressable>
            ))}
          </View>
          {quizFeedback ? (
            <Text
              style={[
                styles.feedback,
                quizFeedback === 'Correct' ? styles.ok : styles.bad,
              ]}
              testID="learn-quiz-feedback"
            >
              {quizFeedback}
            </Text>
          ) : null}

          <Pressable
            style={styles.nextBtn}
            onPress={() => void next()}
            accessibilityRole="button"
            accessibilityLabel="Next letter"
            testID="learn-next"
          >
            <Text style={styles.nextLabel}>Next</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: {
    marginTop: 4,
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
  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  sectionChipOn: { backgroundColor: colors.crimson, borderColor: colors.crimson },
  sectionChipLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  sectionChipLabelOn: { color: '#fff' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  progress: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: 20,
  },
  glyph: { fontSize: 72, color: colors.text },
  roman: { marginTop: 8, fontSize: 22, fontWeight: '600', color: colors.forest },
  speakBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.forestSoft,
  },
  speakBtnOff: { backgroundColor: colors.divider },
  speakLabel: { fontWeight: '700', color: colors.forest },
  quizLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minWidth: '45%',
    flexGrow: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
  },
  choiceLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  feedback: { marginTop: 10, fontSize: 14, fontWeight: '700' },
  ok: { color: colors.forest },
  bad: { color: colors.danger },
  nextBtn: {
    marginTop: 24,
    backgroundColor: colors.crimson,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextLabel: { color: '#fff', fontWeight: '800', fontSize: 16 },
  muted: { color: colors.textSecondary },
});
