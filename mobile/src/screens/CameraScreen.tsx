import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { t, useUiLang, type UiLang } from '../i18n';
import { MIN_TOUCH } from '../layout/sizeClass';
import { useTheme } from '../theme';
import { BackArrow } from '../components/BackArrow';
import { buildCorrelation } from '../camera/correlate';
import { deleteCapture } from '../camera/deleteCapture';
import { INSCRIPTION_TRANSLATIONS } from '../camera/inscriptionFixture';
import { orientedImageSize, rotateFrame } from '../camera/overlayGeometry';
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
  onGoHome?: () => void;
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
        photoFrame: { alignSelf: 'center' },
        overlay: { position: 'absolute', borderRadius: 3 },
        translations: {
          maxHeight: '46%',
          backgroundColor: '#2C2622',
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 4,
          gap: 8,
        },
        translationRow: {
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        translationText: {
          color: '#1A1410',
          fontSize: 16,
          lineHeight: 22,
          fontWeight: '700',
        },
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
    setPhaseState({ phase: 'result', reasonCode: null });
  }, [active, granted, runtime.translation]);

  const onCapture = async () => {
    if (isCameraBusy(phase) || phase === 'result') return;
    const gen = ++requestGenRef.current;
    dispatch({ type: 'CAPTURE' });
    let uri: string | null = null;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
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
    // Show the still before any text recognition. OCR runs only on this photo.
    dispatch({ type: 'CAPTURED' });
    setCaptureUri(uri);
    captureUriRef.current = uri;
    setPreviewUri(uri);
    const previewTask = readCapturePreviewUri(uri);
    dispatch({ type: 'RECOGNIZE_STARTED' });
    try {
      const doc = await runtime.ocr.recognize(uri);
      if (gen !== requestGenRef.current) return;
      const preview = await previewTask;
      if (gen !== requestGenRef.current) return;
      if (preview) setPreviewUri(preview);
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
        <BackArrow
          onPress={onGoHome}
          accessibilityLabel={t('common.backHome', lang)}
          testID="back-home"
        />
        <View style={styles.headerCenter}>
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
        <View style={styles.result} testID="camera-result">
          <View
            style={styles.photoStage}
            testID="camera-photo"
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setStageSize({ width, height });
            }}
          >
            {previewUri ? (
              <View
                style={[
                  styles.photoFrame,
                  (() => {
                    const oriented = orientedImageSize(imageSize, rotation);
                    const scale = Math.min(
                      stageSize.width / Math.max(1, oriented.width),
                      stageSize.height / Math.max(1, oriented.height),
                    );
                    return {
                      width: oriented.width * scale,
                      height: oriented.height * scale,
                    };
                  })(),
                ]}
              >
                <Image
                  testID="camera-photo-image"
                  source={{ uri: previewUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="stretch"
                  accessibilityIgnoresInvertColors
                />
                {sentences.map((sentence) => {
                  const oriented = orientedImageSize(imageSize, rotation);
                  return sentence.frames.map((frame, lineIndex) => {
                    const mapped = rotateFrame(frame, imageSize, rotation);
                    return (
                      <Pressable
                        key={`${sentence.id}-${lineIndex}`}
                        testID={
                          lineIndex === 0
                            ? `camera-overlay-${sentence.id}`
                            : `camera-overlay-${sentence.id}-${lineIndex}`
                        }
                        accessibilityLabel={t('camera.sentenceSourceA11y', lang, {
                          n: lineIndex + 1,
                        })}
                        onPress={() => setSelected(sentence.id)}
                        style={[
                          styles.overlay,
                          {
                            left: `${(mapped.x / oriented.width) * 100}%`,
                            top: `${(mapped.y / oriented.height) * 100}%`,
                            width: `${(mapped.width / oriented.width) * 100}%`,
                            height: `${(mapped.height / oriented.height) * 100}%`,
                            backgroundColor: sentence.color,
                            opacity: selected === sentence.id ? 0.55 : 0.35,
                          },
                        ]}
                      />
                    );
                  });
                })}
              </View>
            ) : null}
          </View>
          <ScrollView
            testID="camera-drawer"
            style={styles.translations}
            contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          >
            {sentences.map((sentence) => (
              <Pressable
                key={sentence.id}
                testID={`camera-row-${sentence.id}`}
                accessibilityLabel={sentence.translation}
                onPress={() => setSelected(sentence.id)}
                style={[styles.translationRow, { backgroundColor: sentence.color }]}
              >
                <Text style={styles.translationText}>{sentence.translation}</Text>
              </Pressable>
            ))}
          </ScrollView>
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
