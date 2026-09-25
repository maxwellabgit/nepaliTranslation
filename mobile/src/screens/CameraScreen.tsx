import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { t, useUiLang, type UiLang } from '../i18n';
import { MIN_TOUCH } from '../layout/sizeClass';
import { useTheme } from '../theme';
import { buildCorrelation, previewText } from '../camera/correlate';
import { deleteCapture } from '../camera/deleteCapture';
import { INSCRIPTION_TRANSLATIONS } from '../camera/inscriptionFixture';
import { mapSentenceFramesToView } from '../camera/overlayGeometry';
import { readCapturePreviewUri } from '../camera/readCapturePreview';
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
};

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

export function CameraScreen({ active }: Props) {
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
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [direction, setDirection] = useState<'ne-en' | 'en-ne'>('ne-en');
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const captureUriRef = useRef<string | null>(null);
  const requestGenRef = useRef(0);
  const [imageSize, setImageSize] = useState({ width: 800, height: 1200 });
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [viewSize, setViewSize] = useState({ width: 1, height: 1 });

  const phase = phaseState.phase;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Capture chrome stays dark in both schemes; brand accents follow theme.
        root: { flex: 1, backgroundColor: '#1A1410' },
        header: { padding: 16, alignItems: 'center', gap: 8 },
        title: { color: theme.colors.onPrimary, fontSize: 18, fontWeight: '700' },
        direction: { color: theme.colors.onPrimary, fontWeight: '700' },
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
        retakeBtn: {
          minHeight: MIN_TOUCH,
          justifyContent: 'center',
          paddingHorizontal: 8,
        },
        errorPreview: { width: '100%', height: 180, backgroundColor: '#2A2420' },
        result: { flex: 1 },
        photo: { flex: 1, backgroundColor: '#2A2420' },
        overlay: {
          position: 'absolute',
          borderRadius: 4,
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: 2,
        },
        overlayIndex: {
          color: theme.colors.onPrimary,
          fontWeight: '800',
          fontSize: 12,
          textShadowColor: 'rgba(0,0,0,0.6)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        found: {
          position: 'absolute',
          right: 12,
          bottom: 12,
          color: theme.colors.onPrimary,
        },
        drawer: {
          backgroundColor: '#2C2622',
          padding: 16,
          gap: 10,
        },
        drawerTitle: { color: theme.colors.onPrimary, fontWeight: '700' },
        row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
        rowIndex: {
          color: theme.colors.onPrimary,
          fontWeight: '800',
          minWidth: 16,
        },
        swatch: { width: 12, height: 12, borderRadius: 2 },
        rowText: { color: theme.colors.onPrimary, flex: 1 },
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
    };
  }, []);

  useEffect(() => {
    if (!active) {
      bumpGeneration();
      runtime.translation.cancelAll();
      deleteCapture(captureUriRef.current, 'exit');
      captureUriRef.current = null;
      setCaptureUri(null);
      setPreviewUri(null);
      setSentences([]);
      setSelected(null);
      setDrawerOpen(false);
      setPhaseState(initialCameraPhase(granted));
      return;
    }

    const fixture = getCameraTestFixture();
    if (!fixture) return;
    setImageSize({ width: fixture.width, height: fixture.height });
    setRotation(fixture.rotation ?? 0);
    const built = buildCorrelation(
      fixture,
      (text) => INSCRIPTION_TRANSLATIONS[text] ?? '',
    );
    if (!built.ok) {
      setPhaseState({
        phase: built.reason === 'empty' ? 'empty' : 'lowConfidence',
        reasonCode: built.reason === 'empty' ? 'no_text' : 'low_confidence',
      });
      return;
    }
    setSentences(built.sentences);
    setDrawerOpen(false);
    setPhaseState({ phase: 'result', reasonCode: null });
  }, [active, granted, runtime.translation]);

  const onCapture = async () => {
    if (isCameraBusy(phase) || phase === 'result') return;
    const gen = ++requestGenRef.current;
    dispatch({ type: 'CAPTURE' });
    let uri: string | null = null;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (gen !== requestGenRef.current) return;
      uri = photo?.uri ?? null;
    } catch {
      uri = null;
    }
    if (gen !== requestGenRef.current) return;
    if (!uri) {
      dispatch({ type: 'FAIL', reasonCode: 'capture_failed' });
      return;
    }
    dispatch({ type: 'CAPTURED' });
    setCaptureUri(uri);
    captureUriRef.current = uri;
    const preview = await readCapturePreviewUri(uri);
    if (gen !== requestGenRef.current) return;
    setPreviewUri(preview);
    dispatch({ type: 'RECOGNIZE_STARTED' });
    try {
      const doc = await runtime.ocr.recognize(uri);
      if (gen !== requestGenRef.current) return;
      setImageSize({ width: doc.width, height: doc.height });
      setRotation(doc.rotation ?? 0);

      const built = buildCorrelation(doc, () => '');
      if (!built.ok) {
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
        if (gen !== requestGenRef.current) return;
        try {
          const result = await runtime.translation.translate({
            text: sentence.text,
            preferred: direction,
            formality: 'formal',
            script: 'deva',
            forcePreferred: true,
          });
          if (gen !== requestGenRef.current) return;
          translated.push({
            ...sentence,
            translation: result.text ?? '',
          });
        } catch (err) {
          if (gen !== requestGenRef.current) return;
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
      if (gen !== requestGenRef.current) return;
      setSentences(translated);
      setDrawerOpen(false);
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
      if (gen !== requestGenRef.current) return;
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
    setSelected(null);
    setDrawerOpen(false);
    dispatch({ type: 'RETAKE' });
    if (!granted) {
      setPhaseState({ phase: 'permission', reasonCode: null });
    }
  };

  if (!active) return null;

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

  return (
    <View style={styles.root} testID="camera-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t('camera.title', lang)}</Text>
        <Pressable
          onPress={() => setDirection((d) => (d === 'ne-en' ? 'en-ne' : 'ne-en'))}
          accessibilityRole="button"
          accessibilityLabel={t('camera.directionA11y', lang)}
          testID="camera-direction"
        >
          <Text style={styles.direction}>
            {direction === 'ne-en'
              ? t('camera.directionNeEn', lang)
              : t('camera.directionEnNe', lang)}
          </Text>
        </Pressable>
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
      !showResult &&
      phase !== 'empty' &&
      phase !== 'lowConfidence' &&
      phase !== 'error' ? (
        <View style={styles.previewWrap} testID="camera-live">
          <CameraView ref={cameraRef} style={styles.preview} facing="back" active={active} />
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

      {showError ? (
        <View style={styles.center} testID="camera-error">
          {previewUri ? (
            <Image
              testID="camera-error-preview"
              source={{ uri: previewUri }}
              style={styles.errorPreview}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
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
        <View style={styles.result} testID="camera-result">
          <View
            style={styles.photo}
            testID="camera-photo"
            onLayout={(e) =>
              setViewSize({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              })
            }
          >
            {previewUri ? (
              <Image
                testID="camera-photo-image"
                source={{ uri: previewUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            ) : null}
            {sentences.map((sentence, index) => {
              const sentenceIndex = index + 1;
              const mapped = mapSentenceFramesToView(
                sentence.frames,
                imageSize,
                rotation,
                viewSize,
              );
              if (!mapped) return null;
              return (
                <Pressable
                  key={sentence.id}
                  testID={`camera-overlay-${sentence.id}`}
                  accessibilityLabel={t('camera.sentenceSourceA11y', lang, {
                    n: sentenceIndex,
                  })}
                  onPress={() => setSelected(sentence.id)}
                  style={[
                    styles.overlay,
                    {
                      left: mapped.x,
                      top: mapped.y,
                      width: Math.max(mapped.width, 8),
                      height: Math.max(mapped.height, 8),
                      backgroundColor: sentence.color,
                      opacity: selected === sentence.id ? 0.55 : 0.35,
                    },
                  ]}
                >
                  <Text style={styles.overlayIndex}>{sentenceIndex}</Text>
                </Pressable>
              );
            })}
            <Text style={styles.found}>
              {t('camera.passagesFound', lang, { count: sentences.length })}
            </Text>
          </View>
          <View
            testID="camera-drawer"
            accessibilityState={{ expanded: drawerOpen }}
            style={styles.drawer}
          >
            <Pressable onPress={() => setDrawerOpen((open) => !open)}>
              <Text style={styles.drawerTitle}>{t('camera.translation', lang)}</Text>
            </Pressable>
            {sentences.map((sentence, index) => {
              const sentenceIndex = index + 1;
              return (
                <Pressable
                  key={sentence.id}
                  testID={`camera-row-${sentence.id}`}
                  accessibilityLabel={t('camera.sentenceTranslationA11y', lang, {
                    n: sentenceIndex,
                  })}
                  onPress={() => setSelected(sentence.id)}
                  style={styles.row}
                >
                  <Text style={styles.rowIndex}>{sentenceIndex}</Text>
                  <View style={[styles.swatch, { backgroundColor: sentence.color }]} />
                  <Text style={styles.rowText}>
                    {drawerOpen ? sentence.translation : previewText(sentence.translation)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
    </View>
  );
}
