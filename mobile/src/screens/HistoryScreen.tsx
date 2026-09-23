import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { CorrectionSheet } from '../features/contribution/CorrectionSheet';
import { EmptyState } from '../components/EmptyState';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';

type Props = {
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
};

const DELETE_WIDTH = 84;

/** iOS-style swipe-left row: content slides to reveal a trash action. */
function SwipeableRow({
  children,
  onDelete,
  deleteA11y,
  dangerColor,
}: {
  children: ReactNode;
  onDelete: () => void;
  deleteA11y: string;
  dangerColor: string;
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
      <View style={[styles.deleteUnder, { backgroundColor: dangerColor }]}>
        <Pressable
          onPress={onDelete}
          style={styles.deleteBtn}
          accessibilityRole="button"
          accessibilityLabel={deleteA11y}
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
  const theme = useTheme();
  const lang = useUiLang();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [correctionItem, setCorrectionItem] = useState<HistoryItem | null>(null);

  const reload = useCallback(async () => {
    setHistory(await loadHistory());
  }, []);

  useFocusEffect(reload);

  const onDeleteItem = async (item: HistoryItem) => {
    await deleteHistoryItem(item.id);
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
  };

  const onSendToTraining = (item: HistoryItem) => {
    setCorrectionItem(item);
  };

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          paddingVertical: 10,
          paddingHorizontal: theme.spacing.xs,
        },
        topBtnText: { fontSize: 22, color: theme.colors.textSecondary },
        clearText: {
          fontSize: 14,
          color: theme.colors.blue,
          fontWeight: '600',
        },
        title: {
          flex: 1,
          textAlign: 'center',
          fontSize: theme.typography.title.fontSize,
          fontWeight: theme.typography.title.fontWeight,
          color: theme.colors.text,
        },
        list: { padding: theme.spacing.md, paddingBottom: 40 },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.xl,
          padding: 14,
          gap: 10,
        },
        src: {
          fontSize: 15,
          color: theme.colors.textSecondary,
          marginBottom: 4,
        },
        dst: {
          fontSize: 18,
          color: theme.colors.text,
          fontWeight: '500',
        },
        trainBtn: {
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.forestSoft,
        },
        trainBtnOff: {
          backgroundColor: theme.colors.divider,
        },
        trainText: {
          fontSize: 12,
          fontWeight: '700',
          color: theme.colors.forest,
        },
        trainTextOff: {
          color: theme.colors.textPlaceholder,
        },
      }),
    [theme],
  );

  return (
    <View style={dynamic.root} testID="history-screen">
      <View style={dynamic.topBar}>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel={t('history.close', lang)}
          testID="history-close"
        >
          <Text style={dynamic.topBtnText}>←</Text>
        </Pressable>
        <Text style={dynamic.title}>{t('history.title', lang)}</Text>
        <Pressable
          onPress={() => {
            if (history.length === 0) return;
            Alert.alert(
              t('history.clearConfirmTitle', lang),
              t('history.clearConfirmBody', lang),
              [
                { text: t('common.cancel', lang), style: 'cancel' },
                {
                  text: t('common.clear', lang),
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
          accessibilityLabel={t('history.clearA11y', lang)}
        >
          <Text style={dynamic.clearText}>{t('history.clear', lang)}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={dynamic.list}>
        {history.length === 0 ? (
          <EmptyState
            kind="empty"
            title={t('history.emptyTitle', lang)}
            detail={t('history.emptyDetail', lang)}
            testID="history-empty"
          />
        ) : (
          history.map((item) => {
            return (
              <SwipeableRow
                key={item.id}
                onDelete={() => void onDeleteItem(item)}
                deleteA11y={t('history.deleteA11y', lang)}
                dangerColor={theme.colors.danger}
              >
                <View style={dynamic.row}>
                  <Pressable
                    style={styles.rowBody}
                    onPress={() => onSelect(item)}
                    testID={`history-item-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${item.source}`}
                  >
                    <Text style={dynamic.src} numberOfLines={2}>
                      {item.source}
                    </Text>
                    <Text style={dynamic.dst} numberOfLines={2}>
                      {item.translation}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onSendToTraining(item)}
                    style={dynamic.trainBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('history.toTrainingA11y', lang)}
                  >
                    <Text style={dynamic.trainText}>
                      {t('history.toTraining', lang)}
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
        formality={correctionItem?.formality ?? null}
        script={correctionItem?.script ?? null}
        translationMethod={correctionItem?.translationMethod ?? null}
        modelVersion={correctionItem?.modelVersion ?? null}
        surface="history"
        historyItemId={correctionItem?.id ?? null}
        onClose={() => setCorrectionItem(null)}
        onSaved={() => void reload()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBtn: {
    width: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  rowBody: { flex: 1 },
});
