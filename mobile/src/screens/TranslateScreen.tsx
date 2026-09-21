import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CorrectionSheet } from '../features/contribution/CorrectionSheet';
import { AdSlot } from '../features/ads/AdSlot';
import { MT_WARM_FAILED } from '../mt/mtStatus';
import { colors } from '../theme';
import type { HistoryItem } from '../storage/phrasebook';
import { CreditsGauge } from '../translate/CreditsGauge';
import { OptionsSheet } from '../translate/OptionsSheet';
import { TranslateComposer } from '../translate/TranslateComposer';
import { TurnCard } from '../translate/TurnCard';
import { useTranslationSession } from '../translate/useTranslationSession';
import { canPassPhone } from '../translate/passLogic';
import {
  latestFrom,
  sessionPhase,
} from '../translate/translationSessionReducer';

type Props = {
  seed?: HistoryItem | null;
  neuralReady?: boolean;
  mtWarmStatus?: string | null;
  active?: boolean;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
};

function statusCopy(phase: string, reason: string | null): string | null {
  switch (phase) {
    case 'requestingPermission':
      return 'Need microphone access to speak.';
    case 'listening':
      return 'Listening…';
    case 'finalizingTranscript':
      return 'Finishing speech…';
    case 'translating':
      return 'Translating…';
    case 'recoverableError':
      if (reason === 'permission_denied') {
        return 'Microphone permission denied. Type instead, or enable access in Settings.';
      }
      if (reason === 'empty_result') {
        return 'No translation for that text. Try different wording.';
      }
      if (reason === 'stt_error' || reason === 'stt_unavailable') {
        return 'Speech recognition failed. Type instead or try again.';
      }
      return 'Translation failed. Retry the turn or try again.';
    case 'unavailable':
      return 'Speech is unavailable on this device. You can still type.';
    default:
      return null;
  }
}

