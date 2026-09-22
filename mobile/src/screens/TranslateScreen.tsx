import { useEffect, useMemo, useRef, useState } from 'react';
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
import { t, useUiLang, type UiLang } from '../i18n';
import { MIN_TOUCH } from '../layout/sizeClass';
import { useTheme } from '../theme';
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

function statusCopy(
  phase: string,
  reason: string | null,
  lang: UiLang,
): string | null {
  switch (phase) {
    case 'requestingPermission':
      return t('translate.status.needMic', lang);
    case 'listening':
      return t('translate.status.listening', lang);
    case 'finalizingTranscript':
      return t('translate.status.finalizing', lang);
    case 'translating':
      return t('translate.status.translating', lang);
    case 'recoverableError':
      if (reason === 'permission_denied') {
        return t('translate.status.micDenied', lang);
      }
      if (reason === 'empty_result') {
        return t('translate.status.emptyResult', lang);
      }
      if (reason === 'stt_error' || reason === 'stt_unavailable') {
        return t('translate.status.sttFailed', lang);
      }
      return t('translate.status.translateFailed', lang);
    case 'unavailable':
      if (reason === 'stt_unsupported') {
        return t('translate.status.sttUnsupported', lang);
      }
      return t('translate.status.speechUnavailable', lang);
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
  const theme = useTheme();
  const lang = useUiLang();
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
  const status = statusCopy(uiPhase.phase, uiPhase.reasonCode, lang);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
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
        brandNep: { color: theme.colors.crimson },
        brandRest: { color: theme.colors.text },
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
          backgroundColor: theme.colors.surface,
        },
        langOn: { backgroundColor: theme.colors.crimson },
        langText: { fontWeight: '700', color: theme.colors.text },
        langTextOn: { color: theme.colors.onPrimary },
        failure: {
          textAlign: 'center',
          color: theme.colors.danger,
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
        statusText: {
          flexShrink: 1,
          textAlign: 'center',
          color: theme.colors.text,
          fontSize: 13,
        },
        statusDismiss: {
          fontWeight: '700',
          color: theme.colors.crimson,
          fontSize: 13,
        },
        scroll: { flex: 1 },
        scrollContent: { padding: 16, gap: 12, flexGrow: 1 },
        hero: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 220,
        },
        speak: {
          width: 148,
          height: 148,
          borderRadius: 74,
          backgroundColor: theme.colors.crimson,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        },
        speakListening: { backgroundColor: theme.colors.text },
        speakOff: { opacity: 0.45 },
        speakEn: {
          color: theme.colors.onPrimary,
          fontWeight: '800',
          fontSize: 18,
        },
        speakNe: { color: theme.colors.onPrimary, fontSize: 14 },
        dock: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          paddingBottom: 8,
        },
        pass: {
          paddingHorizontal: 18,
          minHeight: MIN_TOUCH,
          borderRadius: 20,
          backgroundColor: theme.colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        },
        passOff: { opacity: 0.4 },
        passText: { color: theme.colors.onPrimary, fontWeight: '800' },
      }),
    [theme],
  );

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

  const speechUnavailable = uiPhase.phase === 'unavailable';
  const speakLabel =
    uiPhase.phase === 'listening'
      ? t('translate.stopA11y', lang)
      : uiPhase.phase === 'requestingPermission'
        ? t('translate.requestingMicA11y', lang)
        : speechUnavailable
          ? t('translate.speechUnavailableA11y', lang)
          : t('translate.speakA11y', lang);

  const speakVisibleEn =
    uiPhase.phase === 'listening'
      ? t('translate.listening', lang)
      : t('translate.speak', lang);
  const speakVisibleNe =
    uiPhase.phase === 'listening'
      ? t('translate.listeningNe', lang)
      : t('translate.speakNe', lang);
  const passLabel =
    state.activeSide === 'en'
      ? t('translate.pass', lang)
      : t('translate.passNe', lang);

  const speakButton = (testID: string) => (
    <Pressable
      onPress={() => void session.toggleListen()}
      disabled={
        speechUnavailable ||
        (state.translating && uiPhase.phase !== 'listening')
      }
      style={[
        styles.speak,
        uiPhase.phase === 'listening' && styles.speakListening,
        (speechUnavailable ||
          (state.translating && uiPhase.phase !== 'listening')) &&
          styles.speakOff,
      ]}
      accessibilityRole="button"
      accessibilityLabel={speakLabel}
      accessibilityState={{
        disabled:
          speechUnavailable ||
          (state.translating && uiPhase.phase !== 'listening'),
        busy: uiPhase.phase === 'listening' || state.translating,
      }}
      testID={testID}
    >
      <Ionicons
        name={uiPhase.phase === 'listening' ? 'stop' : 'mic'}
        size={28}
        color={theme.colors.onPrimary}
      />
      <Text style={styles.speakEn}>{speakVisibleEn}</Text>
      <Text style={styles.speakNe}>{speakVisibleNe}</Text>
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
          accessibilityLabel={t('translate.historyA11y', lang)}
          testID="open-history"
          style={styles.iconBtn}
        >
          <Ionicons name="time-outline" size={22} color={theme.colors.text} />
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
          accessibilityLabel={t('translate.settingsA11y', lang)}
          testID="open-settings"
          style={styles.iconBtn}
        >
          <Ionicons name="settings-outline" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={styles.langRow}>
        <Pressable
          onPress={() => session.dispatch({ type: 'setSide', side: 'en' })}
          style={[styles.langPill, state.activeSide === 'en' && styles.langOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: state.activeSide === 'en' }}
          accessibilityLabel={t('translate.sideEn', lang)}
        >
          <Text style={[styles.langText, state.activeSide === 'en' && styles.langTextOn]}>
            {t('translate.sideEn', lang)}
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
          accessibilityLabel={t('translate.swapA11y', lang)}
        >
          <Ionicons name="swap-horizontal" size={20} color={theme.colors.crimson} />
        </Pressable>
        <Pressable
          onPress={() => session.dispatch({ type: 'setSide', side: 'ne' })}
          style={[styles.langPill, state.activeSide === 'ne' && styles.langOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: state.activeSide === 'ne' }}
          accessibilityLabel={t('translate.sideNe', lang)}
        >
          <Text style={[styles.langText, state.activeSide === 'ne' && styles.langTextOn]}>
            {t('translate.sideNe', lang)}
          </Text>
        </Pressable>
      </View>

      <CreditsGauge />

      {showFailure ? (
        <Text style={styles.failure} testID="mt-failure">
          {t('translate.mtWarmFailed', lang)}
          {!neuralReady ? t('translate.phrasebookHint', lang) : ''}
        </Text>
      ) : null}

      {status ? (
        <View style={styles.statusRow} testID="translate-status">
          <Text style={styles.statusText}>{status}</Text>
          {uiPhase.phase === 'recoverableError' ? (
            <Pressable
              onPress={session.clearError}
              accessibilityRole="button"
              accessibilityLabel={t('translate.dismissErrorA11y', lang)}
              testID="translate-status-dismiss"
            >
              <Text style={styles.statusDismiss}>
                {t('translate.dismissError', lang)}
              </Text>
            </Pressable>
          ) : null}
          {uiPhase.phase === 'listening' ? (
            <Pressable
              onPress={session.cancelListen}
              accessibilityRole="button"
              accessibilityLabel={t('translate.cancelListenA11y', lang)}
              testID="translate-cancel-listen"
            >
              <Text style={styles.statusDismiss}>
                {t('translate.cancelListen', lang)}
              </Text>
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
        {phase === 'empty' ? (
          <AdSlot
            surface="translate_idle"
            eligible={
              active &&
              !state.draft.trim() &&
              !busy &&
              !keyboardVisible
            }
            keyboardVisible={keyboardVisible}
            listening={state.listening}
            speaking={false}
            translating={state.translating}
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
            accessibilityLabel={passLabel}
            accessibilityState={{ disabled: !passEnabled || busy }}
            testID="pass-phone"
            style={[styles.pass, (!passEnabled || busy) && styles.passOff]}
          >
            <Text style={styles.passText}>{passLabel}</Text>
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
