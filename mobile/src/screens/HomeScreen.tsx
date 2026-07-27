import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
  formatNepaliScript,
  type Direction,
  type Formality,
  type NepaliScript,
} from '../mt/onDeviceTranslate';
import { sharedTranslationEngine } from '../mt/TranslationEngine';
import { addHistory, isStarred, toggleStar, type HistoryItem } from '../storage/phrasebook';
import { loadPrefs, savePrefs } from '../storage/prefs';
import { colors } from '../theme';

type Props = {
  seed?: HistoryItem | null;
  neuralReady?: boolean;
  mtWarmStatus?: string | null;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
};

type SourceSide = 'en' | 'ne';
type StageFocus = 'input' | 'mic';

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const QUICK_PHRASES = [
  'Hello',
  'Thank you',
  'How are you?',
  "What's your name?",
  'Where is the bathroom?',
  'How much is this?',
] as const;

/**
 * Auto mode — composer under title, results below, phrases docked at bottom.
 */
export function HomeScreen({
  seed,
  neuralReady: _neuralReady = false,
  mtWarmStatus: _mtWarmStatus = null,
  onOpenHistory,
  onOpenSettings,
}: Props) {
  const [formalOn, setFormalOn] = useState(true);
  const [devaOn, setDevaOn] = useState(true);
  const [sourceSide, setSourceSide] = useState<SourceSide>(
    seed?.sourceLang === 'ne' ? 'ne' : 'en',
  );
  const [input, setInput] = useState(seed?.source ?? '');
  const [output, setOutput] = useState(seed?.translation ?? '');
  const [listening, setListening] = useState(false);
  const [starred, setStarred] = useState(false);
  const [romanTip, setRomanTip] = useState(false);
  const [stage, setStage] = useState<StageFocus>('input');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleHistoryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const prefsLoadedRef = useRef(false);
  const prefsRef = useRef({ formalOn: true, devaOn: true, romanTipSeen: false });
  const listeningRef = useRef(false);
  const startingRef = useRef(false);
  /** Bumped on every stop/start so stale `end`/`error` events cannot kill a new session. */
  const listenGenRef = useRef(0);
  /** Ignore recognition `end` until this time (abort→restart race). */
  const ignoreEndUntilRef = useRef(0);
  const inputRef = useRef<TextInput>(null);

  const formality: Formality = formalOn ? 'formal' : 'informal';
  const script: NepaliScript = devaOn ? 'deva' : 'roman';
  const preferred: Direction = sourceSide === 'en' ? 'en-ne' : 'ne-en';
  const sourceLang = sourceSide;
  const targetLang: 'en' | 'ne' = sourceSide === 'en' ? 'ne' : 'en';

  const optsRef = useRef<{
    formality: Formality;
    script: NepaliScript;
    preferred: Direction;
  }>({ formality, script, preferred });
  optsRef.current = { formality, script, preferred };

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

  const stopListening = useCallback(
    (opts?: { commit?: boolean }) => {
      listenGenRef.current += 1;
      startingRef.current = false;
      listeningRef.current = false;
      setListening(false);
      ignoreEndUntilRef.current = Date.now() + 350;
      hardStopRecognition();
      if (opts?.commit) {
        const t = input.trim();
        if (t) {
          const requestId = ++requestIdRef.current;
          void sharedTranslationEngine
            .translate({
              text: t,
              preferred: optsRef.current.preferred,
              formality: optsRef.current.formality,
              script: optsRef.current.script,
              forcePreferred: true,
            })
            .then((result) => {
              if (result.cancelled || requestId !== requestIdRef.current) return;
              setOutput(result.text);
              void addHistory({
                source: t,
                translation: result.text,
                sourceLang: optsRef.current.preferred === 'en-ne' ? 'en' : 'ne',
                targetLang: optsRef.current.preferred === 'en-ne' ? 'ne' : 'en',
              });
            });
        }
      }
    },
    [hardStopRecognition, input],
  );

  const saveHistoryFor = useCallback(
    (t: string, translation: string, dir: 'en-ne' | 'ne-en') => {
      if (!translation.trim()) return;
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

  const applyResult = useCallback(
    (
      result: {
        text: string;
        method: 'phrase' | 'lexicon' | 'neural';
        direction: 'en-ne' | 'ne-en';
        cancelled?: boolean;
      },
      requestId: number,
      opts?: { save?: boolean; source?: string },
    ) => {
      if (result.cancelled || requestId !== requestIdRef.current) return;
      setOutput(result.text);
      if (opts?.save && opts.source) {
        saveHistoryFor(opts.source, result.text, result.direction);
      }
    },
    [saveHistoryFor],
  );

  const previewTranslate = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) {
        setOutput('');
        return;
      }
      const requestId = ++requestIdRef.current;
      void sharedTranslationEngine
        .translate({
          text: t,
          preferred: optsRef.current.preferred,
          formality: optsRef.current.formality,
          script: optsRef.current.script,
          forcePreferred: true,
        })
        .then((result) => applyResult(result, requestId));
    },
    [applyResult],
  );

  const commitTranslate = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) {
        setOutput('');
        return;
      }
      const requestId = ++requestIdRef.current;
      void sharedTranslationEngine
        .translate({
          text: t,
          preferred: optsRef.current.preferred,
          formality: optsRef.current.formality,
          script: optsRef.current.script,
          forcePreferred: true,
        })
        .then((result) =>
          applyResult(result, requestId, { save: true, source: t }),
        );
    },
    [applyResult],
  );

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim?.() ?? '';
    if (!text) return;
    if (!listeningRef.current && !startingRef.current) return;
    setInput(text);
    const requestId = ++requestIdRef.current;
    void sharedTranslationEngine
      .translate({
        text,
        preferred: optsRef.current.preferred,
        formality: optsRef.current.formality,
        script: optsRef.current.script,
        forcePreferred: true,
      })
      .then((result) => {
        applyResult(result, requestId, {
          save: Boolean(event.isFinal),
          source: text,
        });
      });
    if (event.isFinal) {
      listenGenRef.current += 1;
      listeningRef.current = false;
      setListening(false);
    }
  });
  useSpeechRecognitionEvent('error', () => {
    if (Date.now() < ignoreEndUntilRef.current) return;
    if (startingRef.current) return;
    listeningRef.current = false;
    startingRef.current = false;
    setListening(false);
  });
  useSpeechRecognitionEvent('end', () => {
    if (Date.now() < ignoreEndUntilRef.current) return;
    if (startingRef.current) return;
    listeningRef.current = false;
    setListening(false);
  });

  useEffect(() => {
    void ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => {});
    return () => {
      listenGenRef.current += 1;
      hardStopRecognition();
      sharedTranslationEngine.cancelAll();
    };
  }, [hardStopRecognition]);

  useEffect(() => {
    void loadPrefs().then((prefs) => {
      setFormalOn(prefs.formalOn);
      setDevaOn(prefs.devaOn);
      prefsRef.current = {
        formalOn: prefs.formalOn,
        devaOn: prefs.devaOn,
        romanTipSeen: prefs.romanTipSeen,
      };
      prefsLoadedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    void loadPrefs().then((prev) => {
      const next = { ...prev, formalOn, devaOn };
      prefsRef.current = {
        formalOn: next.formalOn,
        devaOn: next.devaOn,
        romanTipSeen: next.romanTipSeen,
      };
      void savePrefs(next);
    });
  }, [formalOn, devaOn]);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (requestId !== requestIdRef.current) return;
      previewTranslate(input);
    }, 160);

    if (idleHistoryRef.current) clearTimeout(idleHistoryRef.current);
    idleHistoryRef.current = setTimeout(() => {
      if (requestId !== requestIdRef.current) return;
      const t = input.trim();
      if (!t) return;
      void sharedTranslationEngine
        .translate({
          text: t,
          preferred: optsRef.current.preferred,
          formality,
          script,
          forcePreferred: true,
        })
        .then((result) =>
          applyResult(result, requestId, { save: true, source: t }),
        );
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (idleHistoryRef.current) clearTimeout(idleHistoryRef.current);
    };
  }, [input, formality, script, preferred, previewTranslate, applyResult]);

  const onChangeInput = (text: string) => {
    if (listeningRef.current || startingRef.current) {
      stopListening();
    }
    setStage('input');
    setInput(text);
  };

  const onFocusInput = () => {
    if (listeningRef.current || startingRef.current) {
      stopListening();
    }
    setStage('input');
  };

  const setSourceSideSafe = (side: SourceSide) => {
    if (side === sourceSide) return;
    if (listeningRef.current || startingRef.current) {
      stopListening();
    }
    const prevIn = input;
    const prevOut = output;
    setSourceSide(side);
    // Swap so the switch behaves like a translator language flip.
    if (prevOut.trim()) {
      setInput(prevOut);
      setOutput(prevIn);
    }
  };

  const toggleVoice = async () => {
    Keyboard.dismiss();
    inputRef.current?.blur();
    setStage('mic');

    if (startingRef.current) return;

    if (listeningRef.current) {
      stopListening({ commit: true });
      return;
    }

    const gen = ++listenGenRef.current;
    startingRef.current = true;
    ignoreEndUntilRef.current = Date.now() + 500;
    try {
      hardStopRecognition();
      await delay(220);
      if (gen !== listenGenRef.current) return;

      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        startingRef.current = false;
        listeningRef.current = false;
        setListening(false);
        Alert.alert(
          'Microphone needed',
          'Allow microphone and speech recognition in Settings to speak translations.',
        );
        return;
      }
      if (gen !== listenGenRef.current) return;

      listeningRef.current = true;
      setListening(true);
      setOutput('');
      const lang = optsRef.current.preferred === 'ne-en' ? 'ne-NP' : 'en-US';
      ignoreEndUntilRef.current = Date.now() + 400;
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch {
      if (gen === listenGenRef.current) {
        listeningRef.current = false;
        setListening(false);
      }
    } finally {
      await delay(60);
      if (gen === listenGenRef.current) {
        startingRef.current = false;
      }
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
    if (!next && !prefsRef.current.romanTipSeen) {
      setRomanTip(true);
      prefsRef.current = {
        ...prefsRef.current,
        formalOn,
        devaOn: false,
        romanTipSeen: true,
      };
      void loadPrefs().then((prefs) => {
        void savePrefs({ ...prefs, formalOn, devaOn: false, romanTipSeen: true });
      });
    }
  };

  const clearAll = () => {
    if (listeningRef.current || startingRef.current) {
      stopListening();
    }
    setInput('');
    setOutput('');
  };

  const displayOutput =
    targetLang === 'ne' ? formatNepaliScript(output, script) : output;
  const showResult = Boolean(input.trim() && displayOutput);

  const inputUnder = stage === 'mic';
  const micUnder = stage === 'input';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
    >
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

      <View style={styles.titleRow}>
        <Text style={styles.title}>Type or speak</Text>
        <View
          style={styles.langSwitch}
          accessibilityRole="radiogroup"
          accessibilityLabel="Input language"
        >
          <Pressable
            onPress={() => setSourceSideSafe('en')}
            style={[styles.langOpt, sourceSide === 'en' && styles.langOptOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: sourceSide === 'en' }}
            accessibilityLabel="English"
          >
            <Text
              style={[styles.langOptText, sourceSide === 'en' && styles.langOptTextOn]}
            >
              English
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSourceSideSafe('ne')}
            style={[styles.langOpt, sourceSide === 'ne' && styles.langOptOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: sourceSide === 'ne' }}
            accessibilityLabel="Nepali"
          >
            <Text
              style={[styles.langOptText, sourceSide === 'ne' && styles.langOptTextOn]}
            >
              Nepali
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.composerWrap}>
        <View
          style={[
            styles.inputCard,
            inputUnder && styles.underStage,
            listening && styles.inputCardListening,
          ]}
          pointerEvents={inputUnder ? 'box-none' : 'auto'}
        >
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={onChangeInput}
            onFocus={onFocusInput}
            onBlur={() => commitTranslate(input)}
            onSubmitEditing={() => commitTranslate(input)}
            placeholder={sourceSide === 'en' ? 'Type English…' : 'Type Nepali…'}
            placeholderTextColor={colors.textPlaceholder}
            multiline
            textAlignVertical="top"
            autoCorrect
            editable={!listening}
            pointerEvents={inputUnder ? 'none' : 'auto'}
          />
          {input.trim() ? (
            <Pressable
              onPress={clearAll}
              hitSlop={10}
              style={styles.clearBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear text"
            >
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => void toggleVoice()}
          style={[
            styles.micBtn,
            micUnder && styles.micUnderStage,
            listening && styles.micBtnOn,
          ]}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop listening' : 'Speak to translate'}
        >
          <View style={[styles.micDot, listening && styles.micDotOn]} />
          <Text style={[styles.micGlyph, listening && styles.micGlyphOn]}>
            {listening ? 'Stop' : 'Speak'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        <Pressable
          onPress={() => {
            if (!formalOn) setFormalOn(true);
          }}
          style={[styles.chip, formalOn && styles.chipOn]}
        >
          <Text style={[styles.chipText, formalOn && styles.chipTextOn]}>Formal</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (formalOn) setFormalOn(false);
          }}
          style={[styles.chip, !formalOn && styles.chipOn]}
        >
          <Text style={[styles.chipText, !formalOn && styles.chipTextOn]}>
            Informal
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!devaOn) setDevaWithTip(true);
          }}
          style={[styles.chip, devaOn && styles.chipOn]}
        >
          <Text style={[styles.chipText, devaOn && styles.chipTextOn]}>देवनागरी</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (devaOn) setDevaWithTip(false);
          }}
          style={[styles.chip, !devaOn && styles.chipOn]}
        >
          <Text style={[styles.chipText, !devaOn && styles.chipTextOn]}>Roman</Text>
        </Pressable>
      </View>

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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {showResult ? (
          <View style={styles.resultBlock}>
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
        ) : null}
      </ScrollView>

      <View style={styles.phrasesDock}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {QUICK_PHRASES.map((phrase) => (
            <Pressable
              key={phrase}
              style={styles.suggestChip}
              onPress={() => {
                if (listeningRef.current || startingRef.current) {
                  stopListening();
                }
                setStage('input');
                setSourceSide('en');
                setInput(phrase);
                commitTranslate(phrase);
              }}
            >
              <Text style={styles.suggestText}>{phrase}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const MIC_SIZE = 64;
const MIC_OVERHANG = MIC_SIZE / 2;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 2,
  },
  headerBtn: {
    minWidth: 64,
    height: 44,
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
  brandMark: { width: 32, height: 32, borderRadius: 8 },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.crimson,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.text,
    paddingTop: 4,
  },
  langSwitch: {
    width: 108,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  langOpt: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langOptOn: {
    backgroundColor: colors.crimson,
  },
  langOptText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  langOptTextOn: {
    color: '#fff',
  },
  composerWrap: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: MIC_OVERHANG + 10,
    position: 'relative',
    zIndex: 2,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: MIC_OVERHANG + 14,
    minHeight: 112,
    shadowColor: '#1A1410',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    zIndex: 2,
  },
  inputCardListening: {
    borderColor: colors.forest,
  },
  underStage: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
    shadowOpacity: 0.02,
  },
  input: {
    fontSize: 20,
    lineHeight: 28,
    color: colors.text,
    minHeight: 56,
    maxHeight: 120,
    padding: 0,
    paddingRight: 52,
  },
  clearBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  micBtn: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: -MIC_OVERHANG,
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.divider,
    shadowColor: '#1A1410',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 20,
    gap: 2,
  },
  micUnderStage: {
    // Visual only — keep zIndex above the input card so the full mic stays tappable.
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
    shadowOpacity: 0.06,
  },
  micBtnOn: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
    opacity: 1,
    transform: [{ scale: 1 }],
    zIndex: 20,
    elevation: 12,
  },
  micDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.crimson,
  },
  micDotOn: {
    backgroundColor: '#fff',
  },
  micGlyph: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.2,
  },
  micGlyphOn: {
    color: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
    flexGrow: 1,
  },
  resultBlock: {
    gap: 12,
    paddingTop: 4,
  },
  resultText: {
    fontSize: 28,
    lineHeight: 38,
    color: colors.text,
    fontWeight: '700',
  },
  resultNe: { fontSize: 30, lineHeight: 42 },
  resultActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.forest,
  },
  actionStarred: { color: colors.star },
  phrasesDock: {
    maxHeight: 118,
    marginHorizontal: 16,
    marginBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingTop: 8,
    gap: 0,
  },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: 8,
  },
  suggestText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
