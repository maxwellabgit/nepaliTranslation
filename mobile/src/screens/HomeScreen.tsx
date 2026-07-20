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
  type Formality,
  type NepaliScript,
} from '../mt/onDeviceTranslate';
import { sharedTranslationEngine } from '../mt/TranslationEngine';
import { addHistory, isStarred, toggleStar, type HistoryItem } from '../storage/phrasebook';
import { loadPrefs, savePrefs } from '../storage/prefs';
import { colors } from '../theme';
import Constants from 'expo-constants';

type Props = {
  seed?: HistoryItem | null;
  onOpenHistory: () => void;
  onOpenGoldReview: () => void;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.nativeAppVersion ??
  '1.4.2';
const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  Constants.nativeBuildVersion ??
  '';


/**
 * Auto mode: one text box + mic. Type or speak; live translate as speech arrives.
 */
export function HomeScreen({ seed, onOpenHistory, onOpenGoldReview }: Props) {
  const [formalOn, setFormalOn] = useState(true);
  const [devaOn, setDevaOn] = useState(true);
  const [input, setInput] = useState(seed?.source ?? '');
  const [output, setOutput] = useState(seed?.translation ?? '');
  const [listening, setListening] = useState(false);
  const [starred, setStarred] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleHistoryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const prefsLoadedRef = useRef(false);
  const listeningRef = useRef(false);
  const startingRef = useRef(false);
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

  const optsRef = useRef({ formality, script });
  optsRef.current = { formality, script };

  const hardStopRecognition = useCallback(() => {
    try {
      const mod = ExpoSpeechRecognitionModule as {
        abort?: () => void;
        stop?: () => void;
      };
      if (typeof mod.abort === 'function') mod.abort();
      else if (typeof mod.stop === 'function') mod.stop();
    } catch {
      /* ignore */
    }
  }, []);

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

  const previewTranslate = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) {
        setOutput('');
        return;
      }
      void sharedTranslationEngine
        .translate({
          text: t,
          preferred: preferredRef.current,
          formality: optsRef.current.formality,
          script: optsRef.current.script,
        })
        .then((result) => {
          preferredRef.current = result.direction;
          setOutput(result.text);
        });
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
      void sharedTranslationEngine
        .translate({
          text: t,
          preferred: preferredRef.current,
          formality: optsRef.current.formality,
          script: optsRef.current.script,
        })
        .then((result) => {
          preferredRef.current = result.direction;
          setOutput(result.text);
          saveHistoryFor(t, result.text, result.direction);
        });
    },
    [saveHistoryFor],
  );

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim?.() ?? '';
    if (!text) return;
    setInput(text);
    // Live-fill translation while the user is speaking (sentence-aware).
    void sharedTranslationEngine
      .translate({
        text,
        preferred: preferredRef.current,
        formality: optsRef.current.formality,
        script: optsRef.current.script,
      })
      .then((result) => {
        preferredRef.current = result.direction;
        setOutput(result.text);
        if (event.isFinal) {
          listeningRef.current = false;
          setListening(false);
          saveHistoryFor(text, result.text, result.direction);
        }
      });
    if (event.isFinal) {
      listeningRef.current = false;
      setListening(false);
    }
  });
  useSpeechRecognitionEvent('error', () => {
    listeningRef.current = false;
    startingRef.current = false;
    setListening(false);
  });
  useSpeechRecognitionEvent('end', () => {
    if (startingRef.current) return;
    listeningRef.current = false;
    setListening(false);
  });

  useEffect(() => {
    void ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => {});
    return () => {
      hardStopRecognition();
    };
  }, [hardStopRecognition]);

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

  useEffect(() => {
    // While listening, speech handler already live-updates output.
    if (listeningRef.current) return;

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
      void sharedTranslationEngine
        .translate({
          text: t,
          preferred: preferredRef.current,
          formality,
          script,
        })
        .then((result) => {
          if (requestId !== requestIdRef.current) return;
          saveHistoryFor(t, result.text, result.direction);
        });
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (idleHistoryRef.current) clearTimeout(idleHistoryRef.current);
    };
  }, [input, formality, script, previewTranslate, saveHistoryFor]);

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (clip?.trim()) setInput(clip.trim());
  };

  const toggleVoice = async () => {
    Keyboard.dismiss();
    if (startingRef.current) return;

    if (listeningRef.current) {
      hardStopRecognition();
      listeningRef.current = false;
      setListening(false);
      const t = input.trim();
      if (t) commitTranslate(t);
      return;
    }

    startingRef.current = true;
    try {
      // Always fully reset before a new session — second tap often fails otherwise.
      hardStopRecognition();
      await delay(180);

      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        startingRef.current = false;
        return;
      }

      listeningRef.current = true;
      setListening(true);
      setOutput('');
      const lang = preferredRef.current === 'ne-en' ? 'ne-NP' : 'en-US';
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch {
      listeningRef.current = false;
      setListening(false);
    } finally {
      // Allow end/error handlers after start settles.
      await delay(50);
      startingRef.current = false;
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
          <Text style={styles.modeTag}>
            {listening ? 'Auto · listening' : 'Auto · offline'}
          </Text>
        </View>
        <Pressable
          onPress={onOpenGoldReview}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Gold review"
        >
          <Text style={styles.reviewGlyph}>▣</Text>
        </Pressable>
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, listening && styles.cardListening]}>
          <View style={styles.cardHeader}>
            <Text style={styles.inputLang}>
              {listening
                ? 'Listening…'
                : input.trim()
                  ? sourceName
                  : 'English or Nepali'}
            </Text>
            <Pressable
              onPress={() => void toggleVoice()}
              style={[styles.micBtn, listening && styles.micBtnOn]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Stop listening' : 'Speak to translate'}
            >
              <Text style={styles.micGlyph}>{listening ? '■' : '🎤'}</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            onBlur={() => commitTranslate(input)}
            onSubmitEditing={() => commitTranslate(input)}
            placeholder="Type or tap the mic to speak…"
            placeholderTextColor={colors.textPlaceholder}
            multiline
            textAlignVertical="top"
            autoCorrect
            editable={!listening}
          />
          {!input ? (
            <Pressable style={styles.pasteBtn} onPress={paste}>
              <Text style={styles.pasteText}>Paste</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                if (listeningRef.current) {
                  hardStopRecognition();
                  listeningRef.current = false;
                  setListening(false);
                }
                setInput('');
                setOutput('');
              }}
              hitSlop={8}
            >
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          )}
        </View>

        {showResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultLang}>
              {listening ? `${targetName} · live` : targetName}
            </Text>
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
      <Text style={styles.versionLine}>
        v{APP_VERSION}
        {BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ''} · offline
      </Text>
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
  reviewGlyph: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    minHeight: 160,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardListening: {
    borderColor: colors.forest,
    backgroundColor: '#F4FBF7',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputLang: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    flex: 1,
    paddingRight: 8,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pasteBg,
  },
  micBtnOn: {
    backgroundColor: colors.forestSoft,
  },
  micGlyph: { fontSize: 20 },
  input: {
    fontSize: 24,
    lineHeight: 32,
    color: colors.text,
    minHeight: 88,
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
  versionLine: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textPlaceholder,
    paddingBottom: 6,
    paddingTop: 2,
  },
});
