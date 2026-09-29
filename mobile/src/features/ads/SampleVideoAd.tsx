import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const SKIP_AFTER_SECONDS = 5;

type Props = {
  visible: boolean;
  onFinished: () => void;
};

/**
 * Full-screen sample video for the testing ground. A live AdMob interstitial
 * is not available in the browser. Skip stays locked for 5 seconds.
 */
export function SampleVideoAd({ visible, onFinished }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((value) => value + 1), 1_000);
    return () => clearInterval(id);
  }, [visible]);

  const canSkip = elapsed >= SKIP_AFTER_SECONDS;
  const skipLabel = canSkip ? 'Skip' : `Skip in ${SKIP_AFTER_SECONDS - elapsed}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.scrim} testID="sample-video-ad">
        <Text style={styles.badge}>TEST AD</Text>
        <Text style={styles.title}>Sample video</Text>
        <Text style={styles.body}>This interrupts the screen. Testing ground only.</Text>
        <Pressable
          style={[styles.skip, !canSkip && styles.skipLocked]}
          disabled={!canSkip}
          onPress={onFinished}
          testID="sample-video-skip"
        >
          <Text style={styles.skipText}>{skipLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(12, 10, 8, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  badge: {
    color: '#F0C14A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  body: {
    color: '#E7D7B1',
    fontSize: 15,
    textAlign: 'center',
  },
  skip: {
    marginTop: 18,
    minHeight: 44,
    minWidth: 120,
    borderRadius: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F1D8',
  },
  skipLocked: {
    backgroundColor: '#3A342C',
  },
  skipText: {
    color: '#1A1410',
    fontWeight: '800',
  },
});
