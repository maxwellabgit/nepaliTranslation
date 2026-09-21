import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../theme';
import { buildCorrelation, previewText } from '../camera/correlate';
import { deleteCapture } from '../camera/deleteCapture';
import { INSCRIPTION_TRANSLATIONS } from '../camera/inscriptionFixture';
import { mapSentenceFramesToView } from '../camera/overlayGeometry';
import { readCapturePreviewUri } from '../camera/readCapturePreview';
import { getCameraTestFixture } from '../camera/testFixture';
import type { CorrelatedSentence } from '../camera/ocrTypes';
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

export function CameraScreen({ active }: Props) {
  const runtime = useRuntime();
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
  const [imageSize, setImageSize] = useState({ width: 800, height: 1200 });
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [viewSize, setViewSize] = useState({ width: 1, height: 1 });

  const phase = phaseState.phase;

  const dispatch = (event: CameraPhaseEvent) => {
    setPhaseState((prev) => reduceCameraPhase(prev, event));
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
      deleteCapture(captureUriRef.current, 'exit');
      captureUriRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!active) {
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
  }, [active, granted]);

  const onCapture = async () => {
    if (isCameraBusy(phase) || phase === 'result') return;
    dispatch({ type: 'CAPTURE' });
    let uri: string | null = null;
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      uri = photo?.uri ?? null;
    } catch {
      uri = null;
    }
    if (!uri) {
      dispatch({ type: 'FAIL', reasonCode: 'capture_failed' });
      return;
    }
    dispatch({ type: 'CAPTURED' });
    setCaptureUri(uri);
    captureUriRef.current = uri;
    const preview = await readCapturePreviewUri(uri);
    setPreviewUri(preview);
    dispatch({ type: 'RECOGNIZE_STARTED' });
    try {
      const doc = await runtime.ocr.recognize(uri);
      setImageSize({ width: doc.width, height: doc.height });
      setRotation(doc.rotation ?? 0);

      const built = buildCorrelation(doc, () => '');
      if (!built.ok) {
        deleteCapture(uri, 'processed');
        captureUriRef.current = null;
        setCaptureUri(null);
        setPreviewUri(null);
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
        const result = await runtime.translation.translate({
          text: sentence.text,
          preferred: direction,
          formality: 'formal',
          script: 'deva',
          forcePreferred: true,
        });
        translated.push({
          ...sentence,
          translation: result.text ?? '',
        });
      }
      setSentences(translated);
      setDrawerOpen(false);
      deleteCapture(uri, 'processed');
      captureUriRef.current = null;
      setCaptureUri(null);
      // Keep previewUri for the result photo until retake/exit.
      dispatch({ type: 'RESULT' });
    } catch {
      deleteCapture(uri, 'processed');
      captureUriRef.current = null;
      setCaptureUri(null);
      setPreviewUri(null);
      dispatch({ type: 'FAIL', reasonCode: 'ocr_failed' });
    }
  };

  const onRetake = () => {
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

  return (
    <View style={styles.root} testID="camera-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Camera</Text>
        <Pressable
          onPress={() => setDirection((d) => (d === 'ne-en' ? 'en-ne' : 'ne-en'))}
          accessibilityRole="button"
          accessibilityLabel="Translation direction"
          testID="camera-direction"
        >
          <Text style={styles.direction}>
            {direction === 'ne-en' ? 'Nepali → English' : 'English → Nepali'}
          </Text>
        </Pressable>
      </View>

      {!granted && !showResult ? (
        <View style={styles.center} testID="camera-permission">
          <Text style={styles.body}>
            Camera access stays on this phone. Photos are deleted after you retake, leave, or finish.
          </Text>
          <Pressable
            onPress={() => void requestPermission()}
            style={styles.allow}
            testID="camera-allow"
          >
            <Text style={styles.allowText}>Allow camera</Text>
          </Pressable>
        </View>
      ) : null}

      {granted && !showResult ? (
        <View style={styles.previewWrap} testID="camera-live">
          <CameraView ref={cameraRef} style={styles.preview} facing="back" active={active} />
          <Pressable
            style={styles.shutter}
            testID="camera-shutter"
            disabled={isCameraBusy(phase)}
            onPress={() => void onCapture()}
          >
            <Text style={styles.shutterText}>Capture</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === 'empty' ? (
        <Text style={styles.body} testID="camera-empty">
          No text found. Try again closer to the writing.
        </Text>
      ) : null}
      {phase === 'lowConfidence' ? (
        <Text style={styles.body} testID="camera-low-confidence">
          The text was too unclear to translate.
        </Text>
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
                  accessibilityLabel={`Sentence ${sentenceIndex} source`}
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
            <Text style={styles.found}>{sentences.length} passages found</Text>
          </View>
          <View
            testID="camera-drawer"
            accessibilityState={{ expanded: drawerOpen }}
            style={styles.drawer}
          >
            <Pressable onPress={() => setDrawerOpen((open) => !open)}>
              <Text style={styles.drawerTitle}>Translation</Text>
            </Pressable>
            {sentences.map((sentence, index) => {
              const sentenceIndex = index + 1;
              return (
                <Pressable
                  key={sentence.id}
                  testID={`camera-row-${sentence.id}`}
                  accessibilityLabel={`Sentence ${sentenceIndex} translation`}
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
          <Pressable testID="camera-retake" onPress={onRetake}>
            <Text style={styles.retake}>Retake</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1410' },
  header: { padding: 16, alignItems: 'center', gap: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  direction: { color: '#fff', fontWeight: '700' },
  center: { padding: 24, gap: 16 },
  body: { color: '#fff', fontSize: 15, lineHeight: 22 },
  allow: {
    alignSelf: 'flex-start',
    backgroundColor: colors.crimson,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  allowText: { color: '#fff', fontWeight: '700' },
  previewWrap: { flex: 1 },
  preview: { flex: 1 },
  shutter: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  shutterText: { fontWeight: '800', color: colors.text },
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
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  found: { position: 'absolute', right: 12, bottom: 12, color: '#fff' },
  drawer: {
    backgroundColor: '#2C2622',
    padding: 16,
    gap: 10,
  },
  drawerTitle: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rowIndex: { color: '#fff', fontWeight: '800', minWidth: 16 },
  swatch: { width: 12, height: 12, borderRadius: 2 },
  rowText: { color: '#fff', flex: 1 },
  retake: { color: '#fff', padding: 16, fontWeight: '700' },
});