export function TranslateScreen({
  seed,
  neuralReady = false,
  mtWarmStatus = null,
  active = true,
  onOpenHistory,
  onOpenSettings,
}: Props) {
  const session = useTranslationSession({ active, seed });
  const { state, uiPhase } = session;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const phase = sessionPhase(state);
  const latest = state.turns[state.turns.length - 1];
  const showFailure = mtWarmStatus === MT_WARM_FAILED;
  const passEnabled = canPassPhone(state.draft, latestFrom(state), state.activeSide);
  const busy = state.translating || uiPhase.phase === 'listening';
  const status = statusCopy(uiPhase.phase, uiPhase.reasonCode);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (phase === 'empty') return;
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [state.turns.length, phase]);

  const speakLabel =
    uiPhase.phase === 'listening'
      ? 'Stop listening'
      : uiPhase.phase === 'requestingPermission'
        ? 'Requesting microphone'
        : 'Speak to translate';

  const speakButton = (testID: string) => (
    <Pressable
      onPress={() => void session.toggleListen()}
      disabled={state.translating && uiPhase.phase !== 'listening'}
      style={[
        styles.speak,
        uiPhase.phase === 'listening' && styles.speakListening,
        state.translating && uiPhase.phase !== 'listening' && styles.speakOff,
      ]}
      accessibilityRole="button"
      accessibilityLabel={speakLabel}
      accessibilityState={{
        disabled: state.translating && uiPhase.phase !== 'listening',
        busy: uiPhase.phase === 'listening' || state.translating,
      }}
      testID={testID}
    >
      <Ionicons
        name={uiPhase.phase === 'listening' ? 'stop' : 'mic'}
        size={28}
        color="#fff"
      />
      <Text style={styles.speakEn}>
        {uiPhase.phase === 'listening' ? 'Listening' : 'Speak'}
      </Text>
      <Text style={styles.speakNe}>
        {uiPhase.phase === 'listening' ? 'सुन्दै…' : 'बोल्नुहोस्'}
      </Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="translate-screen"
    >
      <View style={styles.header}>
        <Pressable
          onPress={onOpenHistory}
          accessibilityRole="button"
          accessibilityLabel="History"
          style={styles.iconBtn}
        >
          <Ionicons name="time-outline" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.brandBlock}>
          <Image source={require('../../assets/icon.png')} style={styles.mark} />
          <Text style={styles.brand}>
            <Text style={styles.brandNep}>Nep</Text>
            <Text style={styles.brandRest}>Translate</Text>
          </Text>
        </View>
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.iconBtn}
        >
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.langRow}>
        <Pressable
          onPress={() => session.dispatch({ type: 'setSide', side: 'en' })}
          style={[styles.langPill, state.activeSide === 'en' && styles.langOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: state.activeSide === 'en' }}
          accessibilityLabel="English"
        >
          <Text style={[styles.langText, state.activeSide === 'en' && styles.langTextOn]}>
            English
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            session.dispatch({
              type: 'setSide',
              side: state.activeSide === 'en' ? 'ne' : 'en',
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Swap languages"
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.crimson} />
        </Pressable>
        <Pressable
          onPress={() => session.dispatch({ type: 'setSide', side: 'ne' })}
          style={[styles.langPill, state.activeSide === 'ne' && styles.langOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: state.activeSide === 'ne' }}
          accessibilityLabel="Nepali"
        >
          <Text style={[styles.langText, state.activeSide === 'ne' && styles.langTextOn]}>
            Nepali
          </Text>
        </Pressable>
      </View>

      <CreditsGauge />

      {showFailure ? (
        <Text style={styles.failure} testID="mt-failure">
          {MT_WARM_FAILED}
          {!neuralReady ? ' Offline phrasebook still works.' : ''}
        </Text>
      ) : null}

      {status ? (
        <View style={styles.statusRow} testID="translate-status">
          <Text style={styles.statusText}>{status}</Text>
          {uiPhase.phase === 'recoverableError' ? (
            <Pressable
              onPress={session.clearError}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
              testID="translate-status-dismiss"
            >
              <Text style={styles.statusDismiss}>Dismiss</Text>
            </Pressable>
          ) : null}
          {uiPhase.phase === 'listening' ? (
            <Pressable
              onPress={session.cancelListen}
              accessibilityRole="button"
              accessibilityLabel="Cancel listening"
              testID="translate-cancel-listen"
            >
              <Text style={styles.statusDismiss}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {phase === 'empty' ? (
          <View style={styles.hero}>{speakButton('speak-hero')}</View>
        ) : (
          state.turns.map((turn) => (
            <TurnCard
              key={turn.id}
              turn={turn}
              turns={state.turns}
              script={state.script}
              isLatest={turn.id === latest?.id}
              busy={busy}
              onRetry={(item) => void session.retry(item)}
              onMarkIncorrect={
                turn.id === latest?.id ? () => setCorrectionOpen(true) : undefined
              }
            />
          ))
        )}
        {latest ? (
          <AdSlot
            surface="translate_result"
            eligible={active}
            keyboardVisible={keyboardVisible}
            listening={state.listening}
            speaking={false}
            modalVisible={correctionOpen || optionsOpen}
            appActive={active}
          />
        ) : null}
      </ScrollView>

      {phase === 'empty' ? null : (
        <View style={styles.dock}>
          {speakButton('speak-dock')}
          <Pressable
            onPress={session.pass}
            disabled={!passEnabled || busy}
            accessibilityRole="button"
            accessibilityLabel={state.activeSide === 'en' ? 'Pass' : 'पास'}
            accessibilityState={{ disabled: !passEnabled || busy }}
            testID="pass-phone"
            style={[styles.pass, (!passEnabled || busy) && styles.passOff]}
          >
            <Text style={styles.passText}>
              {state.activeSide === 'en' ? 'Pass' : 'पास'}
            </Text>
          </Pressable>
        </View>
      )}

      <TranslateComposer
        value={state.draft}
        side={state.activeSide}
        onChangeText={(text) => session.dispatch({ type: 'setDraft', text })}
        onSubmit={() => void session.submit()}
        onOpenOptions={() => setOptionsOpen(true)}
      />

      <OptionsSheet
        visible={optionsOpen}
        formality={state.formality}
        script={state.script}
        onClose={() => setOptionsOpen(false)}
        onFormality={session.setFormality}
        onScript={session.setScript}
      />

      <CorrectionSheet
        visible={correctionOpen}
        source={latest?.source ?? state.draft}
        translation={latest?.translation ?? ''}
        sourceLang={latest?.from ?? state.activeSide}
        formality={state.formality}
        script={state.script}
        surface="live_translate"
        translationMethod={latest?.method ?? null}
        modelVersion={null}
        onClose={() => setCorrectionOpen(false)}
        onNeedAuth={onOpenSettings}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBlock: { flex: 1, alignItems: 'center', gap: 2 },
  mark: { width: 28, height: 28, borderRadius: 6 },
  brand: { fontSize: 20, fontWeight: '700' },
  brandNep: { color: colors.crimson },
  brandRest: { color: colors.text },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  langPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  langOn: { backgroundColor: colors.crimson },
  langText: { fontWeight: '700', color: colors.text },
  langTextOn: { color: '#fff' },
  failure: {
    textAlign: 'center',
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  statusText: { flexShrink: 1, textAlign: 'center', color: colors.text, fontSize: 13 },
  statusDismiss: { fontWeight: '700', color: colors.crimson, fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, flexGrow: 1 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 220 },
  speak: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: colors.crimson,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  speakListening: { backgroundColor: colors.text },
  speakOff: { opacity: 0.45 },
  speakEn: { color: '#fff', fontWeight: '800', fontSize: 18 },
  speakNe: { color: '#fff', fontSize: 14 },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 8,
  },
  pass: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: colors.text,
  },
  passOff: { opacity: 0.4 },
  passText: { color: '#fff', fontWeight: '800' },
});
