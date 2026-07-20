import { useEffect, useRef, useState } from 'react';
import {
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
import { translateOnDevice, type Formality } from '../mt/onDeviceTranslate';
import { colors } from '../theme';

type Speaker = 'en' | 'ne';

type Turn = {
  id: string;
  from: Speaker;
  original: string;
  translated: string;
};

/**
 * Conversation mode: one Handoff (whose turn) + one Speak.
 * History scrolls upward like a chat. Formal/Informal controls EN→NE Nepali tone.
 */
export function ConversationScreen() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [speaker, setSpeaker] = useState<Speaker>('en');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [formality, setFormality] = useState<Formality>('formal');
  const pending = useRef<Speaker>('en');
  const scrollRef = useRef<ScrollView>(null);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript?.trim?.() ?? '';
    if (!text) return;
    setInterim(text);
    if (event.isFinal) {
      setListening(false);
      setInterim('');
      const from = pending.current;
      const direction = from === 'en' ? 'en-ne' : 'ne-en';
      const result = translateOnDevice(text, direction, formality);
      const turn: Turn = {
        id: `${Date.now()}`,
        from,
        original: text,
        translated: result.text,
      };
      setTurns((t) => [...t, turn]);
      Speech.stop();
      Speech.speak(result.text, {
        language: from === 'en' ? 'ne-NP' : 'en-US',
        rate: 0.95,
      });
    }
  });
  useSpeechRecognitionEvent('error', () => {
    setListening(false);
    setInterim('');
  });
  useSpeechRecognitionEvent('end', () => setListening(false));

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns, interim]);

  const handoff = () => {
    if (listening) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      setInterim('');
    }
    setSpeaker((s) => (s === 'en' ? 'ne' : 'en'));
  };

  const speak = async () => {
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
      pending.current = speaker;
      setListening(true);
      setInterim('');
      ExpoSpeechRecognitionModule.start({
        lang: speaker === 'en' ? 'en-US' : 'ne-NP',
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: true,
      });
    } catch {
      setListening(false);
    }
  };

  const clearChat = () => setTurns([]);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={clearChat} hitSlop={12} style={styles.iconBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
        <Text style={styles.title}>Conversation</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
      >
        {turns.length === 0 && !interim ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Pass the phone</Text>
            <Text style={styles.emptyBody}>
              Tap Handoff to switch English ↔ Nepali. Tap Speak, say a phrase,
              and the translation appears in the chat.
            </Text>
            <Text style={styles.emptyBodyNe}>
              Handoff थिचेर भाषा बदल्नुहोस्। Speak थिचेर बोल्नुहोस् — अनुवाद माथि देखिन्छ।
            </Text>
          </View>
        ) : null}

        {turns.map((t) => {
          const isEn = t.from === 'en';
          return (
            <View
              key={t.id}
              style={[styles.bubbleRow, isEn ? styles.rowEnd : styles.rowStart]}
            >
              <View
                style={[
                  styles.bubble,
                  isEn ? styles.bubbleEn : styles.bubbleNe,
                ]}
              >
                <Text style={styles.bubbleMeta}>
                  {isEn ? 'English → नेपाली' : 'नेपाली → English'}
                </Text>
                <Text style={styles.bubbleSource}>{t.original}</Text>
                <Text
                  style={[
                    styles.bubbleTarget,
                    isEn && styles.bubbleTargetNe,
                  ]}
                >
                  {t.translated}
                </Text>
                <Pressable
                  hitSlop={8}
                  style={styles.bubbleSpeak}
                  onPress={() =>
                    Speech.speak(t.translated, {
                      language: isEn ? 'ne-NP' : 'en-US',
                    })
                  }
                >
                  <Text style={styles.bubbleSpeakText}>🔊 Play</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {interim ? (
          <View
            style={[
              styles.bubbleRow,
              speaker === 'en' ? styles.rowEnd : styles.rowStart,
            ]}
          >
            <View style={[styles.bubble, styles.bubbleInterim]}>
              <Text style={styles.bubbleMeta}>Listening…</Text>
              <Text style={styles.bubbleSource}>{interim}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.controls}>
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

        <Text style={styles.turnLabel}>
          {speaker === 'en' ? 'English speaker’s turn' : 'नेपाली वक्ताको पालो'}
        </Text>

        <View style={styles.actionRow}>
          <Pressable style={styles.handoffBtn} onPress={handoff}>
            <Text style={styles.handoffGlyph}>⇄</Text>
            <Text style={styles.handoffLabel}>Handoff</Text>
            <Text style={styles.handoffSub}>
              {speaker === 'en' ? '→ Nepali' : '→ English'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.speakBtn, listening && styles.speakBtnHot]}
            onPress={speak}
          >
            <Text style={styles.speakGlyph}>{listening ? '■' : '🎤'}</Text>
            <Text style={styles.speakLabel}>
              {listening ? 'Stop' : 'Speak'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mintBg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  iconBtn: {
    minWidth: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  feed: { flex: 1 },
  feedContent: { padding: 16, paddingBottom: 24, gap: 10 },
  emptyCard: {
    backgroundColor: colors.mintCard,
    borderRadius: 20,
    padding: 22,
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
    marginBottom: 10,
  },
  emptyBodyNe: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  bubbleRow: { width: '100%' },
  rowEnd: { alignItems: 'flex-end' },
  rowStart: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '88%',
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  bubbleEn: {
    backgroundColor: '#FFF7F0',
    borderBottomRightRadius: 6,
  },
  bubbleNe: {
    backgroundColor: colors.mintCard,
    borderBottomLeftRadius: 6,
  },
  bubbleInterim: {
    backgroundColor: '#EEF2F0',
    opacity: 0.9,
  },
  bubbleMeta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  bubbleSource: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  bubbleTarget: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  bubbleTargetNe: {
    fontSize: 22,
    lineHeight: 32,
  },
  bubbleSpeak: { alignSelf: 'flex-start', marginTop: 4 },
  bubbleSpeakText: { fontSize: 13, color: colors.forest, fontWeight: '600' },
  controls: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D5E3DB',
    backgroundColor: colors.mintBg,
  },
  formalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  formalityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 2,
  },
  formChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C8D6CE',
    backgroundColor: colors.surface,
  },
  formChipOn: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  formChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  formChipTextOn: { color: '#fff' },
  turnLabel: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  handoffBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#C8D6CE',
  },
  handoffGlyph: { fontSize: 22, color: colors.forest },
  handoffLabel: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  handoffSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  speakBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
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
});
