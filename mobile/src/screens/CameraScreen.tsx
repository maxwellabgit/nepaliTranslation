import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { t, useUiLang, type UiLang } from '../i18n';
import { MIN_TOUCH } from '../layout/sizeClass';
import { useTheme } from '../theme';
import { BackArrow } from '../components/BackArrow';
import { buildCorrelation } from '../camera/correlate';
import { focusPointFromTap } from '../camera/focusPoint';
import { deleteCapture } from '../camera/deleteCapture';
import { highlightPercents } from '../camera/highlightLayout';
import { photoAboveSheet, resultSheetTops } from '../camera/resultLayout';
import { INSCRIPTION_TRANSLATIONS } from '../camera/inscriptionFixture';
import { readCapturePreviewUri } from '../camera/readCapturePreview';
import { withAlpha } from '../camera/sentenceColors';
import { getCameraTestFixture } from '../camera/testFixture';
import type { CorrelatedSentence } from '../camera/ocrTypes';
import { useAuth } from '../features/auth/AuthProvider';
import { enqueueEligibleMedia } from '../services/mediaEnqueue';
import { requestInterstitialOpportunity } from '../features/ads/InterstitialController';
import { useRuntime } from '../runtime/RuntimeContext';
import {
  initialCameraPhase,
  isCameraBusy,
  reduceCameraPhase,
  type CameraPhaseEvent,
  type CameraPhaseState,
} from '../runtime/machines/cameraPhase';

type Props = {
  active: boolean;
  onGoHome?: () => void;
};

/** Result review. Dark brown field, sandy-gold card. */
const RESULT_NIGHT = {
  bg: '#1A1410',
  card: '#3C3214',
  text: '#F7F1EA',
  sand: '#E8D7A8',
  gold: '#E8A317',
  button: '#2A2418',
};

/** 1×1 placeholder so a test fixture can mount line highlights without a capture. */
const FIXTURE_PREVIEW =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function cameraErrorCopy(reason: string | null, lang: UiLang): string {
  switch (reason) {
    case 'capture_failed':
      return t('camera.error.capture', lang);
    case 'ocr_failed':
      return t('camera.error.ocr', lang);
    case 'translate_failed':
      return t('camera.error.translate', lang);
    case 'model_failed':
      return t('camera.error.model', lang);
    case 'no_text':
      return t('camera.error.noText', lang);
    case 'low_confidence':
      return t('camera.error.lowConfidence', lang);
    default:
      return t('camera.error.generic', lang);
  }
}

