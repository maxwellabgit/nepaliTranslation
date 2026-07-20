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
import { LightSwitch } from '../components/LightSwitch';
import {
  detectDirection,
  formatNepaliScript,
  translateOnDevice,
  type Formality,
  type NepaliScript,
} from '../mt/onDeviceTranslate';
import { addHistory, isStarred, toggleStar, type HistoryItem } from '../storage/phrasebook';
import { loadPrefs, savePrefs } from '../storage/prefs';
import { colors } from '../theme';

type Props = {
  seed?: HistoryItem | null;
  onOpenHistory: () => void;
};

/**
 * Auto mode: type or speak with equal prominence. Auto-detect EN ↔ NE.
 * Formal switch ON = formal. Devanagari switch ON = Devanagari (else Roman).
 */
export function HomeScreen({ seed, onOpenHistory }: Props) {
  const [formalOn, setFormalOn] = useState(true);
  const [devaOn, setDevaOn] = useState(true);
  const [input, setInput] = useState(seed?.source ?? '');
  const [output, setOutput] = useState(seed?.translation ?? '');
  const [listening, setListening] = useState(false);
  const [starred, setStarred] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'speak'>('text');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleHistoryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const prefsLoadedRef = useRef(false);
  const preferredRef = useRef<'en-ne' | 'ne-en'>(
    seed?.sourceLang === 'ne' ? 'ne-en' : 'en-ne',
  );

  const formality: Formality = formalOn ? 'formal' : 'informal';
  const script: NepaliScript = devaOn ? 'deva' : 'roman';

  const direction = detectDirection(input.trim() || 'x', preferredRef.current);
  const sourceLang = direction === 'en-ne' ? 'en' : 'ne';
  const targetLang = direction === 'en-ne' ? 'ne' : 'en';
  const sourceName = direction === 'en-ne' ? 'English' : 'Nepali';
  const targetName = direction === 'en-ne' ? 'Nepali' : 'English';

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim?.() ?? '';
    if (!text) return;
    setInput(text);
    if (event.isFinal) {
      setListening(false);
      commitTranslate(text);
    }
  });
  useSpeechRecognitionEvent('error', () => setListening(false));
  useSpeechRecognitionEvent('end', () => setListening(false));

  useEffect(() => {
    void ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => {});
  }, []);

  useEffect(() => {
    void loadPrefs().then((prefs) => {
      setFormalOn(prefs.formalOn);
      setDevaOn(prefs.devaOn);
      prefsLoadedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    void savePrefs({ formalOn, devaOn });
  }, [formalOn, devaOn]);

  const previewTranslate = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) {
        setOutput('');
        return;
      }
      const result = translateOnDevice(t, preferredRef.current, {
        formality,
        script,
      });
      preferredRef.current = result.direction;
      setOutput(result.text);
    },
    [formality, script],
  );

  const saveHistoryFor = useCallback(
    (t: string, translation: string, direction: 'en-ne' | 'ne-en') => {
      const sl = direction === 'en-ne' ? 'en' : 'ne';
      const tl = direction === 'en-ne' ? 'ne' : 'en';
      void addHistory({
        source: t,
        translation,
        sourceLang: sl,
        targetLang: tl,
      });
      void isStarred(t, translation, sl).then(setStarred);
    },
    [],
  );

  const commitTranslate = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) {
        setOutput('');
        return;
      }
      const result = translateOnDevice(t, preferredRef.current, {
        formality,
        script,
      });
      preferredRef.current = result.direction;
      setOutput(result.text);
      saveHistoryFor(t, result.text, result.direction);
    },
    [formality, script, saveHistoryFor],
  );

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (requestId !== requestIdRef.current) return;
      previewTranslate(input);
    }, 200);

    if (idleHistoryRef.current) clearTimeout(idleHistoryRef.current);
    idleHistoryRef.current = setTimeout(() => {
      if (requestId !== requestIdRef.current) return;
      const t = input.trim();
      if (!t) return;
      const result = translateOnDevice(t, preferredRef.current, {
        formality,
        script,
      });
      saveHistoryFor(t, result.text, result.direction);
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (idleHistoryRef.current) clearTimeout(idleHistoryRef.current);
    };
  }, [input, formality, script, previewTranslate, saveHistoryFor]);

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip?.trim()) {
      setInputMode('text');
      setInput(clip.trim());
    }
  };

  const startVoice = async () => {
    Keyboard.dismiss();
    setInputMode('speak');
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

  const displayOutput =
    targetLang === 'ne' ? formatNepaliScript(output, script) : output;
  const showResult = Boolean(input.trim() && displayOutput);
  const historyLabel = direction === 'ne-en' ? 'इतिहास' : 'History';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onOpenHistory}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel={historyLabel}
        >
          <Text style={styles.historyLabel}>{historyLabel}</Text>
        </Pressable>
        <View style={styles.brandBlock}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.brandMark}
          />
          <Text style={styles.brand}>NepTranslate</Text>
          <Text style={styles.modeTag}>Auto · offline</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.switches}>
        <LightSwitch
          value={formalOn}
          onValueChange={setFormalOn}
          offLabel="Informal"
          onLabel="Formal"
          accessibilityLabel="Formal or informal Nepali register"
        />
        <LightSwitch
          value={devaOn}
          onValueChange={setDevaOn}
          offLabel="Roman"
          onLabel="देवनागरी"
          accessibilityLabel="Devanagari or Roman Nepali script"
        />
      </View>

      <View style={styles.modePick}>
        <Pressable
          style={[styles.modeCard, inputMode === 'text' && styles.modeCardOn]}
          onPress={() => setInputMode('text')}
        >
          <Text style={styles.modeGlyph}>Aa</Text>
          <Text style={[styles.modeTitle, inputMode === 'text' && styles.modeTitleOn]}>
            Type
          </Text>
          <Text style={styles.modeSub}>Auto-detect language</Text>
        </Pressable>
        <Pressable
          style={[
            styles.modeCard,
            styles.modeCardSpeak,
            (inputMode === 'speak' || listening) && styles.modeCardSpeakOn,
          ]}
          onPress={startVoice}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop listening' : 'Speak to translate'}
        >
          <Text style={styles.modeGlyphSpeak}>{listening ? '■' : '🎤'}</Text>
          <Text
            style={[
              styles.modeTitle,
              styles.modeTitleSpeak,
              (inputMode === 'speak' || listening) && styles.modeTitleSpeakOn,
            ]}
          >
            {listening ? 'Listening…' : 'Speak'}
          </Text>
          <Text style={[styles.modeSub, styles.modeSubSpeak]}>
            Same as typing — just say it
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.inputLang}>
            {input.trim() ? sourceName : 'English or Nepali'}
          </Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={(t) => {
              setInputMode('text');
              setInput(t);
            }}
            onFocus={() => setInputMode('text')}
            onBlur={() => commitTranslate(input)}
            onSubmitEditing={() => commitTranslate(input)}
            placeholder="Type here, or tap Speak above…"
            placeholderTextColor={colors.textPlaceholder}
            multiline
            textAlignVertical="top"
            autoCorrect
          />
          {!input ? (
            <Pressable style={styles.pasteBtn} onPress={paste}>
              <Text style={styles.pasteText}>Paste</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setInput('')} hitSlop={8}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          )}
        </View>

        {showResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultLang}>{targetName}</Text>
            <Text
              style={[
                styles.resultText,
                targetLang === 'ne' && script === 'deva' && styles.resultNe,
              ]}
              selectable
            >
              {displayOutput}
            </Text>
            <View style={styles.resultActions}>
              <Pressable onPress={() => speak(displayOutput, targetLang)} hitSlop={8}>
                <Text style={styles.actionIcon}>🔊</Text>
              </Pressable>
              <Pressable
                onPress={() => Clipboard.setStringAsync(displayOutput)}
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
    paddingBottom: 4,
  },
  headerBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  brandBlock: { flex: 1, alignItems: 'center', gap: 2 },
  brandMark: { width: 36, height: 36, borderRadius: 9 },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.crimson,
  },
  modeTag: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  switches: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    alignItems: 'center',
  },
  modePick: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modeCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.divider,
    minHeight: 112,
    justifyContent: 'center',
  },
  modeCardOn: {
    borderColor: colors.crimson,
    backgroundColor: '#FFF5F6',
  },
  modeCardSpeak: {
    borderColor: colors.forestSoft,
  },
  modeCardSpeakOn: {
    borderColor: colors.forest,
    backgroundColor: colors.forestSoft,
  },
  modeGlyph: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  modeGlyphSpeak: { fontSize: 28, marginBottom: 4 },
  modeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modeTitleOn: { color: colors.crimson },
  modeTitleSpeak: { color: colors.forest },
  modeTitleSpeakOn: { color: colors.forest },
  modeSub: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modeSubSpeak: { color: colors.forest },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    minHeight: 140,
  },
  inputLang: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    fontSize: 24,
    lineHeight: 32,
    color: colors.text,
    minHeight: 72,
    padding: 0,
  },
  pasteBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: colors.pasteBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  pasteText: { fontSize: 14, color: colors.blue, fontWeight: '600' },
  clear: { fontSize: 18, color: colors.textSecondary, marginTop: 8 },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    marginTop: 12,
  },
  resultLang: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.crimson,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  resultText: { fontSize: 24, lineHeight: 34, color: colors.text, fontWeight: '600' },
  resultNe: { fontSize: 26, lineHeight: 38 },
  resultActions: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  actionIcon: { fontSize: 22, color: colors.textSecondary },
});
