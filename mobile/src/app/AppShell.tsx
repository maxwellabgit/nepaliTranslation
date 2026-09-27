import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { hardStopAudio } from './hardStopAudio';
import { t, useUiLang } from '../i18n';
import { useTheme } from '../theme';
import { contentMaxWidth, useSizeClass } from '../layout/sizeClass';
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
  conversation?: boolean;
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
  const [{ mode, overlay, conversation }, dispatch] = useReducer(reduceShell, INITIAL_SHELL);
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
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 28,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.divider,
          backgroundColor: theme.colors.bg,
        },
        tab: {
          width: 84,
          height: 84,
          borderRadius: 42,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          backgroundColor: '#F6DDE0',
          borderWidth: 1,
          borderColor: '#F6DDE0',
        },
        tabOn: {
          backgroundColor: '#E7B7BC',
          borderColor: '#E7B7BC',
        },
        tabLabel: {
          fontSize: 11,
          fontWeight: '700',
          textAlign: 'center',
          color: theme.colors.text,
        },
        tabLabelOn: { color: theme.colors.text },
      }),
    [theme],
  );

  const goHome = () => {
    onHardStop();
    dispatch({ type: 'exit_conversation' });
  };

  const switchMode = (next: AppMode) => {
    if (next === mode) return;
    onHardStop();
    dispatch({ type: 'switch_mode', mode: next });
  };

  const insets = useSafeAreaInsets();
  // Web preview reports no notch. Keep at least an iPhone status-bar gap
  // so the clock and battery are not covered.
  const topInset = Math.max(insets.top, 47);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const boot = (
      window as unknown as { __NEPTRANSLATE_TG__?: { harness?: string } }
    ).__NEPTRANSLATE_TG__;
    if (boot?.harness !== 'neptranslate-testing-ground') return;
    dispatch({ type: 'open_overlay', overlay: TODAYS_REVIEW_ROUTE });
  }, []);

  const inactiveIcon = theme.colors.text;
  const activeIcon = theme.colors.text;

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
            conversation={conversation}
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
          style={[styles.tab, conversation && mode === 'translate' && styles.tabOn]}
          onPress={() => {
            onHardStop();
            dispatch(
              conversation && mode === 'translate'
                ? { type: 'exit_conversation' }
                : { type: 'enter_conversation' },
            );
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: conversation && mode === 'translate' }}
          accessibilityLabel={t(
            conversation && mode === 'translate'
              ? 'tabs.translateA11y'
              : 'tabs.conversationA11y',
            lang,
          )}
          testID="tab-translate"
        >
          <Ionicons
            name={
              conversation && mode === 'translate'
                ? 'language-outline'
                : 'swap-horizontal'
            }
            size={18}
            color={
              conversation && mode === 'translate' ? activeIcon : inactiveIcon
            }
          />
          <Text
            style={[
              styles.tabLabel,
              conversation && mode === 'translate' && styles.tabLabelOn,
            ]}
          >
            {t(
              conversation && mode === 'translate'
                ? 'tabs.translate'
                : 'tabs.conversation',
              lang,
            )}
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
