import { useMemo, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { hardStopAudio } from './hardStopAudio';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';
import { contentMaxWidth, useSizeClass } from '../layout/sizeClass';
import type { HistoryItem } from '../storage/phrasebook';
import { requestInterstitialOpportunity } from '../features/ads/InterstitialController';

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
  const theme = useTheme();
  const lang = useUiLang();
  const [mode, setMode] = useState<AppMode>('translate');
  const [overlay, setOverlay] = useState<AppOverlay>(null);
  const [seed, setSeed] = useState<HistoryItem | null>(null);
  const [seedKey, setSeedKey] = useState(0);
  const size = useSizeClass();
  const maxWidth = contentMaxWidth(size);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.colors.bg },
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
          backgroundColor: theme.colors.bg,
        },
        tabBar: {
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.divider,
          backgroundColor: theme.colors.bg,
        },
        tab: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: 10,
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.divider,
        },
        tabOn: {
          backgroundColor: theme.colors.crimson,
          borderColor: theme.colors.crimson,
        },
        tabLabel: {
          fontSize: 13,
          fontWeight: '700',
          color: theme.colors.text,
        },
        tabLabelOn: { color: theme.colors.onPrimary },
      }),
    [theme],
  );

  const switchMode = (next: AppMode) => {
    if (next === mode) return;
    onHardStop();
    // Tab presses are never interstitial opportunities (policy).
    requestInterstitialOpportunity({
      transition: 'tab_press',
      surface: next === 'learn' ? 'learn_landing' : 'translate_idle',
      cameraActive: next === 'camera',
    });
    setMode(next);
  };

  const inactiveIcon = theme.colors.text;
  const activeIcon = theme.colors.onPrimary;

  return (
    <SafeAreaView style={styles.root} testID="app-shell">
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <View
        style={[
          styles.body,
          mode === 'camera' || !maxWidth
            ? null
            : { maxWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
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
          accessibilityLabel={t('tabs.translateA11y', lang)}
          testID="tab-translate"
        >
          <Ionicons
            name="language-outline"
            size={18}
            color={mode === 'translate' ? activeIcon : inactiveIcon}
          />
          <Text style={[styles.tabLabel, mode === 'translate' && styles.tabLabelOn]}>
            {t('tabs.translate', lang)}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'camera' && styles.tabOn]}
          onPress={() => switchMode('camera')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'camera' }}
          accessibilityLabel={t('tabs.cameraA11y', lang)}
          testID="tab-camera"
        >
          <Ionicons
            name="camera-outline"
            size={18}
            color={mode === 'camera' ? activeIcon : inactiveIcon}
          />
          <Text style={[styles.tabLabel, mode === 'camera' && styles.tabLabelOn]}>
            {t('tabs.camera', lang)}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'learn' && styles.tabOn]}
          onPress={() => switchMode('learn')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'learn' }}
          accessibilityLabel={t('tabs.learnA11y', lang)}
          testID="tab-learn"
        >
          <Ionicons
            name="book-outline"
            size={18}
            color={mode === 'learn' ? activeIcon : inactiveIcon}
          />
          <Text style={[styles.tabLabel, mode === 'learn' && styles.tabLabelOn]}>
            {t('tabs.learn', lang)}
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
                // Left the contributions task → safe idle on Learn or Translate.
                requestInterstitialOpportunity({
                  transition: 'idle_after_task',
                  surface:
                    mode === 'learn' ? 'learn_landing' : 'translate_idle',
                  cameraActive: mode === 'camera',
                  resultUnderReview: false,
                });
              }}
            />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
