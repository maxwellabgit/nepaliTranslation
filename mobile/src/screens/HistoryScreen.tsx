import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
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
import { BackArrow } from '../components/BackArrow';
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
  const [clearConfirmation, setClearConfirmation] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const clearing = useRef(false);
  const loadGeneration = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const loaded = await loadHistory();
    if (generation === loadGeneration.current) setHistory(loaded);
  }, []);

  useFocusEffect(reload);

  const onDeleteItem = async (item: HistoryItem) => {
    await deleteHistoryItem(item.id);
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
  };

  const onSendToTraining = (item: HistoryItem) => {
    setCorrectionItem(item);
  };

  const dismissClear = () => { if (!clearing.current) setClearConfirmation(false); };
  const confirmClear = async () => {
    if (clearing.current) return;
    clearing.current = true;
    setClearBusy(true);
    setClearError(null);
    loadGeneration.current += 1;
    try {
      await clearHistory();
      setHistory([]);
      setCorrectionItem(null);
      setClearConfirmation(false);
    } catch { setClearError(t('history.clearFailed', lang)); }
    finally { clearing.current = false; setClearBusy(false); }
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
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: theme.spacing.lg },
        dialog: { backgroundColor: theme.colors.surface, borderRadius: 20, borderWidth: 2, borderColor: '#C4922A', padding: 20, gap: 16 },
        dialogTitle: { fontSize: 22, fontWeight: '400', color: theme.colors.text },
        dialogBody: { fontSize: 22, fontWeight: '400', lineHeight: 29, color: theme.colors.text },
        dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
        dialogButton: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#C4922A', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
        dialogButtonText: { fontSize: 16, color: theme.colors.text },
        clearAction: { backgroundColor: theme.colors.danger },
        clearActionText: { color: '#FFFFFF' },
        dialogError: { fontSize: 14, color: theme.colors.errorText },
      }),
    [theme],
  );

  return (
    <View style={dynamic.root} testID="history-screen">
      <View style={dynamic.topBar}>
        <View style={styles.topBtn}>
          <BackArrow
            onPress={onClose}
            accessibilityLabel={t('history.close', lang)}
            testID="history-close"
          />
        </View>
        <Text style={dynamic.title}>{t('history.title', lang)}</Text>
        <Pressable
          onPress={() => { if (history.length > 0) { setClearError(null); setClearConfirmation(true); } }}
          disabled={history.length === 0 || clearBusy}
          testID="history-clear"
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
      <Modal visible={clearConfirmation} transparent animationType="none" onRequestClose={dismissClear}>
        <View style={dynamic.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismissClear} disabled={clearBusy} accessibilityRole="button" accessibilityLabel={t('common.dismiss', lang)} testID="history-clear-backdrop" />
          <View style={dynamic.dialog} accessibilityViewIsModal testID="history-clear-dialog">
            <Text style={dynamic.dialogTitle}>{t('history.clearConfirmTitle', lang)}</Text>
            <Text style={dynamic.dialogBody}>{t('history.clearConfirmBody', lang)}</Text>
            {clearError ? <Text style={dynamic.dialogError} accessibilityRole="alert">{clearError}</Text> : null}
            <View style={dynamic.dialogActions}>
              <Pressable style={dynamic.dialogButton} onPress={dismissClear} disabled={clearBusy} accessibilityRole="button" testID="history-clear-cancel">
                <Text style={dynamic.dialogButtonText}>{t('common.cancel', lang)}</Text>
              </Pressable>
              <Pressable style={[dynamic.dialogButton, dynamic.clearAction]} onPress={() => void confirmClear()} disabled={clearBusy} accessibilityRole="button" testID="history-clear-confirm">
                <Text style={[dynamic.dialogButtonText, dynamic.clearActionText]}>{t('common.clear', lang)}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
