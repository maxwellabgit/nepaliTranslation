import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
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
import { takeNewCompleteSentences } from '../mt/sentences';
import { colors } from '../theme';
import { loadPrefs, savePrefs } from '../storage/prefs';

type Side = 'en' | 'ne';

type Turn = {
  id: string;
  from: Side;
  /** What the speaker said (source language). */
  heard: string;
  /** What the other person should read (always the translation). */
  show: string;
};

/**
 * Conversation = pass-the-phone dialogue.
 * - Language is forced by whose turn it is (never auto-detect flip).
 * - Latest line is a hero card: big text = show the other person.
 * - Pass flushes, flips side, speaks the line, and auto-listens for them.
 */
export function ConversationScreen({
  onOpenGoldReview,
}: {
  onOpenGoldReview?: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [side, setSide] = useState<Side>('en');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [interim, setInterim] = useState('');
  const [formalOn, setFormalOn] = useState(true);
  const [devaOn, setDevaOn] = useState(true);
  const [faceToFace, setFaceToFace] = useState(false);

  const sideRef = useRef<Side>('en');
  const interimRef = useRef('');
  const emittedCountRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const passingRef = useRef(false);
  const prefsLoadedRef = useRef(false);
  const listeningRef = useRef(false);
  const formalityRef = useRef<Formality>('formal');
  const scriptRef = useRef<NepaliScript>('deva');
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formality: Formality = formalOn ? 'formal' : 'informal';
  const script: NepaliScript = devaOn ? 'deva' : 'roman';
  formalityRef.current = formality;
  scriptRef.current = script;
  sideRef.current = side;

  const translateForced = useCallback((text: string, from: Side) => {
    const preferred = from === 'en' ? 'en-ne' : 'ne-en';
    return translateOnDevice(text, preferred, {
      formality: formalityRef.current,
      // Store Devanagari canonically; format at display time.
      script: 'deva',
      forcePreferred: true,
    });
  }, []);

  const speakShow = useCallback((turn: Turn) => {
    const text =
      turn.from === 'en'
        ? formatNepaliScript(turn.show, scriptRef.current)
        : turn.show;
    Speech.stop();
    Speech.speak(text, {
      language: turn.from === 'en' ? 'ne-NP' : 'en-US',
      rate: 0.95,
    });
  }, []);

  const commitSentence = useCallback(
    (text: string, from: Side, speakAloud: boolean) => {
      const t = text.trim();
      if (!t) return null;
      const result = translateForced(t, from);
      const turn: Turn = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        from,
        heard: t,
        show: result.text,
      };
      setTurns((prev) => [...prev, turn]);
      if (speakAloud) speakShow(turn);
      return turn;
    },
    [speakShow, translateForced],
  );

  const ingestTranscript = useCallback(
    (text: string, from: Side) => {
      const trimmed = text.trim();
      interimRef.current = trimmed;
      const { newSentences, nextEmittedCount, remainder } = takeNewCompleteSentences(
        trimmed,
        emittedCountRef.current,
      );
      for (const sent of newSentences) {
        // Live commits: no TTS while mic is open (fights the recognizer).
        commitSentence(sent, from, false);
      }
      emittedCountRef.current = nextEmittedCount;
      setInterim(remainder);
    },
    [commitSentence],
  );

  const flushRemainder = useCallback(
    (from: Side, speakAloud: boolean): Turn | null => {
      const full = interimRef.current.trim();
      let last: Turn | null = null;
      if (full) {
        const drained = takeNewCompleteSentences(full, emittedCountRef.current);
        for (const sent of drained.newSentences) {
          last = commitSentence(sent, from, false);
        }
        const leftover = drained.remainder.trim();
        if (leftover) {
          last = commitSentence(leftover, from, false);
        }
      }
      interimRef.current = '';
      setInterim('');
      emittedCountRef.current = 0;
      if (speakAloud && last) speakShow(last);
      return last;
    },
    [commitSentence, speakShow],
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
    if (!text || passingRef.current) return;
    ingestTranscript(text, sideRef.current);
  });

  useSpeechRecognitionEvent('error', () => {
    if (!passingRef.current) {
      listeningRef.current = false;
      setListening(false);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (passingRef.current) return;
    if (!listeningRef.current) return;
    // iOS often ends continuous sessions — restart on the SAME side/lang.
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      if (!listeningRef.current || passingRef.current) return;
      try {
        ExpoSpeechRecognitionModule.start({
          lang: sideRef.current === 'en' ? 'en-US' : 'ne-NP',
          interimResults: true,
          continuous: true,
          requiresOnDeviceRecognition: false,
        });
      } catch {
        listeningRef.current = false;
        setListening(false);
      }
    }, 140);
  });

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns, interim, side]);

  useEffect(() => {
    return () => {
      if (restartTimer.current) clearTimeout(restartTimer.current);
      hardStopRecognition();
      Speech.stop();
    };
  }, []);

  const hardStopRecognition = () => {
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
  };

  const stopListening = () => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    hardStopRecognition();
    listeningRef.current = false;
    setListening(false);
  };

  const startListeningFor = async (next: Side) => {
    try {
      hardStopRecognition();
      await new Promise((r) => setTimeout(r, 220));
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return false;
      sideRef.current = next;
      interimRef.current = '';
      emittedCountRef.current = 0;
      setInterim('');
      listeningRef.current = true;
      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: next === 'en' ? 'en-US' : 'ne-NP',
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: false,
      });
      return true;
    } catch {
      listeningRef.current = false;
      setListening(false);
      return false;
    }
  };

  const onPass = async () => {
    if (passingRef.current || busy) return;
    passingRef.current = true;
    setBusy(true);
    const from = sideRef.current;
    const next: Side = from === 'en' ? 'ne' : 'en';

    stopListening();
    Vibration.vibrate(40);

    try {
      await new Promise((r) => setTimeout(r, 260));
      flushRemainder(from, true);
      setSide(next);
      sideRef.current = next;
      // Hand the phone — immediately listen for the other speaker.
      await new Promise((r) => setTimeout(r, 420));
      await startListeningFor(next);
    } finally {
      setBusy(false);
      passingRef.current = false;
    }
  };

  const onToggleMic = async () => {
    if (busy) return;
    if (listening) {
      stopListening();
      return;
    }
    await startListeningFor(side);
  };

  const displayShow = (turn: Turn) => {
    if (turn.from === 'en') {
      return formatNepaliScript(turn.show, script);
    }
    return turn.show;
  };

  const displayHeard = (turn: Turn) => {
    if (turn.from === 'ne' && script === 'roman' && /[\u0900-\u097F]/.test(turn.heard)) {
      return formatNepaliScript(turn.heard, 'roman');
    }
    return turn.heard;
  };

  const latest = turns.length ? turns[turns.length - 1] : null;
  const history = turns.length > 1 ? turns.slice(0, -1).slice(-8) : [];

  const enTurn = side === 'en';
  const title = enTurn ? 'English speaking' : 'नेपाली बोलिरहेको';
  const hint = listening
    ? enTurn
      ? 'Listening — keep talking, then Pass'
      : 'सुन्दैछ — बोलिसकेपछि पास गर्नुहोस्'
    : enTurn
      ? 'Speak, then Pass the phone'
      : 'बोल्नुहोस्, अनि पास गर्नुहोस्';

  return (
    <View style={[styles.root, !enTurn && styles.rootNe]}>
      <View style={styles.topBar}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {enTurn ? 'They read Nepali below' : 'उनीहरूले तल अङ्ग्रेजी पढ्छन्'}
          </Text>
        </View>
        <View style={styles.topRight}>
          {onOpenGoldReview ? (
            <Pressable onPress={onOpenGoldReview} hitSlop={10} style={styles.iconBtn}>
              <Text style={styles.iconGlyph}>▣</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              stopListening();
              Speech.stop();
              setTurns([]);
              interimRef.current = '';
              emittedCountRef.current = 0;
              setInterim('');
              setSide('en');
              sideRef.current = 'en';
            }}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Text style={styles.clearText}>{enTurn ? 'Clear' : 'मेटाउनुहोस्'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.switches}>
        <LightSwitch
          value={formalOn}
          onValueChange={setFormalOn}
          offLabel={enTurn ? 'Informal' : 'अनौपचारिक'}
          onLabel={enTurn ? 'Formal' : 'औपचारिक'}
          accessibilityLabel="Formal or informal Nepali"
        />
        <LightSwitch
          value={devaOn}
          onValueChange={setDevaOn}
          offLabel="Roman"
          onLabel="देवनागरी"
          accessibilityLabel="Devanagari or Roman script"
        />
        <Pressable
          onPress={() => setFaceToFace((v) => !v)}
          style={[styles.faceChip, faceToFace && styles.faceChipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: faceToFace }}
        >
          <Text style={[styles.faceChipText, faceToFace && styles.faceChipTextOn]}>
            {faceToFace ? 'Face to face · on' : 'Face to face'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        keyboardShouldPersistTaps="handled"
      >
        {!latest && !interim ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {enTurn ? 'Start the conversation' : 'कुराकानी सुरु गर्नुहोस्'}
            </Text>
            <Text style={styles.emptyBody}>
              {enTurn
                ? 'Tap Speak, say a full sentence, then Pass. The phone will listen for Nepali next.'
                : 'बोल्नुहोस् थिच्नुहोस्, वाक्य भन्नुहोस्, अनि पास गर्नुहोस्। अर्को पटक अङ्ग्रेजी सुनिन्छ।'}
            </Text>
          </View>
        ) : null}

        {history.map((turn) => (
          <View
            key={turn.id}
            style={[
              styles.histRow,
              turn.from === 'en' ? styles.histEn : styles.histNe,
            ]}
          >
            <Text style={styles.histHeard} numberOfLines={2}>
              {displayHeard(turn)}
            </Text>
            <Text style={styles.histShow} numberOfLines={3}>
              {displayShow(turn)}
            </Text>
          </View>
        ))}

        {latest ? (
          <View
            style={[
              styles.hero,
              faceToFace && styles.heroFace,
              latest.from === 'en' ? styles.heroFromEn : styles.heroFromNe,
            ]}
          >
            <Text style={styles.heroLabel}>
              {latest.from === 'en' ? 'Show them · नेपाली' : 'Show them · English'}
            </Text>
            <Text
              style={[
                styles.heroShow,
                latest.from === 'en' && script === 'deva' && styles.heroShowNe,
              ]}
              selectable
            >
              {displayShow(latest)}
            </Text>
            <Text style={styles.heroHeard}>{displayHeard(latest)}</Text>
            <View style={styles.heroActions}>
              <Pressable onPress={() => speakShow(latest)} hitSlop={10}>
                <Text style={styles.heroAction}>Listen</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const result = translateForced(latest.heard, latest.from);
                  setTurns((prev) =>
                    prev.map((t) =>
                      t.id === latest.id ? { ...t, show: result.text } : t,
                    ),
                  );
                }}
                hitSlop={10}
              >
                <Text style={styles.heroAction}>Say differently</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {interim ? (
          <View style={styles.interim}>
            <Text style={styles.interimLabel}>
              {enTurn ? 'Hearing…' : 'सुन्दै…'}
            </Text>
            <Text style={styles.interimText}>{interim}</Text>
          </View>
        ) : null}

        {busy ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.forest} />
            <Text style={styles.loadingText}>
              {enTurn ? 'Handing off…' : 'पास गर्दै…'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.controls, !enTurn && styles.controlsNe]}>
        <Text style={styles.hint}>{hint}</Text>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.speakBtn, listening && styles.speakBtnHot]}
            onPress={() => void onToggleMic()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop' : 'Speak'}
          >
            <Text style={styles.speakGlyph}>{listening ? '■' : '●'}</Text>
            <Text style={styles.speakLabel}>
              {listening
                ? enTurn
                  ? 'Stop'
                  : 'रोक्नुहोस्'
                : enTurn
                  ? 'Speak'
                  : 'बोल्नुहोस्'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.passBtn, busy && styles.passBtnBusy]}
            onPress={() => void onPass()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Pass the phone"
          >
            <Text style={styles.passLabel}>{enTurn ? 'Pass' : 'पास'}</Text>
            <Text style={styles.passSub}>
              {enTurn ? 'Listen for Nepali next' : 'अर्को: अङ्ग्रेजी'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mintBg },
  rootNe: { backgroundColor: '#F4EBE3' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  titleBlock: { flex: 1, paddingRight: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  iconGlyph: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  clearText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  switches: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  faceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  faceChipOn: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  faceChipText: { fontSize: 12, fontWeight: '700', color: colors.text },
  faceChipTextOn: { color: '#fff' },
  feed: { flex: 1 },
  feedContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 22,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  histRow: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  histEn: { backgroundColor: 'rgba(255,255,255,0.7)', alignSelf: 'flex-end', maxWidth: '92%' },
  histNe: { backgroundColor: 'rgba(255,247,240,0.9)', alignSelf: 'flex-start', maxWidth: '92%' },
  histHeard: { fontSize: 12, color: colors.textSecondary },
  histShow: { fontSize: 15, fontWeight: '700', color: colors.text },
  hero: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 22,
    marginTop: 4,
    gap: 10,
    borderWidth: 2,
    borderColor: colors.forestSoft,
  },
  heroFace: { transform: [{ rotate: '180deg' }] },
  heroFromEn: { borderColor: colors.forestSoft },
  heroFromNe: { borderColor: '#F0D9C8' },
  heroLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.crimson,
  },
  heroShow: {
    fontSize: 34,
    lineHeight: 44,
    fontWeight: '800',
    color: colors.text,
  },
  heroShowNe: { fontSize: 36, lineHeight: 50 },
  heroHeard: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  heroActions: { flexDirection: 'row', gap: 18, marginTop: 4 },
  heroAction: { fontSize: 14, fontWeight: '800', color: colors.forest },
  interim: {
    backgroundColor: '#EEF2F0',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  interimLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  interimText: { fontSize: 18, lineHeight: 26, color: colors.text, fontWeight: '600' },
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
  controlsNe: {
    backgroundColor: '#F4EBE3',
    borderTopColor: '#E2D3C6',
  },
  hint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  actionRow: { flexDirection: 'row', gap: 12 },
  speakBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: colors.forest,
  },
  speakBtnHot: { backgroundColor: colors.danger },
  speakGlyph: { fontSize: 22, color: '#fff', fontWeight: '900' },
  speakLabel: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  passBtn: {
    flex: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: colors.crimson,
  },
  passBtnBusy: { opacity: 0.7 },
  passLabel: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
  passSub: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
});
