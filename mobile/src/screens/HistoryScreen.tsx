import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from './useFocusEffect';
import {
  clearHistory,
  deleteHistoryItem,
  loadHistory,
  type HistoryItem,
} from '../storage/phrasebook';
import {
  loadSentTrainingKeys,
  trainingKeyFor,
} from '../storage/trainingContrib';
import { CorrectionSheet } from '../features/contribution/CorrectionSheet';
import { EmptyState } from '../components/AppPrimitives';
import { colors } from '../theme';

type Props = {
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
};

const DELETE_WIDTH = 84;

/** iOS-style swipe-left row: content slides to reveal a trash action. */
function SwipeableRow({
  children,
  onDelete,
}: {
  children: ReactNode;
  onDelete: () => void;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);

  const settle = (open: boolean) => {
    openRef.current = open;
    Animated.spring(tx, {
      toValue: open ? -DELETE_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 24,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      // Claim only clearly horizontal drags so vertical list scroll still works.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_e, g) => {
        const base = openRef.current ? -DELETE_WIDTH : 0;
        const next = Math.min(0, Math.max(-DELETE_WIDTH - 24, base + g.dx));
        tx.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const base = openRef.current ? -DELETE_WIDTH : 0;
        settle(base + g.dx < -DELETE_WIDTH / 2);
      },
      onPanResponderTerminate: () => settle(openRef.current),
    }),
  ).current;

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.deleteUnder}>
        <Pressable
          onPress={onDelete}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel="Delete from history"
        >
          <Ionicons name="trash" size={22} color="#fff" />
        </Pressable>
      </View>
      <Animated.View
        style={{ transform: [{ translateX: tx }] }}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export function HistoryScreen({ onClose, onSelect }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sentKeys, setSentKeys] = useState<Set<string>>(new Set());
  const [correctionItem, setCorrectionItem] = useState<HistoryItem | null>(null);

  const reload = useCallback(async () => {
    setHistory(await loadHistory());
    setSentKeys(await loadSentTrainingKeys());
  }, []);

  useFocusEffect(reload);

  const onDeleteItem = async (item: HistoryItem) => {
    await deleteHistoryItem(item.id);
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
  };

  const onSendToTraining = (item: HistoryItem) => {
    setCorrectionItem(item);
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel="Close history"
          testID="history-close"
        >
          <Text style={styles.topBtnText}>←</Text>
        </Pressable>
        <Text style={styles.title}>History</Text>
        <Pressable
          onPress={() => {
            if (history.length === 0) return;
            Alert.alert(
              'Clear history',
              'Remove all translations from this device?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      await clearHistory();
                      await reload();
                    })();
                  },
                },
              ],
            );
          }}
          hitSlop={12}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel="Clear history"
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {history.length === 0 ? (
          <EmptyState
            title="No translations yet"
            detail="Translations you make will show up here."
            testID="history-empty"
          />
        ) : (
          history.map((item) => {
            const sent = sentKeys.has(trainingKeyFor(item));
            return (
              <SwipeableRow key={item.id} onDelete={() => void onDeleteItem(item)}>
                <View style={styles.row}>
                  <Pressable
                    style={styles.rowBody}
                    onPress={() => onSelect(item)}
                  >
                    <Text style={styles.src} numberOfLines={2}>
                      {item.source}
                    </Text>
                    <Text style={styles.dst} numberOfLines={2}>
                      {item.translation}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onSendToTraining(item)}
                    disabled={sent}
                    style={[styles.trainBtn, sent && styles.trainBtnOff]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      sent ? 'Already in training data' : 'Suggest correction for training'
                    }
                  >
                    <Text
                      style={[styles.trainText, sent && styles.trainTextOff]}
                    >
                      {sent ? 'Submitted' : 'To training'}
                    </Text>
                  </Pressable>
                </View>
              </SwipeableRow>
            );
          })
        )}
      </ScrollView>
      <CorrectionSheet
        visible={Boolean(correctionItem)}
        source={correctionItem?.source ?? ''}
        translation={correctionItem?.translation ?? ''}
        sourceLang={correctionItem?.sourceLang ?? 'en'}
        formality="formal"
        script="deva"
        surface="history"
        onClose={() => setCorrectionItem(null)}
        onSaved={() => void reload()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  topBtn: {
    width: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBtnText: { fontSize: 22, color: colors.textSecondary },
  clearText: { fontSize: 14, color: colors.blue, fontWeight: '600' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
  },
  list: { padding: 12, paddingBottom: 40 },
  swipeWrap: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  deleteUnder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.danger,
    borderRadius: 16,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: DELETE_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  rowBody: { flex: 1 },
  src: { fontSize: 15, color: colors.textSecondary, marginBottom: 4 },
  dst: { fontSize: 18, color: colors.text, fontWeight: '500' },
  trainBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.forestSoft,
  },
  trainBtnOff: {
    backgroundColor: colors.divider,
  },
  trainText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.forest,
  },
  trainTextOff: {
    color: colors.textPlaceholder,
  },
});
