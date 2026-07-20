import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  detectDirection,
  translateOnDevice,
  type Formality,
} from '../mt/onDeviceTranslate';
import { addHistory, isStarred, toggleStar, type HistoryItem } from '../storage/phrasebook';
import { colors } from '../theme';

type Props = {
  seed?: HistoryItem | null;
  onOpenHistory: () => void;
};

export function HomeScreen({ seed, onOpenHistory }: Props) {
  const [formality, setFormality] = useState<Formality>('formal');
  const [input, setInput] = useState(seed?.source ?? '');
  const [output, setOutput] = useState(seed?.translation ?? '');
  const [listening, setListening] = useState(false);
  const [starred, setStarred] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preferredRef = useRef<'en-ne' | 'ne-en'>(
    seed?.sourceLang === 'ne' ? 'ne-en' : 'en-ne',
  );

  const direction = detectDirection(input.trim() || 'x', preferredRef.current);
  const sourceLang = direction === 'en-ne' ? 'en' : 'ne';
  const targetLang = direction === 'en-ne' ? 'ne' : 'en';
  const sourceName = direction === 'en-ne' ? 'English' : 'Nepali';
  const targetName = direction === 'en-ne' ? 'Nepali' : 'English';
  const showFormality = direction === 'en-ne' || !input.trim();

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim?.() ?? '';
    if (!text) return;
    setInput(text);
    if (event.isFinal) {
      setListening(false);
      applyTranslate(text);
    }
  });
  useSpeechRecognitionEvent('error', () => setListening(false));
  useSpeechRecognitionEvent('end', () => setListening(false));

  useEffect(() => {
    void ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => {});
  }, []);

  const applyTranslate = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) {
        setOutput('');
        return;
      }
      const result = translateOnDevice(t, preferredRef.current, formality);
      preferredRef.current = result.direction;
      setOutput(result.text);
      const sl = result.direction === 'en-ne' ? 'en' : 'ne';
      const tl = result.direction === 'en-ne' ? 'ne' : 'en';
      void addHistory({
        source: t,
        translation: result.text,
        sourceLang: sl,
        targetLang: tl,
      });
      void isStarred(t, result.text, sl).then(setStarred);
    },
    [formality],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyTranslate(input), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, formality, applyTranslate]);

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip?.trim()) setInput(clip.trim());
  };

  const startVoice = async () => {
    Keyboard.dismiss();
    if (listening) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return;
      setListening(true);
      setOutput('');
      // Prefer English mic first; auto-detect after transcript. Nepali STT
      // improves when on-device Whisper is wired — for now try last direction.
      const lang = preferredRef.current === 'ne-en' ? 'ne-NP' : 'en-US';
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: true,
      });
    } catch {
      setListening(false);
    }
  };

  const speak = (text: string, lang: 'en' | 'ne') => {
    if (!text.trim()) return;
    Speech.stop();
    Speech.speak(text, { language: lang === 'en' ? 'en-US' : 'ne-NP', rate: 0.95 });
  };

  const onStar = async () => {
    if (!input.trim() || !output.trim()) return;
    setStarred(
      await toggleStar({
        source: input.trim(),
        translation: output.trim(),
        sourceLang,
        targetLang,
      }),
    );
  };

  const showResult = Boolean(input.trim() && output);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onOpenHistory} hitSlop={12} style={styles.headerBtn}>
          <Text style={styles.starIcon}>☆</Text>
        </Pressable>
        <View style={styles.brandBlock}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.brandMark}
          />
          <Text style={styles.brand}>NepTranslate</Text>
          <View style={styles.offlinePill}>
            <Text style={styles.offlinePillText}>Offline · v1.4.0</Text>
          </View>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, focused && styles.cardFocused]}>
          <View style={styles.cardTop}>
            <Text style={styles.inputLang}>
              {input.trim() ? sourceName : 'English or Nepali'}
            </Text>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Type or tap the mic…"
              placeholderTextColor={colors.textPlaceholder}
              multiline
              textAlignVertical="top"
              autoCorrect
            />
          </View>
          {!input ? (
            <Pressable style={styles.pasteBtn} onPress={paste}>
              <Text style={styles.pasteIcon}>⧉</Text>
              <Text style={styles.pasteText}>Paste</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setInput('')} hitSlop={8}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          )}
          {input.trim() ? (
            <Pressable onPress={() => speak(input, sourceLang)} style={styles.speakRow}>
              <Text style={styles.speakGlyph}>🔊</Text>
            </Pressable>
          ) : null}
        </View>

        {showResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultLang}>{targetName}</Text>
            <Text
              style={[styles.resultText, targetLang === 'ne' && styles.resultNe]}
              selectable
            >
              {output}
            </Text>
            <View style={styles.resultActions}>
              <Pressable onPress={() => speak(output, targetLang)} hitSlop={8}>
                <Text style={styles.actionIcon}>🔊</Text>
              </Pressable>
              <Pressable
                onPress={() => Clipboard.setStringAsync(output)}
                hitSlop={8}
              >
                <Text style={styles.actionIcon}>⧉</Text>
              </Pressable>
              <Pressable onPress={onStar} hitSlop={8}>
                <Text style={[styles.actionIcon, starred && { color: colors.star }]}>
                  {starred ? '★' : '☆'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {showFormality ? (
        <View style={styles.formalityRow}>
          <Text style={styles.formalityLabel}>Nepali tone</Text>
          <Pressable
            style={[styles.formChip, formality === 'formal' && styles.formChipOn]}
            onPress={() => setFormality('formal')}
          >
            <Text
              style={[
                styles.formChipText,
                formality === 'formal' && styles.formChipTextOn,
              ]}
            >
              Formal
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.formChip,
              formality === 'informal' && styles.formChipOn,
            ]}
            onPress={() => setFormality('informal')}
          >
            <Text
              style={[
                styles.formChipText,
                formality === 'informal' && styles.formChipTextOn,
              ]}
            >
              Informal
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.micRow}>
        <Pressable
          style={[styles.micBtn, listening && styles.micBtnHot]}
          onPress={startVoice}
        >
          <Text style={styles.micGlyph}>{listening ? '■' : '🎤'}</Text>
        </Pressable>
        <Text style={styles.micHint}>
          {listening ? 'Listening… tap to stop' : 'Speak English or Nepali'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: { fontSize: 26, color: colors.text },
  brandBlock: { flex: 1, alignItems: 'center', gap: 4 },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginBottom: 2,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.crimson,
  },
  offlinePill: {
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: colors.divider,
  },
  offlinePillText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 20,
    minHeight: 200,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardFocused: { minHeight: 260 },
  cardTop: { gap: 8 },
  inputLang: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  input: {
    fontSize: 28,
    lineHeight: 36,
    color: colors.text,
    minHeight: 100,
    padding: 0,
    fontWeight: '400',
  },
  pasteBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.pasteBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  pasteIcon: { fontSize: 14, color: colors.blue },
  pasteText: { fontSize: 14, color: colors.blue, fontWeight: '600' },
  clear: { fontSize: 18, color: colors.textSecondary, marginTop: 8 },
  speakRow: { marginTop: 16 },
  speakGlyph: { fontSize: 22, color: colors.textSecondary },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 20,
    marginTop: 12,
  },
  resultLang: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.crimson,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  resultText: { fontSize: 26, lineHeight: 36, color: colors.text },
  resultNe: { fontSize: 28, lineHeight: 40 },
  resultActions: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  actionIcon: { fontSize: 22, color: colors.textSecondary },
  formalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  formalityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 4,
  },
  formChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  formChipOn: {
    backgroundColor: colors.crimson,
    borderColor: colors.crimson,
  },
  formChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  formChipTextOn: { color: '#fff' },
  micRow: {
    alignItems: 'center',
    paddingBottom: 10,
    gap: 6,
  },
  micBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.crimson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnHot: { backgroundColor: colors.danger },
  micGlyph: { fontSize: 26, color: '#fff' },
  micHint: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
});
