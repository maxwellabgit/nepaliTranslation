import { useContext, useMemo, useReducer, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { hardStopAudio } from './hardStopAudio';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';
import { contentMaxWidth, useSizeClass } from '../layout/sizeClass';
import { statusBarInset } from '../layout/statusBarInset';
import type { HistoryItem } from '../storage/phrasebook';
import {
  INITIAL_SHELL,
  TODAYS_REVIEW_ROUTE,
  reduceShell,
  type AppMode,
  type AppOverlay,
} from './shellRoutes';

export type { AppMode, AppOverlay };

type PaneProps = {
  active: boolean;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenReview?: () => void;
  seed?: HistoryItem | null;
  seedKey?: number;
  neuralReady: boolean;
  mtWarmStatus: string | null;
  onGoHome?: () => void;
};

type CameraPaneProps = {
  active: boolean;
  onGoHome?: () => void;
};

type LearnPaneProps = {
  active: boolean;
  onOpenTodaysReview: () => void;
  onGoHome?: () => void;
};

type HistoryOverlayProps = {
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
};

type SettingsOverlayProps = {
  onClose: () => void;
  onOpenTodaysReview: () => void;
  neuralReady: boolean;
};

type TodaysReviewOverlayProps = {
  onClose: () => void;
};

type Props = {
  TranslatePane: (props: PaneProps) => ReactNode;
  CameraPane: (props: CameraPaneProps) => ReactNode;
  LearnPane: (props: LearnPaneProps) => ReactNode;
  HistoryOverlay: (props: HistoryOverlayProps) => ReactNode;
  SettingsOverlay: (props: SettingsOverlayProps) => ReactNode;
  TodaysReviewOverlay: (props: TodaysReviewOverlayProps) => ReactNode;
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
  TodaysReviewOverlay,
  neuralReady,
  mtWarmStatus,
  onHardStop = hardStopAudio,
}: Props) {
  const theme = useTheme();
  const lang = useUiLang();
  const [{ mode, overlay }, dispatch] = useReducer(reduceShell, INITIAL_SHELL);
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
          justifyContent: 'space-evenly',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingBottom: 28,
          backgroundColor: theme.colors.bg,
        },
        tab: {
          minWidth: 88,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          backgroundColor: 'transparent',
        },
        tabOn: {
          backgroundColor: '#F6D5DC',
        },
        tabLabel: {
          fontSize: 12,
          fontWeight: '600',
          textAlign: 'center',
          color: '#4A3F55',
        },
        tabLabelOn: { color: theme.colors.text },
      }),
    [theme],
  );

  const goHome = () => {
    onHardStop();
    dispatch({ type: 'switch_mode', mode: 'translate' });
  };

  const switchMode = (next: AppMode) => {
    if (next === mode) return;
    onHardStop();
    dispatch({ type: 'switch_mode', mode: next });
  };

  const safeInsets = useContext(SafeAreaInsetsContext);
  const topInset = statusBarInset(safeInsets?.top ?? 0);

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={[styles.root, { paddingTop: topInset }]}
      testID="app-shell"
      accessibilityLabel={`app-shell-${theme.scheme}`}
    >
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
              dispatch({ type: 'open_overlay', overlay: 'history' });
            }}
            onOpenSettings={() => {
              onHardStop();
              dispatch({ type: 'open_overlay', overlay: 'settings' });
            }}
            onOpenReview={() => {
              onHardStop();
              dispatch({ type: 'open_overlay', overlay: TODAYS_REVIEW_ROUTE });
            }}
            onGoHome={goHome}
          />
        </View>
        {mode === 'camera' ? (
          <View style={styles.pane} testID="pane-camera">
            <CameraPane active onGoHome={goHome} />
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
            onGoHome={goHome}
            onOpenTodaysReview={() => {
              onHardStop();
              dispatch({ type: 'open_overlay', overlay: TODAYS_REVIEW_ROUTE });
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
            name="swap-horizontal"
            size={22}
            color="#1A1410"
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
            size={22}
            color="#5C4E66"
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
            size={22}
            color="#5C4E66"
          />
          <Text style={[styles.tabLabel, mode === 'learn' && styles.tabLabelOn]}>
            {t('tabs.learn', lang)}
          </Text>
        </Pressable>
      </View>

      {overlay ? (
        <View
          style={[styles.overlay, { paddingTop: topInset }]}
          testID={`overlay-${overlay}`}
        >
          {overlay === 'history' ? (
            <HistoryOverlay
              onClose={goHome}
              onSelect={(item) => {
                onHardStop();
                setSeed(item);
                setSeedKey((k) => k + 1);
                dispatch({ type: 'select_history' });
              }}
            />
          ) : overlay === 'settings' ? (
            <SettingsOverlay
              onClose={goHome}
              onOpenTodaysReview={() => {
                onHardStop();
                dispatch({ type: 'open_overlay', overlay: TODAYS_REVIEW_ROUTE });
              }}
              neuralReady={neuralReady}
            />
          ) : overlay === TODAYS_REVIEW_ROUTE ? (
            <TodaysReviewOverlay onClose={goHome} />
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
