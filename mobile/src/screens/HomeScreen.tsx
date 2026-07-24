import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Share,
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
  formatNepaliScript,
  type Formality,
  type NepaliScript,
} from '../mt/onDeviceTranslate';
import { sharedTranslationEngine } from '../mt/TranslationEngine';
import { methodLabel } from '../conversation/passLogic';
import { addHistory, isStarred, toggleStar, type HistoryItem } from '../storage/phrasebook';
import { loadPrefs, savePrefs } from '../storage/prefs';
import { colors } from '../theme';

type Props = {
  seed?: HistoryItem | null;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Auto mode — bottom input dock, results above (fleet Team A).
 * Formal / script as compact chips. Honest footer: phrasebook offline.
 */
export function HomeScreen({ seed, onOpenHistory, onOpenSettings }: Props) {
  const [formalOn, setFormalOn] = useState(true);
  const [devaOn, setDevaOn] = useState(true);
  const [input, setInput] = useState(seed?.source ?? '');
  const [output, setOutput] = useState(seed?.translation ?? '');
  const [mtMethod, setMtMethod] = useState<'phrase' | 'lexicon'>('phrase');
  const [listening, setListening] = useState(false);
  const [starred, setStarred] = useState(false);
  const [romanTip, setRomanTip] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleHistoryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const prefsLoadedRef = useRef(false);
  const listeningRef = useRef(false);
  const startingRef = useRef(false);
  const sttLangRef = useRef<'en-US' | 'ne-NP'>('en-US');
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
    (t: string, translation: string, dir: 'en-ne' | 'ne-en') => {
      const sl = dir === 'en-ne' ? 'en' : 'ne';
      const tl = dir === 'en-ne' ? 'ne' : 'en';
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

  const previewTranslate = useCallback((raw: string) => {
    const t = raw.trim();
    if (!t) {
      setOutput('');
      setMtMethod('phrase');
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
        setMtMethod(result.method === 'lexicon' ? 'lexicon' : 'phrase');
      });
  }, []);

  const commitTranslate = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) {
        setOutput('');
        setMtMethod('phrase');
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
          setMtMethod(result.method === 'lexicon' ? 'lexicon' : 'phrase');
          saveHistoryFor(t, result.text, result.direction);
        });
    },
    [saveHistoryFor],
  );

  /** Restart STT when Detect flips mid-listen (Team H). */
  const syncSttLocale = useCallback(
    async (dir: 'en-ne' | 'ne-en') => {
      if (!listeningRef.current) return;
      const nextLang = dir === 'ne-en' ? 'ne-NP' : 'en-US';
      if (sttLangRef.current === nextLang) return;
      sttLangRef.current = nextLang;
      try {
        hardStopRecognition();
        await delay(160);
        if (!listeningRef.current) return;
        ExpoSpeechRecognitionModule.start({
          lang: nextLang,
          interimResults: true,
          continuous: false,
          requiresOnDeviceRecognition: false,
        });
      } catch {
        listeningRef.current = false;
        setListening(false);
      }
    },
    [hardStopRecognition],
  );

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim?.() ?? '';
    if (!text) return;
    setInput(text);
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
        void syncSttLocale(result.direction);
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
    void loadPrefs().then((prev) => {
      void savePrefs({
        ...prev,
        formalOn,
        devaOn,
      });
    });
  }, [formalOn, devaOn]);

  useEffect(() => {
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
      sttLangRef.current = lang;
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

  const onShare = async () => {
    const text = displayOutput.trim();
    if (!text) return;
    try {
      await Share.share({ message: text });
    } catch {
      /* ignore */
    }
  };

  const setDevaWithTip = (next: boolean) => {
    setDevaOn(next);
    if (!next) {
      void loadPrefs().then((prefs) => {
        if (!prefs.romanTipSeen) {
          setRomanTip(true);
          void savePrefs({ ...prefs, formalOn, devaOn: false, romanTipSeen: true });
        }
      });
    }
  };

  const displayOutput =
    targetLang === 'ne' ? formatNepaliScript(output, script) : output;
  const showResult = Boolean(input.trim() && displayOutput);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onOpenHistory}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Your activity"
        >
          <Text style={styles.headerLink}>Activity</Text>
        </Pressable>
        <View style={styles.brandBlock}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.brandMark}
          />
          <Text style={styles.brand}>NepTranslate</Text>
          <Text style={styles.modeTag}>
            {listening ? 'Listening…' : 'Phrases on device · voice via Apple'}
          </Text>
        </View>
        <Pressable
          onPress={onOpenSettings}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Text style={styles.headerLink}>Settings</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {showResult ? (
          <View style={styles.resultBlock}>
            <Text style={styles.resultLang}>
              {listening
                ? `${targetName} · live`
                : targetLang === 'ne'
                  ? `${targetName} · ${formality} · ${script === 'deva' ? 'देवनागरी' : 'Roman'} · ${methodLabel(mtMethod)}`
                  : `${targetName} · ${methodLabel(mtMethod)}`}
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
            <Text style={styles.sourceEcho} numberOfLines={3}>
              {sourceName}: {input.trim()}
            </Text>
            <View style={styles.resultActions}>
              <Pressable onPress={() => speak(displayOutput, targetLang)} hitSlop={8}>
                <Text style={styles.actionLabel}>Speak</Text>
              </Pressable>
              <Pressable
                onPress={() => void Clipboard.setStringAsync(displayOutput)}
                hitSlop={8}
              >
                <Text style={styles.actionLabel}>Copy</Text>
              </Pressable>
              <Pressable onPress={() => void onStar()} hitSlop={8}>
                <Text style={[styles.actionLabel, starred && styles.actionStarred]}>
                  {starred ? 'Starred' : 'Star'}
                </Text>
              </Pressable>
              <Pressable onPress={() => void onShare()} hitSlop={8}>
                <Text style={styles.actionLabel}>Share</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.emptyResult}>
            <Text style={styles.emptyTitle}>Type or speak</Text>
            <Text style={styles.emptyBody}>
              English ↔ Nepali on this device. Results appear here.
            </Text>
          </View>
        )}
      </ScrollView>

      {romanTip ? (
        <View style={styles.tipBanner}>
          <Text style={styles.tipText}>
            Roman shows everyday Latin spelling. Devanagari stays the written default.
          </Text>
          <Pressable onPress={() => setRomanTip(false)} hitSlop={8}>
            <Text style={styles.tipDismiss}>Got it</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.dock, listening && styles.dockListening]}>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setFormalOn(true)}
            style={[styles.chip, formalOn && styles.chipOn]}
          >
            <Text style={[styles.chipText, formalOn && styles.chipTextOn]}>Formal</Text>
          </Pressable>
          <Pressable
            onPress={() => setFormalOn(false)}
            style={[styles.chip, !formalOn && styles.chipOn]}
          >
            <Text style={[styles.chipText, !formalOn && styles.chipTextOn]}>
              Informal
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setDevaWithTip(true)}
            style={[styles.chip, devaOn && styles.chipOn]}
          >
            <Text style={[styles.chipText, devaOn && styles.chipTextOn]}>देवनागरी</Text>
          </Pressable>
          <Pressable
            onPress={() => setDevaWithTip(false)}
            style={[styles.chip, !devaOn && styles.chipOn]}
          >
            <Text style={[styles.chipText, !devaOn && styles.chipTextOn]}>Roman</Text>
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            onBlur={() => commitTranslate(input)}
            onSubmitEditing={() => commitTranslate(input)}
            placeholder="English or Nepali"
            placeholderTextColor={colors.textPlaceholder}
            multiline
            textAlignVertical="top"
            autoCorrect
          />
          <Pressable
            onPress={() => void toggleVoice()}
            style={[styles.micBtn, listening && styles.micBtnOn]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Speak to translate'}
          >
            <Text style={styles.micGlyph}>{listening ? 'Stop' : 'Mic'}</Text>
          </Pressable>
        </View>

        <View style={styles.dockMeta}>
          <Text style={styles.inputLang}>
            {listening ? 'Listening…' : input.trim() ? sourceName : 'Detect'}
          </Text>
          {!input ? (
            <Pressable onPress={() => void paste()} hitSlop={8}>
              <Text style={styles.metaAction}>Paste</Text>
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
              <Text style={styles.metaAction}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.trustLine}>
        phrasebook offline · voice via Apple
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
    minWidth: 64,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerLink: {
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    flexGrow: 1,
  },
  emptyResult: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  resultBlock: {
    paddingTop: 8,
    gap: 10,
  },
  resultLang: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.crimson,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  resultText: {
    fontSize: 28,
    lineHeight: 38,
    color: colors.text,
    fontWeight: '700',
  },
  resultNe: { fontSize: 30, lineHeight: 42 },
  sourceEcho: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  resultActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.forest,
  },
  actionStarred: { color: colors.star },
  tipBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 8,
  },
  tipText: { fontSize: 13, lineHeight: 18, color: colors.text },
  tipDismiss: { fontSize: 13, fontWeight: '800', color: colors.forest },
  dock: {
    marginHorizontal: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 10,
  },
  dockListening: {
    borderColor: colors.forest,
    backgroundColor: '#F4FBF7',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.pasteBg,
  },
  chipOn: {
    backgroundColor: colors.crimson,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  chipTextOn: { color: '#fff' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    color: colors.text,
    minHeight: 52,
    maxHeight: 120,
    padding: 0,
  },
  micBtn: {
    minWidth: 56,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: colors.pasteBg,
  },
  micBtnOn: {
    backgroundColor: colors.forestSoft,
  },
  micGlyph: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  dockMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLang: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  metaAction: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.blue,
  },
  trustLine: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textPlaceholder,
    paddingBottom: 6,
    paddingTop: 2,
  },
});
