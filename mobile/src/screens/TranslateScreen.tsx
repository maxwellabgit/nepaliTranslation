import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { updateHistoryTranslation, type HistoryItem } from '../storage/phrasebook';
import { companionNepaliScript, formatNepaliScript } from '../mt/onDeviceTranslate';
import { CreditsGauge } from '../translate/CreditsGauge';
import { CreditAwardOverlay } from '../translate/CreditAwardOverlay';
import { useCreditAwardOptional } from '../translate/CreditAwardProvider';
import { PromoRotator } from '../components/PromoRotator';
import { useSubscriptionOptional } from '../features/subscription/SubscriptionProvider';
import { TranslateComposer } from '../translate/TranslateComposer';
import { useTranslationSession } from '../translate/useTranslationSession';

type Props = {
  seed?: HistoryItem | null;
  neuralReady?: boolean;
  mtWarmStatus?: string | null;
  active?: boolean;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenReview?: () => void;
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
  mtWarmStatus = null,
  active = true,
  onOpenHistory,
  onOpenSettings,
  onOpenReview,
}: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const award = useCreditAwardOptional();
  const runtime = useRuntime();
  const subscription = useSubscriptionOptional();
  const session = useTranslationSession({ active, seed });
  const { state, uiPhase } = session;
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [bannerFilled, setBannerFilled] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [boxFocus, setBoxFocus] = useState<'source' | 'result'>('source');
  const [micDocked, setMicDocked] = useState(false);
  const suppressMicDock = useRef(false);
  const latest = state.turns[state.turns.length - 1];
  const showFailure = mtWarmStatus === MT_WARM_FAILED;
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
        langOn: { backgroundColor: '#F3D5D8' },
        langText: { fontWeight: '700', color: theme.colors.text },
        langTextOn: { color: theme.colors.text },
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
        stage: { flex: 1 },
        dock: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingBottom: 8,
        },
        flip: {
          flex: 1,
          minHeight: MIN_TOUCH,
          borderRadius: 20,
          backgroundColor: '#111111',
          alignItems: 'center',
          justifyContent: 'center',
        },
        pass: {
          flex: 1,
          paddingHorizontal: 18,
          minHeight: MIN_TOUCH,
          borderRadius: 20,
          backgroundColor: theme.scheme === 'dark' ? '#2E9B57' : '#1F8A4C',
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
          alignSelf: 'stretch',
          width: '100%',
          backgroundColor: theme.colors.surface,
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 4,
        },
        chatContent: {
          flexGrow: 1,
        },
        chatSpacer: {
          flex: 1,
        },
        turnTitle: {
          fontSize: 17,
          fontWeight: '600',
          color: theme.colors.text,
        },
        turnHint: {
          fontSize: 13,
          color: theme.colors.textSecondary,
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
          justifyContent: 'flex-start',
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
        resultHead: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
        },
        feedback: {
          fontSize: 13,
          fontWeight: '700',
          color: theme.colors.crimson,
        },
        feedbackPrompt: {
          marginTop: 12,
          fontSize: 15,
          lineHeight: 21,
          fontWeight: '600',
          color: theme.colors.text,
        },
        feedbackNote: {
          marginTop: 6,
          fontSize: 12,
          lineHeight: 17,
          color: theme.colors.textSecondary,
        },
        feedbackInput: {
          marginTop: 10,
          minHeight: 72,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          borderRadius: 12,
          padding: 12,
          fontSize: 16,
          color: theme.colors.text,
          textAlignVertical: 'top',
        },
      }),
    [theme],
  );

  useEffect(() => {
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setMicDocked(false);
    });
    return () => {
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!active) setMicDocked(false);
  }, [active]);

  const speechUnavailable = uiPhase.phase === 'unavailable';

  const speakInBox = uiPhase.phase === 'listening' || state.listening;
  const micMode = speakInBox
    ? 'listening'
    : micDocked || feedbackOpen
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
      ? t('translate.resultHintEn', 'en')
      : formatNepaliScript(t('translate.resultHintNe', 'ne'), state.script);
  const resultSub =
    latest?.from === 'en'
      ? companionNepaliScript(latest.translation, state.script)
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
  const saveFeedback = async () => {
    const text = feedbackDraft.trim();
    if (!text || !latest?.id) return;
    await updateHistoryTranslation(latest.id, text);
    setFeedbackOpen(false);
  };

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

      <PromoRotator
        onAdFree={() => subscription?.openPaywall()}
        onEarn={() => onOpenReview?.()}
        adFilled={bannerFilled}
        ad={
          <AdSlot
            surface="translate_idle"
            embed
            eligible={active}
            appActive={active}
            modalVisible={correctionOpen}
            onFillChange={setBannerFilled}
          />
        }
      />

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
          <Ionicons name="swap-horizontal" size={20} color="#1A1410" />
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
          if (suppressMicDock.current) return;
          setBoxFocus('source');
          setMicDocked(true);
        }}
        onBlurField={() => {
          if (uiPhase.phase === 'listening' || state.listening) return;
          suppressMicDock.current = true;
          setMicDocked(false);
          setTimeout(() => {
            suppressMicDock.current = false;
          }, 150);
        }}
        script={state.script}
        onToggleScript={() => session.setScript(state.script !== 'deva')}
        micMode={micMode}
        onPressMic={() => {
          setMicDocked(true);
          void session.toggleListen();
        }}
        onUtteranceFeedback={
          session.utteranceOffer ? (feedback) => session.rateUtterance(feedback) : undefined
        }
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
          setMicDocked(false);
          Keyboard.dismiss();
        }}
        style={[styles.resultBox, feedbackOpen && { paddingBottom: 48 }]}
        testID="translate-result"
      >
        <View style={styles.resultHead}>
          <Text
            style={[
              resultText && boxFocus === 'result'
                ? styles.resultText
                : styles.resultHintText,
              { flex: 1 },
            ]}
            testID="translate-output"
          >
            {resultText || resultHint}
          </Text>
          {latest ? (
            <Pressable
              onPress={() => {
                setFeedbackDraft(latest.translation);
                setFeedbackOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('translate.feedbackA11y', lang)}
              testID="mark-incorrect"
            >
              <Text style={styles.feedback}>{t('translate.feedback', lang)}</Text>
            </Pressable>
          ) : null}
        </View>
        {resultSub && resultSub !== resultText ? (
          <Text style={styles.resultSub} testID="translate-result-script">
            {resultSub}
          </Text>
        ) : null}
        {feedbackOpen && latest ? (
          <View testID="correction-sheet">
            <Text style={styles.feedbackPrompt}>
              {t('translate.feedbackPrompt', lang)}
            </Text>
            <Text style={styles.feedbackNote}>{t('credits.notMoney', lang)}</Text>
            <TextInput
              value={feedbackDraft}
              onChangeText={setFeedbackDraft}
              multiline
              style={styles.feedbackInput}
              testID="correction-input"
            />
            <Pressable
              onPress={() => void saveFeedback()}
              accessibilityRole="button"
              testID="correction-save-draft"
              style={{ marginTop: 8, alignSelf: 'flex-start' }}
            >
              <Text style={styles.feedback}>{t('contributions.saveDevice', lang)}</Text>
            </Pressable>
          </View>
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

      </View>

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
      {award.presentation && award.phase !== 'idle' ? (
        <CreditAwardOverlay
          credits={award.presentation.credits}
          minutes={award.presentation.minutes}
          capped={award.presentation.capped}
          totalCredits={Math.floor(award.presentation.toRemainingMs / 600_000)}
          title={award.presentation.title}
          body={award.presentation.body}
          rewardName={award.presentation.rewardName}
          flying={award.phase !== 'message'}
          onCollect={award.collect}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
