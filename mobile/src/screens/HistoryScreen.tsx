import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from './useFocusEffect';
import {
  clearHistory,
  loadHistory,
  loadStarred,
  type HistoryItem,
} from '../storage/phrasebook';
import { colors } from '../theme';

type Props = {
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
};

export function HistoryScreen({ onClose, onSelect }: Props) {
  const [tab, setTab] = useState<'history' | 'saved'>('saved');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [starred, setStarred] = useState<HistoryItem[]>([]);

  const reload = useCallback(async () => {
    setHistory(await loadHistory());
    setStarred(await loadStarred());
  }, []);

  useFocusEffect(reload);

  const items = tab === 'history' ? history : starred;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.topBtn}>
          <Text style={styles.topBtnText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Your activity</Text>
        <Pressable
          onPress={async () => {
            if (tab === 'history') {
              await clearHistory();
              await reload();
            }
          }}
          hitSlop={12}
          style={styles.topBtn}
        >
          <Text style={styles.clearText}>{tab === 'history' ? 'Clear' : ''}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'saved' && styles.tabOn]}
          onPress={() => setTab('saved')}
        >
          <Text style={[styles.tabText, tab === 'saved' && styles.tabTextOn]}>
            Saved
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'history' && styles.tabOn]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextOn]}>
            History
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? (
          <Text style={styles.empty}>
            {tab === 'history'
              ? 'Translations you make will show up here.'
              : 'Tap the star on a translation to save it.'}
          </Text>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              style={styles.row}
              onPress={() => onSelect(item)}
            >
              <Text style={styles.src} numberOfLines={2}>
                {item.source}
              </Text>
              <Text style={styles.dst} numberOfLines={2}>
                {item.translation}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabOn: { borderBottomColor: colors.blue },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabTextOn: { color: colors.blue },
  list: { padding: 12, paddingBottom: 40 },
  empty: {
    textAlign: 'center',
    color: colors.textPlaceholder,
    marginTop: 48,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  src: { fontSize: 15, color: colors.textSecondary, marginBottom: 4 },
  dst: { fontSize: 18, color: colors.text, fontWeight: '500' },
});
