import { useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { hardStopAudio } from './hardStopAudio';
import { colors } from '../theme';
import { contentMaxWidth, useSizeClass } from '../layout/sizeClass';
import type { HistoryItem } from '../storage/phrasebook';

export type AppMode = 'translate' | 'camera' | 'learn';
export type AppOverlay =
  | 'history'
  | 'settings'
  | 'contributions'
  | null;

type PaneProps = {
  active: boolean;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  seed?: HistoryItem | null;
  seedKey?: number;
  neuralReady: boolean;
  mtWarmStatus: string | null;
};

type CameraPaneProps = {
  active: boolean;
};

type LearnPaneProps = {
  active: boolean;
  onOpenContributions: () => void;
};

type HistoryOverlayProps = {
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
};

type SettingsOverlayProps = {
  onClose: () => void;
  onOpenContributions: () => void;
  neuralReady: boolean;
};

type ContributionsOverlayProps = {
  onClose: () => void;
};

type Props = {
  TranslatePane: (props: PaneProps) => ReactNode;
  CameraPane: (props: CameraPaneProps) => ReactNode;
  LearnPane: (props: LearnPaneProps) => ReactNode;
  HistoryOverlay: (props: HistoryOverlayProps) => ReactNode;
  SettingsOverlay: (props: SettingsOverlayProps) => ReactNode;
  ContributionsOverlay: (props: ContributionsOverlayProps) => ReactNode;
  neuralReady: boolean;
  mtWarmStatus: string | null;
  /** Injected for tests; defaults to production hardStopAudio. */
  onHardStop?: () => void;
};

export function AppShell({
  TranslatePane,
  CameraPane,
  LearnPane,
  HistoryOverlay,
  SettingsOverlay,
  ContributionsOverlay,
  neuralReady,
  mtWarmStatus,
  onHardStop = hardStopAudio,
}: Props) {
  const [mode, setMode] = useState<AppMode>('translate');
  const [overlay, setOverlay] = useState<AppOverlay>(null);
  const [seed, setSeed] = useState<HistoryItem | null>(null);
  const [seedKey, setSeedKey] = useState(0);
  const size = useSizeClass();
  const maxWidth = contentMaxWidth(size);

  const switchMode = (next: AppMode) => {
    if (next === mode) return;
    onHardStop();
    setMode(next);
  };

  return (
    <SafeAreaView style={styles.root} testID="app-shell">
      <StatusBar style="dark" />
      <View style={[styles.body, maxWidth ? { maxWidth, alignSelf: 'center', width: '100%' } : null]}>
        {/* Translate and Learn stay mounted. Camera unmounts when its tab is
            inactive so only one camera preview can exist. */}
        <View
          style={[styles.pane, mode !== 'translate' && styles.paneHidden]}
          pointerEvents={mode === 'translate' ? 'auto' : 'none'}
          accessibilityElementsHidden={mode !== 'translate'}
          importantForAccessibility={
            mode === 'translate' ? 'auto' : 'no-hide-descendants'
          }
          testID="pane-translate"
        >
          <TranslatePane
            key={seedKey}
            active={mode === 'translate'}
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
        {mode === 'camera' ? (
          <View style={styles.pane} testID="pane-camera">
            <CameraPane active />
          </View>
        ) : null}
        <View
          style={[styles.pane, mode !== 'learn' && styles.paneHidden]}
          pointerEvents={mode === 'learn' ? 'auto' : 'none'}
          accessibilityElementsHidden={mode !== 'learn'}
          importantForAccessibility={
            mode === 'learn' ? 'auto' : 'no-hide-descendants'
          }
          testID="pane-learn"
        >
          <LearnPane
            active={mode === 'learn'}
            onOpenContributions={() => {
              onHardStop();
              setOverlay('contributions');
            }}
          />
        </View>
      </View>

      <View style={styles.tabBar} testID="tab-bar">
        <Pressable
          style={[styles.tab, mode === 'translate' && styles.tabOn]}
          onPress={() => switchMode('translate')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'translate' }}
          accessibilityLabel="Translate tab"
          testID="tab-translate"
        >
          <Ionicons
            name="language-outline"
            size={18}
            color={mode === 'translate' ? '#fff' : colors.text}
          />
          <Text style={[styles.tabLabel, mode === 'translate' && styles.tabLabelOn]}>
            Translate
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'camera' && styles.tabOn]}
          onPress={() => switchMode('camera')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'camera' }}
          accessibilityLabel="Camera tab"
          testID="tab-camera"
        >
          <Ionicons
            name="camera-outline"
            size={18}
            color={mode === 'camera' ? '#fff' : colors.text}
          />
          <Text style={[styles.tabLabel, mode === 'camera' && styles.tabLabelOn]}>
            Camera
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'learn' && styles.tabOn]}
          onPress={() => switchMode('learn')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'learn' }}
          accessibilityLabel="Learn tab"
          testID="tab-learn"
        >
          <Ionicons
            name="book-outline"
            size={18}
            color={mode === 'learn' ? '#fff' : colors.text}
          />
          <Text style={[styles.tabLabel, mode === 'learn' && styles.tabLabelOn]}>
            Learn
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
                setMode('translate');
                setOverlay(null);
              }}
            />
          ) : overlay === 'settings' ? (
            <SettingsOverlay
              onClose={() => {
                onHardStop();
                setOverlay(null);
              }}
              onOpenContributions={() => {
                onHardStop();
                setOverlay('contributions');
              }}
              neuralReady={neuralReady}
            />
          ) : (
            <ContributionsOverlay
              onClose={() => {
                onHardStop();
                setOverlay(null);
              }}
            />
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
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  tabOn: {
    backgroundColor: colors.crimson,
    borderColor: colors.crimson,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  tabLabelOn: { color: '#fff' },
});