export function CameraScreen({ active, onGoHome }: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const runtime = useRuntime();
  const { status: authStatus, authConfigured, userId } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const granted = permission?.granted === true;
  const [phaseState, setPhaseState] = useState<CameraPhaseState>(() =>
    initialCameraPhase(false),
  );
  const [sentences, setSentences] = useState<CorrelatedSentence[]>([]);
  const [detectedLanguage, setDetectedLanguage] = useState<'en' | 'ne' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState<'ne-en' | 'en-ne'>('ne-en');
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const captureUriRef = useRef<string | null>(null);
  const requestGenRef = useRef(0);
  const [imageSize, setImageSize] = useState({ width: 800, height: 1200 });
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const progressRef = useRef(0);
  const grantProgress = useRef(0);
  const topsRef = useRef(resultSheetTops(0));
  const playedResultAnim = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const phase = phaseState.phase;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Capture chrome stays dark in both schemes; brand accents follow theme.
        root: { flex: 1, backgroundColor: '#1A1410' },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingTop: 4,
          paddingBottom: 4,
          backgroundColor: theme.colors.bg,
        },
        headerSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
        title: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
        direction: { color: theme.colors.text, fontWeight: '700' },
        center: { padding: 24, gap: 16 },
        body: { color: theme.colors.onPrimary, fontSize: 15, lineHeight: 22 },
        allow: {
          alignSelf: 'flex-start',
          backgroundColor: theme.colors.crimson,
          borderRadius: 12,
          paddingHorizontal: 16,
          minHeight: MIN_TOUCH,
          justifyContent: 'center',
        },
        allowText: { color: theme.colors.onPrimary, fontWeight: '700' },
        previewWrap: { flex: 1 },
        preview: { flex: 1 },
        shutter: {
          position: 'absolute',
          bottom: 24,
          alignSelf: 'center',
          backgroundColor: theme.colors.onPrimary,
          borderRadius: 24,
          paddingHorizontal: 18,
          minHeight: MIN_TOUCH,
          minWidth: MIN_TOUCH,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // Shutter plate is always light; keep dark ink for contrast in both schemes.
        shutterText: { fontWeight: '800', color: '#1A1410' },
        focusRing: {
          position: 'absolute',
          width: 56,
          height: 56,
          borderRadius: 4,
          borderWidth: 1.5,
          borderColor: '#F7F1EA',
        },
        retakeBtn: {
          minHeight: MIN_TOUCH,
          justifyContent: 'center',
          paddingHorizontal: 8,
        },
        result: { flex: 1, minHeight: 0 },
        photoStage: {
          flex: 1,
          minHeight: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1A1410',
        },
        photoFrame: { position: 'absolute' },
        overlay: { position: 'absolute', borderRadius: 8 },
        detectedPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: theme.colors.surface,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderWidth: 1,
          borderColor: theme.colors.divider,
        },
        detectedText: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
        headerNight: { backgroundColor: RESULT_NIGHT.bg },
        titleNight: { color: RESULT_NIGHT.text },
        directionNight: { color: RESULT_NIGHT.sand },
        resultSheet: {
          flex: 1,
          minHeight: 0,
          backgroundColor: RESULT_NIGHT.bg,
          position: 'relative',
        },
        photoClip: {
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: '#1A1410',
        },
        translationCard: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 8,
          backgroundColor: RESULT_NIGHT.card,
          borderRadius: 22,
          paddingTop: 4,
          overflow: 'hidden',
          paddingHorizontal: 12,
          gap: 8,
          borderWidth: 1,
          borderColor: '#5A4A28',
        },
        translationHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
        handleHit: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: RESULT_NIGHT.sand,
        },
        translationTitle: { color: RESULT_NIGHT.text, fontSize: 18, fontWeight: '700' },
        translationSubtitle: { color: RESULT_NIGHT.sand, fontSize: 13 },
        detectedCorner: {
          color: RESULT_NIGHT.sand,
          fontSize: 12,
          fontWeight: '700',
          textAlign: 'right',
          maxWidth: 120,
        },
        translationRow: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 14,
          paddingLeft: 10,
          paddingRight: 4,
          paddingVertical: 8,
          gap: 8,
        },
        lineIndex: {
          width: 18,
          color: RESULT_NIGHT.sand,
          fontSize: 12,
          fontWeight: '700',
        },
        colorDot: { width: 10, height: 10, borderRadius: 5 },
        translationText: {
          flex: 1,
          color: RESULT_NIGHT.text,
          fontSize: 15,
          lineHeight: 21,
          fontWeight: '600',
        },
        copyBtn: {
          width: MIN_TOUCH,
          height: MIN_TOUCH,
          alignItems: 'center',
          justifyContent: 'center',
        },
        copied: {
          textAlign: 'center',
          color: RESULT_NIGHT.gold,
          fontWeight: '800',
          fontSize: 13,
          marginBottom: 6,
        },
        actions: { flexDirection: 'row', gap: 8, paddingBottom: 8 },
        actionBtn: {
          flex: 1,
          minHeight: MIN_TOUCH,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: '#5A4A28',
          backgroundColor: RESULT_NIGHT.button,
        },
        actionPrimary: {
          backgroundColor: RESULT_NIGHT.text,
          borderColor: RESULT_NIGHT.text,
        },
        actionText: { color: RESULT_NIGHT.text, fontWeight: '700', fontSize: 14 },
        actionPrimaryText: { color: RESULT_NIGHT.bg, fontWeight: '700', fontSize: 14 },
        retake: {
          color: theme.colors.onPrimary,
          paddingVertical: 12,
          fontWeight: '700',
        },
      }),
    [theme],
  );

  const dispatch = (event: CameraPhaseEvent) => {
    setPhaseState((prev) => reduceCameraPhase(prev, event));
  };

  const bumpGeneration = () => {
    requestGenRef.current += 1;
  };

  useEffect(() => {
    captureUriRef.current = captureUri;
  }, [captureUri]);

  useEffect(() => {
    if (granted && phase === 'permission') {
      dispatch({ type: 'PERMISSION_GRANTED' });
    } else if (!granted && phase !== 'permission' && phase !== 'result') {
      dispatch({ type: 'PERMISSION_NEEDED' });
    }
  }, [granted, phase]);

  useEffect(() => {
    return () => {
      bumpGeneration();
      deleteCapture(captureUriRef.current, 'exit');
      captureUriRef.current = null;
      if (focusTimer.current) clearTimeout(focusTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    const id = sheetProgress.addListener(({ value }) => {
      progressRef.current = value;
    });
    return () => sheetProgress.removeListener(id);
  }, [sheetProgress]);

  useEffect(() => {
    if (phase !== 'result') {
      playedResultAnim.current = false;
      sheetProgress.setValue(0);
      setSheetOpen(false);
      return;
    }
    if (stageSize.height <= 0 || playedResultAnim.current) return;
    playedResultAnim.current = true;
    sheetProgress.setValue(0);
    setSheetOpen(true);
    Animated.timing(sheetProgress, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [phase, sheetProgress, stageSize.height]);

  const snapSheet = (open: boolean) => {
    setSheetOpen(open);
    Animated.spring(sheetProgress, {
      toValue: open ? 1 : 0,
      useNativeDriver: false,
      friction: 9,
      tension: 68,
    }).start();
  };
  const snapSheetRef = useRef(snapSheet);
  snapSheetRef.current = snapSheet;
  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        grantProgress.current = progressRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const { expanded, collapsed } = topsRef.current;
        const span = Math.max(1, collapsed - expanded);
        const next = grantProgress.current - gesture.dy / span;
        sheetProgress.setValue(Math.min(1, Math.max(0, next)));
      },
      onPanResponderRelease: (_, gesture) => {
        const tap = Math.abs(gesture.dy) < 10 && Math.abs(gesture.dx) < 10;
        if (tap) {
          if (progressRef.current < 0.5) snapSheetRef.current(true);
          return;
        }
        const open =
          gesture.vy < -0.4 || (gesture.vy < 0.4 && progressRef.current > 0.5);
        snapSheetRef.current(open);
      },
    }),
  ).current;

  useEffect(() => {
    if (!active) {
      bumpGeneration();
      runtime.translation.cancelAll();
      deleteCapture(captureUriRef.current, 'exit');
      captureUriRef.current = null;
      setCaptureUri(null);
      setPreviewUri(null);
      setSentences([]);
      setDetectedLanguage(null);
      setSelected(null);
      setPhaseState(initialCameraPhase(granted));
      return;
    }

    const fixture = getCameraTestFixture();
    if (!fixture) return;
    setImageSize({ width: fixture.width, height: fixture.height });
    setRotation(fixture.rotation ?? 0);
    setPreviewUri(FIXTURE_PREVIEW);
    const built = buildCorrelation(
      fixture,
      (text) => INSCRIPTION_TRANSLATIONS[text] ?? '',
    );
    if (!built.ok) {
      setDetectedLanguage(null);
      setPhaseState({
        phase: built.reason === 'empty' ? 'empty' : 'lowConfidence',
        reasonCode: built.reason === 'empty' ? 'no_text' : 'low_confidence',
      });
      return;
    }
    setDetectedLanguage(built.language);
    setSentences(built.sentences);
    setPhaseState({ phase: 'result', reasonCode: null });
  }, [active, granted, runtime.translation]);

  const onCapture = async () => {
    if (isCameraBusy(phase) || phase === 'result') return;
    const gen = ++requestGenRef.current;
    dispatch({ type: 'CAPTURE' });
    let uri: string | null = null;
    const abandon = () => {
      deleteCapture(uri, 'exit');
      if (uri && captureUriRef.current === uri) {
        captureUriRef.current = null;
        setCaptureUri(null);
      }
    };
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (gen !== requestGenRef.current) {
        deleteCapture(photo?.uri ?? null, 'exit');
        return;
      }
      uri = photo?.uri ?? null;
    } catch {
      uri = null;
    }
    if (gen !== requestGenRef.current) {
      abandon();
      return;
    }
    if (!uri) {
      dispatch({ type: 'FAIL', reasonCode: 'capture_failed' });
      return;
    }
    // Show the still before any text recognition. OCR runs only on this photo.
    dispatch({ type: 'CAPTURED' });
    setCaptureUri(uri);
    captureUriRef.current = uri;
    setPreviewUri(uri);
    const previewTask = readCapturePreviewUri(uri);
    dispatch({ type: 'RECOGNIZE_STARTED' });
    try {
      const doc = await runtime.ocr.recognize(uri);
      if (gen !== requestGenRef.current) {
        abandon();
        return;
      }
      const preview = await previewTask;
      if (gen !== requestGenRef.current) {
        abandon();
        return;
      }
      if (preview) setPreviewUri(preview);
      setImageSize({ width: doc.width, height: doc.height });
      setRotation(doc.rotation ?? 0);

      const built = buildCorrelation(doc, () => '');
      if (!built.ok) {
        setDetectedLanguage(null);
        deleteCapture(uri, 'processed');
        captureUriRef.current = null;
        setCaptureUri(null);
        // Keep preview on recoverable empty / low-confidence so the user can retake.
        dispatch(
          built.reason === 'empty'
            ? { type: 'RECOGNIZE_EMPTY' }
            : { type: 'RECOGNIZE_LOW_CONFIDENCE' },
        );
        return;
      }

      dispatch({ type: 'TRANSLATE_STARTED' });
      const translated: CorrelatedSentence[] = [];
      for (const sentence of built.sentences) {
        if (gen !== requestGenRef.current) {
          abandon();
          return;
        }
        try {
          const result = await runtime.translation.translate({
            text: sentence.text,
            preferred: direction,
            formality: 'formal',
            script: 'deva',
            forcePreferred: true,
          });
          if (gen !== requestGenRef.current) {
            abandon();
            return;
          }
          let translation = (result.text ?? '').trim();
          if (!translation) {
            try {
              const { translateCapturedLine } = await import('../camera/translateCapture');
              translation = (
                await translateCapturedLine(sentence.text, direction)
              ).trim();
            } catch {
              translation = '';
            }
          }
          translated.push({
            ...sentence,
            translation,
          });
        } catch (err) {
          if (gen !== requestGenRef.current) {
            abandon();
            return;
          }
          const message = err instanceof Error ? err.message : String(err);
          const reason =
            /model|onnx|neural|not ready/i.test(message)
              ? 'model_failed'
              : 'translate_failed';
          // Preserve preview on recoverable translate failure.
          deleteCapture(uri, 'processed');
          captureUriRef.current = null;
          setCaptureUri(null);
          dispatch({ type: 'FAIL', reasonCode: reason });
          return;
        }
      }
      if (gen !== requestGenRef.current) {
        abandon();
        return;
      }
      setDetectedLanguage(built.language);
      setSentences(translated);
      // Consented adults: durable-copy for outbox before temp delete (never await flush).
      await enqueueEligibleMedia({
        kind: 'photo',
        sourceUri: uri,
        signedIn: authStatus === 'signed-in',
        authConfigured,
        userId,
        metadata: { surface: 'camera', sentence_count: translated.length },
      });
      deleteCapture(uri, 'processed');
      captureUriRef.current = null;
      setCaptureUri(null);
      // Keep previewUri for the result photo until retake/exit.
      dispatch({ type: 'RESULT' });
      requestInterstitialOpportunity({
        transition: 'camera_capture_committed',
        surface: 'translate_idle',
        cameraActive: true,
      });
    } catch {
      if (gen !== requestGenRef.current) {
        abandon();
        return;
      }
      deleteCapture(uri, 'processed');
      captureUriRef.current = null;
      setCaptureUri(null);
      // Preserve preview on recoverable OCR failure.
      dispatch({ type: 'FAIL', reasonCode: 'ocr_failed' });
    }
  };

  const onRetake = () => {
    bumpGeneration();
    runtime.translation.cancelAll();
    deleteCapture(captureUriRef.current, 'retake');
    captureUriRef.current = null;
    setCaptureUri(null);
    setPreviewUri(null);
    setSentences([]);
    setDetectedLanguage(null);
    setSelected(null);
    dispatch({ type: 'RETAKE' });
    if (!granted) {
      setPhaseState({ phase: 'permission', reasonCode: null });
    }
  };

  const onDone = () => {
    if (onGoHome) onGoHome();
    else onRetake();
  };

  const copyText = (value: string, id: string) => {
    const text = value.trim();
    if (!text) return;
    void Clipboard.setStringAsync(text).then(() => {
      setCopiedId(id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 1600);
    });
  };

  const copyAllTranslations = () => {
    copyText(
      sentences
        .map((sentence) => sentence.translation.trim())
        .filter(Boolean)
        .join('\n'),
      'all',
    );
  };

  if (!active) return null;

  const sourceLanguageName =
    detectedLanguage === 'ne' ? t('camera.languageNe', lang) : t('camera.languageEn', lang);
  const targetLanguageName =
    direction === 'en-ne' ? t('camera.languageNe', lang) : t('camera.languageEn', lang);
  const tops = resultSheetTops(stageSize.height);
  topsRef.current = tops;
  const raisedPhoto = photoAboveSheet(imageSize, rotation, stageSize, tops.expanded);
  const loweredPhoto = photoAboveSheet(imageSize, rotation, stageSize, tops.collapsed);
  const photoMotion = {
    top: sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [loweredPhoto.top, raisedPhoto.top],
    }),
    left: sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [loweredPhoto.left, raisedPhoto.left],
    }),
    width: sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [loweredPhoto.width, raisedPhoto.width],
    }),
    height: sheetProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [loweredPhoto.height, raisedPhoto.height],
    }),
  };
  const sheetTop = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [tops.collapsed, tops.expanded],
  });

  const showResult = phase === 'result';
  const showError =
    phase === 'empty' || phase === 'lowConfidence' || phase === 'error'
      ? cameraErrorCopy(phaseState.reasonCode, lang)
      : null;

  const shutterLabel =
    phase === 'recognizing'
      ? t('camera.reading', lang)
      : phase === 'translating'
        ? t('camera.translating', lang)
        : t('camera.capture', lang);

  const onFocusTap = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    const point = focusPointFromTap(locationX, locationY, previewSize.width, previewSize.height);
    if (!point) return;
    setFocusRing({ x: locationX, y: locationY });
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocusRing(null), 800);
    const camera = cameraRef.current;
    if (camera && typeof camera.focusAt === 'function') {
      void camera.focusAt(point).catch(() => undefined);
    }
  };

  return (
    <View style={styles.root} testID="camera-screen">
      <View style={[styles.header, showResult && styles.headerNight]}>
        <BackArrow
          onPress={onGoHome}
          accessibilityLabel={t('common.backHome', lang)}
          testID="back-home"
          color={showResult ? RESULT_NIGHT.text : undefined}
        />
        <View style={styles.headerCenter}>
        <Text style={[styles.title, showResult && styles.titleNight]}>{t('camera.title', lang)}</Text>
        <Pressable
          onPress={() => setDirection((d) => (d === 'ne-en' ? 'en-ne' : 'ne-en'))}
          accessibilityRole="button"
          accessibilityLabel={t('camera.directionA11y', lang)}
          testID="camera-direction"
        >
          <Text style={[styles.direction, showResult && styles.directionNight]}>
            {direction === 'ne-en'
              ? t('camera.directionNeEn', lang)
              : t('camera.directionEnNe', lang)}
          </Text>
        </Pressable>
        </View>
        <View style={styles.headerSide} />
      </View>

      {!granted && !showResult ? (
        <View style={styles.center} testID="camera-permission">
          <Text style={styles.body}>{t('camera.privacyNote', lang)}</Text>
          <Pressable
            onPress={() => void requestPermission()}
            style={styles.allow}
            testID="camera-allow"
            accessibilityRole="button"
            accessibilityLabel={t('camera.allow', lang)}
          >
            <Text style={styles.allowText}>{t('camera.allow', lang)}</Text>
          </Pressable>
        </View>
      ) : null}

      {granted &&
      !previewUri &&
      !showResult &&
      phase !== 'empty' &&
      phase !== 'lowConfidence' &&
      phase !== 'error' ? (
        <View
          style={styles.previewWrap}
          testID="camera-live"
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewSize({ width, height });
          }}
        >
          <CameraView ref={cameraRef} style={styles.preview} facing="back" active={active} />
          <Pressable
            style={StyleSheet.absoluteFill}
            testID="camera-focus"
            accessibilityRole="button"
            accessibilityLabel={t('camera.focusA11y', lang)}
            onPress={onFocusTap}
          />
          {focusRing ? (
            <View
              pointerEvents="none"
              testID="camera-focus-ring"
              style={[styles.focusRing, { left: focusRing.x - 28, top: focusRing.y - 28 }]}
            />
          ) : null}
          <Pressable
            style={styles.shutter}
            testID="camera-shutter"
            disabled={isCameraBusy(phase)}
            onPress={() => void onCapture()}
            accessibilityRole="button"
            accessibilityLabel={t('camera.captureA11y', lang)}
          >
            <Text style={styles.shutterText}>{shutterLabel}</Text>
          </Pressable>
        </View>
      ) : null}

      {previewUri && !showResult ? (
        <View style={styles.result} testID={showError ? 'camera-error' : 'camera-still'}>
          <View style={styles.photoStage}>
            <Image
              testID={showError ? 'camera-error-preview' : 'camera-still-image'}
              source={{ uri: previewUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          {showError ? null : (
            <Text style={styles.body} testID="camera-reading">
              {shutterLabel}
            </Text>
          )}
        </View>
      ) : null}

      {showError ? (
        <View style={styles.center} testID={previewUri ? undefined : 'camera-error'}>
          <Text
            style={styles.body}
            testID={
              phase === 'lowConfidence'
                ? 'camera-low-confidence'
                : phase === 'error'
                  ? 'camera-error-message'
                  : 'camera-empty'
            }
          >
            {showError}
          </Text>
          <Pressable
            testID="camera-retake"
            style={styles.retakeBtn}
            onPress={onRetake}
            accessibilityRole="button"
            accessibilityLabel={t('camera.retakeA11y', lang)}
          >
            <Text style={styles.retake}>{t('camera.retake', lang)}</Text>
          </Pressable>
        </View>
      ) : null}

      {showResult ? (
        <View
          style={styles.resultSheet}
          testID="camera-result"
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setStageSize({ width, height });
          }}
        >
          {previewUri ? (
            <Animated.View
              style={[styles.photoFrame, styles.photoClip, photoMotion]}
              testID="camera-photo"
            >
              <Image
                testID="camera-photo-image"
                source={{ uri: previewUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              {sentences.map((sentence, sentenceIndex) =>
                sentence.frames.map((frame, lineIndex) => {
                  const box = highlightPercents(frame, imageSize, rotation);
                  if (!box) return null;
                  return (
                    <Pressable
                      key={`${sentence.id}-${lineIndex}`}
                      testID={
                        lineIndex === 0
                          ? `camera-overlay-${sentence.id}`
                          : `camera-overlay-${sentence.id}-${lineIndex}`
                      }
                      accessibilityLabel={t('camera.sentenceSourceA11y', lang, {
                        n: sentenceIndex + 1,
                      })}
                      onPress={() => setSelected(sentence.id)}
                      style={[
                        styles.overlay,
                        box,
                        {
                          backgroundColor: withAlpha(
                            sentence.color,
                            selected === sentence.id ? 0.55 : 0.38,
                          ),
                        },
                      ]}
                    />
                  );
                }),
              )}
            </Animated.View>
          ) : null}
          <Animated.View
            testID="camera-drawer"
            accessibilityState={{ expanded: sheetOpen }}
            style={[styles.translationCard, { top: sheetTop }]}
          >
            <View
              testID="camera-drawer-handle"
              accessibilityRole="button"
              accessibilityLabel={
                sheetOpen ? t('camera.sheetLower', lang) : t('camera.sheetShow', lang)
              }
              {...sheetPan.panHandlers}
            >
              <View style={styles.handleHit}>
                <View style={styles.handle} />
              </View>
              <View style={styles.translationHead}>
              <Ionicons name="sparkles" size={18} color={RESULT_NIGHT.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.translationTitle}>{t('camera.translation', lang)}</Text>
                <Text style={styles.translationSubtitle}>
                  {t('camera.translatedTo', lang, { language: targetLanguageName })}
                </Text>
              </View>
              {detectedLanguage ? (
                <Text style={styles.detectedCorner} testID="camera-detected">
                  {t('camera.detected', lang, { language: sourceLanguageName })}
                </Text>
              ) : null}
            </View>
            </View>
            <ScrollView
              style={{ flexGrow: 1, flexShrink: 1, minHeight: 0 }}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
            >
              {sentences.map((sentence, index) => (
                <View
                  key={sentence.id}
                  style={[
                    styles.translationRow,
                    {
                      backgroundColor: withAlpha(sentence.color, 0.34),
                      borderWidth: selected === sentence.id ? 2 : 0,
                      borderColor: sentence.color,
                    },
                  ]}
                >
                  <Pressable
                    testID={`camera-row-${sentence.id}`}
                    accessibilityLabel={t('camera.sentenceTranslationA11y', lang, {
                      n: index + 1,
                    })}
                    onPress={() => setSelected(sentence.id)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <Text style={styles.lineIndex}>{index + 1}</Text>
                    <View style={[styles.colorDot, { backgroundColor: sentence.color }]} />
                    <Text style={styles.translationText}>{sentence.translation}</Text>
                  </Pressable>
                  <Pressable
                    testID={`camera-copy-${sentence.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      copiedId === sentence.id
                        ? t('camera.copied', lang)
                        : t('camera.copyLine', lang)
                    }
                    onPress={() => copyText(sentence.translation, sentence.id)}
                    style={styles.copyBtn}
                  >
                    <Ionicons
                      name={copiedId === sentence.id ? 'checkmark' : 'copy-outline'}
                      size={18}
                      color={copiedId === sentence.id ? RESULT_NIGHT.gold : RESULT_NIGHT.sand}
                    />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            {copiedId ? (
              <Text
                style={styles.copied}
                testID="camera-copied"
                accessibilityLiveRegion="polite"
              >
                {t('camera.copied', lang)}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                testID="camera-retake"
                style={styles.actionBtn}
                onPress={onRetake}
                accessibilityRole="button"
                accessibilityLabel={t('camera.retakeA11y', lang)}
              >
                <Text style={styles.actionText}>{t('camera.retake', lang)}</Text>
              </Pressable>
              <Pressable
                testID="camera-copy-text"
                style={styles.actionBtn}
                onPress={copyAllTranslations}
                accessibilityRole="button"
                accessibilityLabel={
                  copiedId === 'all' ? t('camera.copied', lang) : t('camera.copyText', lang)
                }
              >
                <Text style={styles.actionText}>
                  {copiedId === 'all' ? t('camera.copied', lang) : t('camera.copyText', lang)}
                </Text>
              </Pressable>
              <Pressable
                testID="camera-done"
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={onDone}
                accessibilityRole="button"
                accessibilityLabel={t('camera.doneA11y', lang)}
              >
                <Text style={styles.actionPrimaryText}>{t('camera.done', lang)}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}
