import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useRuntime } from '../runtime/RuntimeContext';
import type { HistoryItem } from '../storage/phrasebook';
import { companionNepaliScript, formatNepaliScript } from '../mt/onDeviceTranslate';
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
  onOpenReview?: () => void;
  /** Pass-the-phone exchange. The homepage leaves this false. */
  conversation?: boolean;
  onGoHome?: () => void;
};

function statusBusy(phase: string): boolean {
  return (
    phase === 'requestingPermission' ||
    phase === 'finalizingTranscript' ||
    phase === 'translating'
  );
}

function statusCopy(
  phase: string,
  reason: string | null,
  lang: UiLang,
): string | null {
  switch (phase) {
    case 'listening':
      return null;
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
  onOpenReview,
  conversation = false,
  onGoHome,
}: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const runtime = useRuntime();
  const session = useTranslationSession({ active, seed });
  const { state, uiPhase } = session;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [boxFocus, setBoxFocus] = useState<'source' | 'result'>('source');
  const [micDocked, setMicDocked] = useState(false);
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
        brandBlock: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
        mark: { width: 28, height: 28, borderRadius: 6 },
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
        stage: { flex: 1 },
        hero: {
          ...StyleSheet.absoluteFill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        speak: {
          width: 120,
          height: 120,
          borderRadius: 60,
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
        speakBola: {
          color: theme.colors.onPrimary,
          fontWeight: '800',
          fontSize: 16,
        },
        speakNe: { color: theme.colors.onPrimary, fontSize: 13 },
        speakCorner: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.crimson,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dock: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          paddingBottom: 8,
        },
        pass: {
          paddingHorizontal: 36,
          minWidth: 168,
          minHeight: MIN_TOUCH,
          borderRadius: 20,
          backgroundColor: theme.colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        },
        passOff: { opacity: 0.4 },
        passText: { color: theme.colors.onPrimary, fontWeight: '800' },
        conversationTitle: {
          flex: 1,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: '700',
          color: theme.colors.text,
        },
        turnBanner: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 16,
          backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
          gap: 4,
        },
        turnTitle: {
          fontSize: 20,
          fontWeight: '800',
          color: theme.colors.text,
        },
        turnHint: {
          fontSize: 14,
          color: theme.scheme === 'dark' ? theme.colors.saffron : '#8A6A32',
        },
        resultBox: {
          position: 'relative',
          marginHorizontal: 16,
          marginTop: 8,
          minHeight: 96,
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          padding: 16,
          justifyContent: 'center',
        },
        resultText: {
          fontSize: 22,
          fontWeight: '700',
          color: theme.colors.text,
        },
        resultHintText: {
          fontSize: 22,
          color: theme.colors.textPlaceholder,
        },
        resultSub: {
          marginTop: 6,
          fontSize: 15,
          lineHeight: 20,
          color: theme.colors.textPlaceholder,
        },
        playResult: {
          position: 'absolute',
          right: 12,
          bottom: 12,
        },
        markIncorrect: {
          marginHorizontal: 20,
          marginTop: 8,
          fontSize: 13,
          fontWeight: '700',
          color: theme.colors.text,
        },
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

  const passLabel =
    state.activeSide === 'en'
      ? t('translate.pass', lang)
      : t('translate.passNe', lang);

  const speakInBox = uiPhase.phase === 'listening' || state.listening;
  const micMode = conversation
    ? speakInBox
      ? 'listening'
      : 'typing'
    : speakInBox
      ? 'listening'
      : micDocked
        ? 'typing'
        : 'idle';
  const resultText = latest
    ? latest.from === 'en'
      ? formatNepaliScript(latest.translation, state.script)
      : latest.translation
    : '';
  const resultHint = latest
    ? ''
    : state.activeSide === 'en'
      ? formatNepaliScript('अनुवाद यहाँ देखिन्छ', state.script)
      : 'Translation';
  const resultSub = latest
    ? latest.from === 'en'
      ? companionNepaliScript(latest.translation, state.script)
      : formatNepaliScript(latest.source, state.script)
    : '';
  const playSource = () => {
    const typed = state.draft.trim();
    const text = typed || latest?.source || '';
    if (!text) return;
    const from = typed ? state.activeSide : (latest?.from ?? state.activeSide);
    runtime.speechSynthesis.stop();
    runtime.speechSynthesis.speak(text, {
      language: from === 'en' ? 'en-US' : 'ne-NP',
    });
  };
  const playResult = () => {
    if (!latest?.translation.trim()) return;
    runtime.speechSynthesis.stop();
    runtime.speechSynthesis.speak(latest.translation, {
      language: latest.from === 'en' ? 'ne-NP' : 'en-US',
    });
  };

  const speakButton = (testID: string, placement: 'hero' | 'corner' | 'dock' = 'hero') => (
    <Pressable
      onPress={() => void session.toggleListen()}
      disabled={
        speechUnavailable ||
        (state.translating && uiPhase.phase !== 'listening')
      }
      style={[
        placement === 'corner' ? styles.speakCorner : styles.speak,
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
      {placement === 'corner' ? (
        <Ionicons
          name={uiPhase.phase === 'listening' ? 'stop' : 'mic'}
          size={18}
          color={theme.colors.onPrimary}
        />
      ) : (
        <>
          <Ionicons
            name={uiPhase.phase === 'listening' ? 'stop' : 'mic'}
            size={32}
            color={theme.colors.onPrimary}
          />
        </>
      )}
    </Pressable>
  );

  const sheets = (
    <>
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
        historyItemId={latest?.id ?? null}
        translationMethod={latest?.method ?? null}
        modelVersion={null}
        onClose={() => setCorrectionOpen(false)}
        onNeedAuth={onOpenSettings}
      />
    </>
  );

  if (conversation) {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        testID="conversation-screen"
      >
        <View style={styles.header}>
          <Pressable
            onPress={onGoHome}
            accessibilityRole="button"
            accessibilityLabel={t('common.backHome', lang)}
            testID="back-home"
            style={styles.iconBtn}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.conversationTitle}>{t('conversation.title', lang)}</Text>
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

        {status ? (
          <View style={styles.statusRow} testID="translate-status">
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.turnBanner} testID="conversation-turn">
            <Text style={styles.turnTitle}>
              {state.activeSide === 'en'
                ? t('conversation.turnEn', lang)
                : t('conversation.turnNe', lang)}
            </Text>
            <Text style={styles.turnHint}>{t('conversation.hint', lang)}</Text>
          </View>
          {state.turns.map((turn) => (
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
          ))}
        </ScrollView>

        <TranslateComposer
          value={state.draft}
          side={state.activeSide}
          onChangeText={(text) => session.dispatch({ type: 'setDraft', text })}
          onSubmit={() => void session.submit()}
          formal={state.formality === 'formal'}
          onFormality={session.setFormality}
          expanded
          focused={boxFocus === 'source'}
          onFocusField={() => {
            setBoxFocus('source');
            setMicDocked(true);
          }}
          script={state.script}
          onToggleScript={() => session.setScript(state.script !== 'deva')}
          micMode={micMode}
          onPressMic={() => {
          setMicDocked(true);
          void session.toggleListen();
        }}
          micDisabled={
            speechUnavailable ||
            (state.translating && uiPhase.phase !== 'listening')
          }
          micTestId="speak-hero"
          onPlaySource={playSource}
        />

        <View style={styles.dock}>
          <Pressable
            onPress={() => {
              if (passEnabled) session.pass();
              else {
                session.dispatch({
                  type: 'setSide',
                  side: state.activeSide === 'en' ? 'ne' : 'en',
                });
              }
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={passLabel}
            accessibilityState={{ disabled: busy }}
            testID="pass-phone"
            style={[styles.pass, busy && styles.passOff]}
          >
            <Text style={styles.passText}>{passLabel}</Text>
          </Pressable>
        </View>
        {sheets}
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="translate-screen"
    >
      <View style={styles.header}>
        {conversation ? (
          <Pressable
            onPress={onGoHome}
            accessibilityRole="button"
            accessibilityLabel={t('common.backHome', lang)}
            testID="back-home"
            style={styles.iconBtn}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onOpenHistory}
            accessibilityRole="button"
            accessibilityLabel={t('translate.historyA11y', lang)}
            testID="open-history"
            style={styles.iconBtn}
          >
            <Ionicons name="time-outline" size={22} color={theme.colors.text} />
          </Pressable>
        )}
        <View style={styles.brandBlock}>
          <Image source={require('../../assets/icon.png')} style={styles.mark} />
        </View>
        <CreditsGauge compact onPress={onOpenReview} />
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

      <View style={styles.stage}>
      <TranslateComposer
        value={state.draft}
        side={state.activeSide}
        onChangeText={(text) => session.dispatch({ type: 'setDraft', text })}
        onSubmit={() => void session.submit()}
        formal={state.formality === 'formal'}
        onFormality={session.setFormality}
        expanded
        focused={boxFocus === 'source'}
        onFocusField={() => {
          setBoxFocus('source');
          setMicDocked(true);
        }}
        script={state.script}
        onToggleScript={() => session.setScript(state.script !== 'deva')}
        micMode={micMode}
        onPressMic={() => {
          setMicDocked(true);
          void session.toggleListen();
        }}
        micDisabled={
          speechUnavailable ||
          (state.translating && uiPhase.phase !== 'listening')
        }
        micTestId="speak-hero"
        onPlaySource={playSource}
      />
      <Pressable
        onPress={() => {
          setBoxFocus('result');
          Keyboard.dismiss();
        }}
        style={styles.resultBox}
        testID="translate-result"
      >
        <Text
          style={
            resultText && boxFocus === 'result'
              ? styles.resultText
              : styles.resultHintText
          }
          testID="translate-output"
        >
          {resultText || resultHint}
        </Text>
        {resultSub && resultSub !== resultText ? (
          <Text style={styles.resultSub} testID="translate-result-script">
            {resultSub}
          </Text>
        ) : null}
        {resultText ? (
          <Pressable
            onPress={playResult}
            accessibilityRole="button"
            accessibilityLabel={t('translate.playA11y', lang)}
            testID="play-result"
            hitSlop={8}
            style={styles.playResult}
          >
            <Ionicons name="volume-high-outline" size={22} color={theme.colors.text} />
          </Pressable>
        ) : null}
      </Pressable>

      {showFailure ? (
        <Text style={styles.failure} testID="mt-failure">
          {t('translate.mtWarmFailed', lang)}
          {!neuralReady ? t('translate.phrasebookHint', lang) : ''}
        </Text>
      ) : null}

      {statusBusy(uiPhase.phase) ? (
        <ActivityIndicator style={styles.statusRow} testID="translate-status" />
      ) : status ? (
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
        </View>
      ) : null}

      {latest ? (
        <Pressable
          onPress={() => setCorrectionOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('translate.markIncorrectA11y', lang)}
          testID="mark-incorrect"
        >
          <Text style={styles.markIncorrect}>{t('translate.markIncorrect', lang)}</Text>
        </Pressable>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
          {speakInBox ? null : speakButton('speak-dock', 'dock')}
          {conversation ? (
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
          ) : null}
        </View>
      )}
      </View>

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
        historyItemId={latest?.id ?? null}
        translationMethod={latest?.method ?? null}
        modelVersion={null}
        onClose={() => setCorrectionOpen(false)}
        onNeedAuth={onOpenSettings}
      />
    </KeyboardAvoidingView>
  );
}
