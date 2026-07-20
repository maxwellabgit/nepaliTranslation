import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { LightSwitch } from '../components/LightSwitch';
import {
  formatNepaliScript,
  translateOnDevice,
  type Formality,
  type NepaliScript,
} from '../mt/onDeviceTranslate';
import { colors } from '../theme';
import { loadPrefs, savePrefs } from '../storage/prefs';

type Side = 'en' | 'ne';

type Turn = {
  id: string;
  from: Side;
  original: string;
  /** Devanagari (or English) canonical translation before script formatting. */
  translatedDevaOrEn: string;
};

const MAX_RETRY = 5;

/**
 * Conversational mode: pass the phone between English and Nepali speakers.
 * Longer continuous listening; Pass finalizes + flips side. Last 5 bubbles retryable.
 */
export function ConversationScreen() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [side, setSide] = useState<Side>('en');
  const [listening, setListening] = useState(false);
  const [pendingTranslate, setPendingTranslate] = useState(false);
  const [interim, setInterim] = useState('');
  const [formalOn, setFormalOn] = useState(true);
  const [devaOn, setDevaOn] = useState(true);
  const pendingSide = useRef<Side>('en');
  const interimRef = useRef('');
  const scrollRef = useRef<ScrollView>(null);
  const passingRef = useRef(false);
  const prefsLoadedRef = useRef(false);

  const formality: Formality = formalOn ? 'formal' : 'informal';
  const script: NepaliScript = devaOn ? 'deva' : 'roman';

  const commitUtterance = useCallback(
    (text: string, from: Side) => {
      const t = text.trim();
      if (!t) return null;
      const direction = from === 'en' ? 'en-ne' : 'ne-en';
      // Always store Devanagari for NE output so script toggle can reformat.
      const result = translateOnDevice(t, direction, {
        formality,
        script: 'deva',
      });
      const turn: Turn = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        from,
        original: t,
        translatedDevaOrEn: result.text,
      };
      setTurns((prev) => [...prev, turn]);
      const speakText =
        from === 'en' ? formatNepaliScript(result.text, script) : result.text;
      Speech.stop();
      Speech.speak(speakText, {
        language: from === 'en' ? 'ne-NP' : 'en-US',
        rate: 0.95,
      });
      return turn;
    },
    [formality, script],
  );

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

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim?.() ?? '';
    if (!text) return;
    interimRef.current = text;
    setInterim(text);
    // In conversation we keep listening until Pass — only update interim.
    // Some platforms still send isFinal mid-stream; ignore commit until Pass.
  });

  useSpeechRecognitionEvent('error', () => {
    if (!passingRef.current) {
      setListening(false);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    // If continuous session ends unexpectedly while still "listening", restart
    // unless we are in Pass flow.
    if (passingRef.current) return;
    if (!listening) return;
    // Attempt soft restart for long batches
    void (async () => {
      try {
        ExpoSpeechRecognitionModule.start({
          lang: pendingSide.current === 'en' ? 'en-US' : 'ne-NP',
          interimResults: true,
          continuous: true,
          requiresOnDeviceRecognition: true,
        });
      } catch {
        setListening(false);
      }
    })();
  });

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns, interim, side]);

  const stopListening = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  const startListening = async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return;
      pendingSide.current = side;
      interimRef.current = '';
      setInterim('');
      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: side === 'en' ? 'en-US' : 'ne-NP',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: true,
      });
    } catch {
      setListening(false);
    }
  };

  const onPass = async () => {
    if (passingRef.current || pendingTranslate) return;
    passingRef.current = true;
    setPendingTranslate(true);
    const from = side;
    const spoken = (interimRef.current || interim).trim();

    stopListening();

    try {
      if (spoken) {
        // Allow a brief moment for final STT flush
        await new Promise((r) => setTimeout(r, 350));
        const finalText = (interimRef.current || spoken).trim();
        if (finalText) {
          commitUtterance(finalText, from);
        }
        setInterim('');
        interimRef.current = '';
      }
      setSide(from === 'en' ? 'ne' : 'en');
    } finally {
      setPendingTranslate(false);
      passingRef.current = false;
    }
  };

  const retryTurn = (turn: Turn) => {
    const direction = turn.from === 'en' ? 'en-ne' : 'ne-en';
    const result = translateOnDevice(turn.original, direction, {
      formality,
      script: 'deva',
    });
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turn.id ? { ...t, translatedDevaOrEn: result.text } : t,
      ),
    );
    const speakText =
      turn.from === 'en'
        ? formatNepaliScript(result.text, script)
        : result.text;
    Speech.stop();
    Speech.speak(speakText, {
      language: turn.from === 'en' ? 'ne-NP' : 'en-US',
      rate: 0.95,
    });
  };

  const displayForViewer = (turn: Turn): { big: string; small: string } => {
    // Viewer is current `side`. Show the translation INTO the viewer's language large.
    if (side === 'en') {
      // English viewer: Nepali→EN turns show English big; EN→NE show Nepali small + EN source?
      // Product: "enlarged translated text" for the listener.
      if (turn.from === 'ne') {
        return { big: turn.translatedDevaOrEn, small: turn.original };
      }
      // English spoke → Nepali translation for Nepali person; English viewer sees own line smaller
      return {
        big: formatNepaliScript(turn.translatedDevaOrEn, script),
        small: turn.original,
      };
    }
    // Nepali viewer
    if (turn.from === 'en') {
      return {
        big: formatNepaliScript(turn.translatedDevaOrEn, script),
        small: turn.original,
      };
    }
    return { big: turn.translatedDevaOrEn, small: turn.original };
  };

  const recent = turns.slice(-MAX_RETRY);
  const passLabel = side === 'en' ? 'Pass' : 'पास';
  const speakHint =
    side === 'en'
      ? 'Hold the phone · speak English'
      : 'फोन समात्नुहोस् · नेपाली बोल्नुहोस्';
  const sideTitle = side === 'en' ? 'English side' : 'नेपाली पक्ष';

  return (
    <View style={[styles.root, side === 'ne' && styles.rootNe]}>
      <View style={styles.topBar}>
        <Text style={styles.title}>{sideTitle}</Text>
        <Pressable
          onPress={() => setTurns([])}
          hitSlop={10}
          style={styles.clearBtn}
        >
          <Text style={styles.clearText}>
            {side === 'en' ? 'Clear' : 'मेटाउनुहोस्'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.switches}>
        <LightSwitch
          value={formalOn}
          onValueChange={setFormalOn}
          offLabel={side === 'ne' ? 'अनौपचारिक' : 'Informal'}
          onLabel={side === 'ne' ? 'औपचारिक' : 'Formal'}
          accessibilityLabel={
            side === 'ne' ? 'औपचारिक वा अनौपचारिक' : 'Formal or informal Nepali register'
          }
        />
        {side === 'ne' ? (
          <LightSwitch
            value={devaOn}
            onValueChange={setDevaOn}
            offLabel="Roman"
            onLabel="देवनागरी"
            accessibilityLabel="देवनागरी वा रोमन लिपि"
          />
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
      >
        {turns.length === 0 && !interim ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {side === 'en' ? 'Pass the phone' : 'फोन पास गर्नुहोस्'}
            </Text>
            <Text style={styles.emptyBody}>
              {side === 'en'
                ? 'Speak, then tap Pass when finished. The other person sees your message translated — then they speak and Pass back.'
                : 'बोल्नुहोस्, सकिएपछि पास थिच्नुहोस्। अर्को व्यक्तिलाई अनुवाद देखिन्छ — अनि उनीहरू बोल्छन् र फेरि पास गर्छन्।'}
            </Text>
          </View>
        ) : null}

        {recent.map((turn) => {
          const { big, small } = displayForViewer(turn);
          const mine = turn.from === side;
          return (
            <View
              key={turn.id}
              style={[styles.bubbleRow, mine ? styles.rowEnd : styles.rowStart]}
            >
              <View
                style={[
                  styles.bubble,
                  mine ? styles.bubbleMine : styles.bubbleTheirs,
                ]}
              >
                <Text style={styles.bubbleSmall}>{small}</Text>
                <Text
                  style={[
                    styles.bubbleBig,
                    side === 'ne' && devaOn && styles.bubbleBigNe,
                  ]}
                >
                  {big}
                </Text>
                <View style={styles.bubbleActions}>
                  <Pressable
                    onPress={() =>
                      Speech.speak(big, {
                        language:
                          side === 'en'
                            ? turn.from === 'ne'
                              ? 'en-US'
                              : 'ne-NP'
                            : turn.from === 'en'
                              ? 'ne-NP'
                              : 'en-US',
                      })
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.retry}>🔊</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => retryTurn(turn)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={side === 'en' ? 'Retry translation' : 'अनुवाद पुनः प्रयास'}
                  >
                    <Text style={styles.retry}>
                      {side === 'en' ? 'Retry' : 'पुनः'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}

        {interim ? (
          <View style={[styles.bubbleRow, styles.rowEnd]}>
            <View style={[styles.bubble, styles.bubbleInterim]}>
              <Text style={styles.bubbleSmall}>
                {side === 'en' ? 'Listening…' : 'सुन्दै…'}
              </Text>
              <Text style={styles.bubbleBig}>{interim}</Text>
            </View>
          </View>
        ) : null}

        {pendingTranslate ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.forest} />
            <Text style={styles.loadingText}>
              {side === 'en' ? 'Finishing translation…' : 'अनुवाद सकिँदै…'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.controls}>
        <Text style={styles.hint}>{speakHint}</Text>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.speakBtn, listening && styles.speakBtnHot]}
            onPress={() => (listening ? stopListening() : void startListening())}
            disabled={pendingTranslate}
            accessibilityRole="button"
            accessibilityLabel={
              listening
                ? side === 'en'
                  ? 'Stop listening'
                  : 'सुन्न रोक्नुहोस्'
                : side === 'en'
                  ? 'Speak'
                  : 'बोल्नुहोस्'
            }
          >
            <Text style={styles.speakGlyph}>{listening ? '■' : '🎤'}</Text>
            <Text style={styles.speakLabel}>
              {listening
                ? side === 'en'
                  ? 'Stop'
                  : 'रोक्नुहोस्'
                : side === 'en'
                  ? 'Speak'
                  : 'बोल्नुहोस्'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.passBtn, pendingTranslate && styles.passBtnBusy]}
            onPress={() => void onPass()}
            disabled={pendingTranslate}
            accessibilityRole="button"
            accessibilityLabel={
              pendingTranslate
                ? side === 'en'
                  ? 'Finishing translation'
                  : 'अनुवाद सकिँदै'
                : passLabel
            }
            accessibilityState={{ disabled: pendingTranslate, busy: pendingTranslate }}
          >
            <Text style={styles.passLabel}>{passLabel}</Text>
            <Text style={styles.passSub}>
              {side === 'en' ? 'Then hand to Nepali' : 'अङ्ग्रेजीतिर दिनुहोस्'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mintBg },
  rootNe: { backgroundColor: '#F3EDE6' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  clearBtn: { padding: 8 },
  clearText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  switches: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  feed: { flex: 1 },
  feedContent: { padding: 16, paddingBottom: 20, gap: 10 },
  emptyCard: {
    backgroundColor: colors.mintCard,
    borderRadius: 20,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  bubbleRow: { width: '100%' },
  rowEnd: { alignItems: 'flex-end' },
  rowStart: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '90%',
    borderRadius: 22,
    padding: 16,
    gap: 6,
  },
  bubbleMine: {
    backgroundColor: '#FFF7F0',
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
  },
  bubbleInterim: {
    backgroundColor: '#EEF2F0',
    opacity: 0.95,
  },
  bubbleSmall: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  bubbleBig: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.text,
  },
  bubbleBigNe: {
    fontSize: 28,
    lineHeight: 40,
  },
  bubbleActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  retry: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.forest,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  controls: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D5E3DB',
    backgroundColor: colors.mintBg,
  },
  hint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  actionRow: { flexDirection: 'row', gap: 12 },
  speakBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: colors.forest,
  },
  speakBtnHot: { backgroundColor: colors.danger },
  speakGlyph: { fontSize: 26, color: '#fff' },
  speakLabel: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  passBtn: {
    flex: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: colors.crimson,
  },
  passBtnBusy: { opacity: 0.7 },
  passLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  passSub: {
    marginTop: 4,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
});
