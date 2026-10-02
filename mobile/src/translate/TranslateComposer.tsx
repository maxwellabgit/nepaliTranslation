import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';
import { formatNepaliScript, type NepaliScript } from '../mt/onDeviceTranslate';
import type { Side } from './translationSessionReducer';

export type MicMode = 'idle' | 'typing' | 'listening';

const MIC = 120;
const BAR = 56;
const RAISE = 28;

type Props = {
  value: string;
  side: Side;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  /** On is formal, off is informal. */
  formal?: boolean;
  onFormality?: (formal: boolean) => void;
  expanded?: boolean;
  script?: NepaliScript;
  onToggleScript?: () => void;
  focused?: boolean;
  onFocusField?: () => void;
  onBlurField?: () => void;
  micMode?: MicMode;
  onPressMic?: () => void;
  micDisabled?: boolean;
  micTestId?: string;
  onPlaySource?: () => void;
  /** Show thumbs after a mic utterance is saved. */
  onUtteranceFeedback?: (feedback: 'up' | 'down') => void;
  /** Shown when the recording could not be stored. Thumbs stay hidden. */
  utteranceNotice?: string | null;
};

export function TranslateComposer({
  value,
  side,
  onChangeText,
  onSubmit,
  submitDisabled = false,
  formal = true,
  onFormality,
  expanded = false,
  script = 'deva',
  onToggleScript,
  focused = true,
  onFocusField,
  onBlurField,
  micMode = 'idle',
  onPressMic,
  micDisabled = false,
  micTestId = 'speak-hero',
  onPlaySource,
  onUtteranceFeedback,
  utteranceNotice,
}: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const inputRef = useRef<TextInput>(null);
  const micRef = useRef<View>(null);
  const docked = useRef(new Animated.Value(micMode === 'idle' ? 0 : 1)).current;
  const raised = useRef(new Animated.Value(micMode === 'listening' ? 1 : 0)).current;
  const [fieldH, setFieldH] = useState(expanded ? 300 : 160);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      docked.setValue(micMode === 'idle' ? 0 : 1);
      raised.setValue(micMode === 'listening' ? 1 : 0);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(docked, {
        toValue: micMode === 'idle' ? 0 : 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(raised, {
        toValue: micMode === 'listening' ? 1 : 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [docked, micMode, raised]);

  useEffect(() => {
    if (Platform.OS !== 'web' || micMode !== 'typing') return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      const input = inputRef.current as unknown as HTMLElement | null;
      const mic = micRef.current as unknown as HTMLElement | null;
      const inside = (node: HTMLElement | null) =>
        Boolean(node && target && (node === target || node.contains?.(target)));
      if (inside(input) || inside(mic)) return;
      onBlurField?.();
      const host =
        input?.querySelector?.('textarea,input') ?? input;
      (host as HTMLElement | null)?.blur?.();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [micMode, onBlurField]);

  const idleTop = Math.max(48, (fieldH - MIC) / 2);
  const dockedTop = Math.max(0, fieldH - BAR - MIC / 2 + 14);
  const circleTop = Animated.add(
    docked.interpolate({
      inputRange: [0, 1],
      outputRange: [idleTop, dockedTop],
    }),
    raised.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -RAISE],
    }),
  );
  const barHeight = Animated.add(
    docked.interpolate({
      inputRange: [0, 0.42, 1],
      outputRange: [0, 10, BAR],
      extrapolate: 'clamp',
    }),
    raised.interpolate({ inputRange: [0, 1], outputRange: [0, RAISE] }),
  );
  const scriptLine =
    side === 'ne' && value.trim()
      ? formatNepaliScript(value, script)
      : '';
  const showScriptLine = Boolean(scriptLine) && scriptLine !== value.trim();
  const formalityLabel =
    side === 'ne'
      ? formatNepaliScript(formal ? 'औपचारिक' : 'अनौपचारिक', script)
      : formal
        ? 'Formal'
        : 'Informal';
  const inactiveRed = theme.scheme === 'dark' ? '#C47A86' : '#D07A88';
  const micColor = raised.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveRed, theme.colors.crimson],
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          gap: 4,
          paddingHorizontal: 16,
          paddingTop: 4,
          ...(expanded ? { flex: 1 } : { flexGrow: 0, flexShrink: 0 }),
        },
        scriptRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          zIndex: 2,
        },
        formality: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flexShrink: 1,
        },
        scriptBtn: {
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 6,
          backgroundColor: theme.scheme === 'dark' ? '#3A3018' : '#F8E7C1',
        },
        scriptLabel: {
          fontSize: 13,
          fontWeight: '700',
          color: theme.scheme === 'dark' ? theme.colors.saffron : '#8A6A32',
        },
        field: {
          ...(expanded ? { flex: 1 } : { flexGrow: 0, flexShrink: 0 }),
          minHeight: expanded ? 220 : 168,
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.divider,
          paddingTop: 16,
          paddingHorizontal: 16,
          overflow: 'hidden',
        },
        input: {
          flexGrow: 1,
          minHeight: expanded ? 120 : 72,
          fontSize: 22,
          color: focused ? theme.colors.text : theme.colors.textSecondary,
          textAlignVertical: 'top',
          paddingBottom: micMode === 'idle' ? 16 : BAR + 12,
        },
        footer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 2,
        },
        feedback: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        options: {
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        send: {
          minHeight: 44,
          borderRadius: 22,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: theme.colors.crimson,
        },
        sendText: { color: theme.colors.onPrimary, fontSize: 14, fontWeight: '700' },
        count: {
          flex: 1,
          textAlign: 'right',
          fontSize: 11,
          color: theme.colors.textPlaceholder,
          paddingRight: 8,
        },
        scriptSub: {
          fontSize: 15,
          lineHeight: 20,
          color: theme.colors.textPlaceholder,
          marginBottom: 6,
          zIndex: 2,
        },
        bar: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: inactiveRed,
        },
        circle: {
          position: 'absolute',
          width: MIC,
          height: MIC,
          borderRadius: MIC / 2,
          backgroundColor: inactiveRed,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
          zIndex: 3,
          elevation: micMode === 'listening' ? 8 : 2,
          shadowColor: '#000',
          shadowOpacity: micMode === 'listening' ? 0.28 : 0.12,
          shadowRadius: micMode === 'listening' ? 10 : 4,
          shadowOffset: { width: 0, height: micMode === 'listening' ? -4 : 2 },
        },
      }),
    [expanded, focused, inactiveRed, micMode, theme],
  );

  return (
    <View style={styles.wrap}>
      <View
        style={styles.field}
        onLayout={(e) => setFieldH(e.nativeEvent.layout.height)}
      >
        <View style={styles.scriptRow}>
          <View style={styles.formality}>
            <Switch
              value={formal}
              onValueChange={onFormality}
              disabled={!onFormality}
              testID="formality-switch"
              accessibilityLabel={formalityLabel}
              trackColor={{ false: '#C8C2BC', true: theme.colors.crimson }}
              thumbColor="#FFFFFF"
            />
            <Text style={styles.scriptLabel} testID="formality-label">
              {formalityLabel}
            </Text>
          </View>
          {onToggleScript ? (
            <Pressable
              onPress={onToggleScript}
              accessibilityRole="button"
              accessibilityLabel={
                script === 'deva' ? 'देवनागरी लिपि' : 'romanized nepali'
              }
              testID="script-toggle"
              style={styles.scriptBtn}
            >
              <Text style={styles.scriptLabel}>
                {script === 'deva' ? 'देवनागरी लिपि' : 'romanized nepali'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={() => { if (!submitDisabled) onSubmit(); }}
          onFocus={onFocusField}
          onBlur={onBlurField}
          placeholder={
            side === 'en'
              ? t('translate.placeholderEn', lang)
              : formatNepaliScript(t('translate.placeholderNe', lang), script)
          }
          placeholderTextColor={theme.colors.textPlaceholder}
          style={styles.input}
          maxLength={240}
          multiline
          blurOnSubmit
          editable
          testID="translate-input"
          accessibilityLabel={t('translate.inputA11y', lang)}
          returnKeyType="done"
        />
        {showScriptLine ? (
          <Text style={styles.scriptSub} testID="source-script-line">
            {scriptLine}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Text style={styles.count}>{value.length}/240</Text>
          {utteranceNotice ? (
            <Text style={styles.count} testID="utterance-save-error">
              {utteranceNotice}
            </Text>
          ) : null}
          {onUtteranceFeedback ? (
            <View style={styles.feedback} testID="utterance-feedback">
              <Pressable
                onPress={() => onUtteranceFeedback('up')}
                accessibilityRole="button"
                accessibilityLabel={t('translate.utteranceUp', lang)}
                testID="utterance-up"
                hitSlop={8}
              >
                <Ionicons name="thumbs-up-outline" size={22} color={theme.colors.text} />
              </Pressable>
              <Pressable
                onPress={() => onUtteranceFeedback('down')}
                accessibilityRole="button"
                accessibilityLabel={t('translate.utteranceDown', lang)}
                testID="utterance-down"
                hitSlop={8}
              >
                <Ionicons name="thumbs-down-outline" size={22} color={theme.colors.text} />
              </Pressable>
            </View>
          ) : null}
          {onPlaySource ? (
            <Pressable
              onPress={onPlaySource}
              accessibilityRole="button"
              accessibilityLabel={t('translate.playSourceA11y', lang)}
              testID="play-source"
              hitSlop={8}
              style={styles.options}
            >
              <Ionicons name="volume-high-outline" size={20} color={theme.colors.text} />
            </Pressable>
          ) : null}
          <Pressable onPress={onSubmit} disabled={submitDisabled || !value.trim()}
            accessibilityRole="button" accessibilityLabel={t('translate.sendA11y', lang)}
            testID="translate-send" style={[styles.send, (submitDisabled || !value.trim()) && { opacity: .45 }]}>
            <Text style={styles.sendText}>{t('translate.send', lang)}</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.colors.onPrimary} />
          </Pressable>
        </View>
        {onPressMic ? (
          <>
            <Animated.View style={[styles.bar, { height: barHeight, backgroundColor: micColor }]} />
            <Animated.View style={[styles.circle, { top: circleTop, backgroundColor: micColor }]}>
              <View ref={micRef} collapsable={false} style={{ width: MIC, height: MIC }}>
              <Pressable
                onPress={onPressMic}
                disabled={micDisabled}
                accessibilityRole="button"
                accessibilityLabel={t('translate.speakA11y', lang)}
                testID={micTestId}
                style={{
                  width: MIC,
                  height: MIC,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: micDisabled ? 0.45 : 1,
                }}
              >
                <Ionicons
                  name={micMode === 'listening' ? 'stop' : 'mic'}
                  size={36}
                  color={theme.colors.onPrimary}
                />
              </Pressable>
              </View>
            </Animated.View>
            {micMode === 'idle' ? (
              <Animated.Text
                testID="tap-to-speak"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  top: Animated.add(circleTop, MIC + 8),
                  fontSize: 14,
                  color: theme.colors.textSecondary,
                  zIndex: 3,
                }}
              >
                {t('translate.tapToSpeak', lang)}
              </Animated.Text>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}
