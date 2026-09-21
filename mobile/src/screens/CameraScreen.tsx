import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { sharedTranslationEngine } from '../mt/TranslationEngine';
import { colors } from '../theme';
import { buildCorrelation, previewText } from '../camera/correlate';
import { deleteCapture } from '../camera/deleteCapture';
import { INSCRIPTION_TRANSLATIONS } from '../camera/inscriptionFixture';
import { mapFrameToView } from '../camera/overlayGeometry';
import { getCameraTestFixture } from '../camera/testFixture';
import type { CorrelatedSentence } from '../camera/ocrTypes';

type Props = {
  active: boolean;
};

type Phase =
  | 'permission'
  | 'live'
  | 'captured'
  | 'recognizing'
  | 'translating'
  | 'result'
  | 'empty'
  | 'low-confidence';

export function CameraScreen({ active }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('permission');
  const [sentences, setSentences] = useState<CorrelatedSentence[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [direction, setDirection] = useState<'ne-en' | 'en-ne'>('ne-en');
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [imageSize, setImageSize] = useState({ width: 800, height: 1200 });
  const [viewSize, setViewSize] = useState({ width: 1, height: 1 });

  const onCapture = async () => {
    setPhase('captured');
    let uri: string | null = null;
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      uri = photo?.uri ?? null;
    } catch {
      uri = null;
    }
    if (!uri) {
      setPhase('empty');
      return;
    }
    setCaptureUri(uri);
    setPhase('recognizing');
    try {
      const ocr = (await import('neptranslate-ocr')) as {
        recognizeText: (
          path: string,
        ) => Promise<import('../camera/ocrTypes').OcrDocument>;
      };
      const doc = await ocr.recognizeText(uri);
      setImageSize({ width: doc.width, height: doc.height });
      setPhase('translating');
      const built = buildCorrelation(
        doc,
        (text) => INSCRIPTION_TRANSLATIONS[text] ?? text,
      );
      if (!built.ok) {
        deleteCapture(uri, 'processed');
        setPhase(built.reason === 'empty' ? 'empty' : 'low-confidence');
        return;
      }
      const translated = [];
      for (const sentence of built.sentences) {
        const preferred = direction;
        const result = await sharedTranslationEngine.translate({
          text: sentence.text,
          preferred,
          formality: 'formal',
          script: 'deva',
          forcePreferred: true,
        });
        translated.push({
          ...sentence,
          translation: result.text || sentence.translation,
        });
      }
      setSentences(translated);
      setDrawerOpen(false);
      deleteCapture(uri, 'processed');
      setPhase('result');
    } catch {
      deleteCapture(uri, 'processed');
      setPhase('empty');
    }
  };

  useEffect(() => {
    return () => {
      deleteCapture(captureUri, 'exit');
    };
  }, [captureUri]);

  useEffect(() => {
    const fixture = getCameraTestFixture();
    if (!fixture) return;
    setImageSize({ width: fixture.width, height: fixture.height });
    const built = buildCorrelation(fixture, (text) => INSCRIPTION_TRANSLATIONS[text] ?? text);
    if (!built.ok) {
      setPhase(built.reason === 'empty' ? 'empty' : 'low-confidence');
      return;
    }
    setSentences(built.sentences);
    setDrawerOpen(false);
    setPhase('result');
    deleteCapture(captureUri, 'processed');
  }, [captureUri]);

  if (!active) return null;

  const granted = permission?.granted === true;

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
      {phase === 'low-confidence' ? (
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
            {sentences.map((sentence) => {
              const frame = sentence.frames[0];
              if (!frame) return null;
              const mapped = mapFrameToView(frame, imageSize, viewSize);
              return (
                <Pressable
                  key={sentence.id}
                  testID={`camera-overlay-${sentence.id}`}
                  accessibilityLabel={sentence.text}
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
                />
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
            {sentences.map((sentence) => (
              <Pressable
                key={sentence.id}
                testID={`camera-row-${sentence.id}`}
                onPress={() => setSelected(sentence.id)}
                style={styles.row}
              >
                <View style={[styles.swatch, { backgroundColor: sentence.color }]} />
                <Text style={styles.rowText}>
                  {drawerOpen ? sentence.translation : previewText(sentence.translation)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            testID="camera-retake"
            onPress={() => {
              deleteCapture(captureUri, 'retake');
              setCaptureUri(null);
              setSentences([]);
              setPhase(granted ? 'live' : 'permission');
            }}
          >
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
  overlay: { position: 'absolute', borderRadius: 4 },
  found: { position: 'absolute', right: 12, bottom: 12, color: '#fff' },
  drawer: {
    backgroundColor: '#2C2622',
    padding: 16,
    gap: 10,
  },
  drawerTitle: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  swatch: { width: 12, height: 12, borderRadius: 2 },
  rowText: { color: '#fff', flex: 1 },
  retake: { color: '#fff', padding: 16, fontWeight: '700' },
});
