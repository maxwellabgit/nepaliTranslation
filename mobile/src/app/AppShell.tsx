import { useState, type ReactNode } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { hardStopAudio } from './hardStopAudio';
import { colors } from '../theme';
import type { HistoryItem } from '../storage/phrasebook';

export type AppMode = 'auto' | 'conversation';
export type AppOverlay = 'history' | 'settings' | 'meaning' | null;

type PaneProps = {
  active: boolean;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  seed?: HistoryItem | null;
  seedKey?: number;
  neuralReady: boolean;
  mtWarmStatus: string | null;
};

type ConversationPaneProps = {
  active: boolean;
  neuralReady: boolean;
};

type HistoryOverlayProps = {
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
};

type SettingsOverlayProps = {
  onClose: () => void;
  onOpenMeaningReview: () => void;
  neuralReady: boolean;
};

type MeaningOverlayProps = {
  onClose: () => void;
};

type Props = {
  AutoPane: (props: PaneProps) => ReactNode;
  ConversationPane: (props: ConversationPaneProps) => ReactNode;
  HistoryOverlay: (props: HistoryOverlayProps) => ReactNode;
  SettingsOverlay: (props: SettingsOverlayProps) => ReactNode;
  MeaningOverlay: (props: MeaningOverlayProps) => ReactNode;
  neuralReady: boolean;
  mtWarmStatus: string | null;
  /** Injected for tests; defaults to production hardStopAudio. */
  onHardStop?: () => void;
};

export function AppShell({
  AutoPane,
  ConversationPane,
  HistoryOverlay,
  SettingsOverlay,
  MeaningOverlay,
  neuralReady,
  mtWarmStatus,
  onHardStop = hardStopAudio,
}: Props) {
  const [mode, setMode] = useState<AppMode>('auto');
  const [overlay, setOverlay] = useState<AppOverlay>(null);
  const [seed, setSeed] = useState<HistoryItem | null>(null);
  const [seedKey, setSeedKey] = useState(0);

  const switchMode = (next: AppMode) => {
    if (next === mode) return;
    onHardStop();
    setMode(next);
  };

  return (
    <SafeAreaView style={styles.root} testID="app-shell">
      <StatusBar style="dark" />
      <View style={styles.body}>
        {/* Both panes stay mounted so a tab tap does not wipe Auto input or the
            Conversation thread. Inactive pane is display:none and ignores
            pointer/STT events. Overlays still sit on top of whichever mode is
            showing. */}
        <View
          style={[styles.pane, mode !== 'auto' && styles.paneHidden]}
          pointerEvents={mode === 'auto' ? 'auto' : 'none'}
          accessibilityElementsHidden={mode !== 'auto'}
          importantForAccessibility={
            mode === 'auto' ? 'auto' : 'no-hide-descendants'
          }
          testID="pane-auto"
        >
          <AutoPane
            key={seedKey}
            active={mode === 'auto'}
            seed={seed}
            neuralReady={neuralReady}
            mtWarmStatus={mtWarmStatus}
            onOpenHistory={() => {
              onHardStop();
              setOverlay('history');
            }}
            onOpenSettings={() => {
              onHardStop();
              setOverlay('settings');
            }}
          />
        </View>
        <View
          style={[styles.pane, mode !== 'conversation' && styles.paneHidden]}
          pointerEvents={mode === 'conversation' ? 'auto' : 'none'}
          accessibilityElementsHidden={mode !== 'conversation'}
          importantForAccessibility={
            mode === 'conversation' ? 'auto' : 'no-hide-descendants'
          }
          testID="pane-conversation"
        >
          <ConversationPane
            active={mode === 'conversation'}
            neuralReady={neuralReady}
          />
        </View>
      </View>

      <View style={styles.tabBar} testID="tab-bar">
        <Pressable
          style={[styles.tab, mode === 'auto' && styles.tabOn]}
          onPress={() => switchMode('auto')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'auto' }}
          accessibilityLabel="Auto tab"
          testID="tab-auto"
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
          onPress={() => switchMode('conversation')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'conversation' }}
          accessibilityLabel="Conversation tab"
          testID="tab-conversation"
        >
          <Text
            style={[
              styles.tabLabel,
              mode === 'conversation' && styles.tabLabelOn,
            ]}
          >
            Conversation
          </Text>
          <Text
            style={[
              styles.tabHint,
              mode === 'conversation' && styles.tabHintOn,
            ]}
          >
            Speak · Pass · Speak
          </Text>
        </Pressable>
      </View>

      {overlay ? (
        <View style={styles.overlay} testID={`overlay-${overlay}`}>
          {overlay === 'history' ? (
            <HistoryOverlay
              onClose={() => setOverlay(null)}
              onSelect={(item) => {
                onHardStop();
                setSeed(item);
                setSeedKey((k) => k + 1);
                setMode('auto');
                setOverlay(null);
              }}
            />
          ) : overlay === 'settings' ? (
            <SettingsOverlay
              onClose={() => setOverlay(null)}
              onOpenMeaningReview={() => setOverlay('meaning')}
              neuralReady={neuralReady}
            />
          ) : (
            <MeaningOverlay onClose={() => setOverlay('settings')} />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  pane: {
    ...StyleSheet.absoluteFill,
  },
  paneHidden: {
    display: 'none',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
  },
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
