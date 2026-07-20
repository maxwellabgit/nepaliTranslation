import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './src/screens/HomeScreen';
import { ConversationScreen } from './src/screens/ConversationScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import type { HistoryItem } from './src/storage/phrasebook';
import { colors } from './src/theme';

type Mode = 'auto' | 'conversation';
type Overlay = 'history' | null;

export default function App() {
  const [mode, setMode] = useState<Mode>('auto');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [seed, setSeed] = useState<HistoryItem | null>(null);
  const [seedKey, setSeedKey] = useState(0);

  if (overlay === 'history') {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="dark" />
        <HistoryScreen
          onClose={() => setOverlay(null)}
          onSelect={(item) => {
            setSeed(item);
            setSeedKey((k) => k + 1);
            setMode('auto');
            setOverlay(null);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        {mode === 'conversation' ? (
          <ConversationScreen />
        ) : (
          <HomeScreen
            key={seedKey}
            seed={seed}
            onOpenHistory={() => setOverlay('history')}
          />
        )}
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, mode === 'auto' && styles.tabOn]}
          onPress={() => setMode('auto')}
        >
          <Text style={[styles.tabLabel, mode === 'auto' && styles.tabLabelOn]}>
            Auto
          </Text>
          <Text style={[styles.tabHint, mode === 'auto' && styles.tabHintOn]}>
            Type or speak
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'conversation' && styles.tabOn]}
          onPress={() => setMode('conversation')}
        >
          <Text
            style={[styles.tabLabel, mode === 'conversation' && styles.tabLabelOn]}
          >
            Conversation
          </Text>
          <Text
            style={[styles.tabHint, mode === 'conversation' && styles.tabHintOn]}
          >
            Pass the phone
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  tabOn: {
    backgroundColor: colors.crimson,
    borderColor: colors.crimson,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  tabLabelOn: { color: '#fff' },
  tabHint: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabHintOn: { color: 'rgba(255,255,255,0.85)' },
});
