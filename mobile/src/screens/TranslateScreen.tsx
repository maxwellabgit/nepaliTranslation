import { useEffect, useState } from 'react';
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

export function TranslateScreen({
  seed,
  mtWarmStatus = null,
  active = true,
  onOpenHistory,
  onOpenSettings,
}: Props) {
  const session = useTranslationSession({ active, seed });
  const { state } = session;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const phase = sessionPhase(state);
  const latest = state.turns[state.turns.length - 1];
  const showFailure = mtWarmStatus === MT_WARM_FAILED;
  const passEnabled = canPassPhone(state.draft, latestFrom(state), state.activeSide);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const speakButton = (testID: string) => (
    <Pressable
      onPress={() => void session.toggleListen()}
      style={styles.speak}
      accessibilityRole="button"
      accessibilityLabel="Speak to translate"
      testID={testID}
    >
      <Ionicons name="mic" size={28} color="#fff" />
      <Text style={styles.speakEn}>Speak</Text>
      <Text style={styles.speakNe}>बोल्नुहोस्</Text>
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
        </Text>
      ) : null}

      <ScrollView
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
            disabled={!passEnabled}
            accessibilityRole="button"
            accessibilityLabel={state.activeSide === 'en' ? 'Pass' : 'पास'}
            testID="pass-phone"
            style={[styles.pass, !passEnabled && styles.passOff]}
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
