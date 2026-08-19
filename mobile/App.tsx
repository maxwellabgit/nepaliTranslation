import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { hardStopSpeech } from './src/stt/sttSupport';
import { HomeScreen } from './src/screens/HomeScreen';
import { ConversationScreen } from './src/screens/ConversationScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MeaningReviewScreen } from './src/screens/MeaningReviewScreen';
import { sharedTranslationEngine } from './src/mt/TranslationEngine';
import {
  MT_WARM_DOWNLOADING,
  MT_WARM_FAILED,
  MT_WARM_PREPARING,
} from './src/mt/mtStatus';
import type { HistoryItem } from './src/storage/phrasebook';
import { colors } from './src/theme';

type Mode = 'auto' | 'conversation';
type Overlay = 'history' | 'settings' | 'meaning' | null;

function hardStopAudio() {
  hardStopSpeech();
  sharedTranslationEngine.cancelAll();
}

export default function App() {
  const [mode, setMode] = useState<Mode>('auto');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [seed, setSeed] = useState<HistoryItem | null>(null);
  const [seedKey, setSeedKey] = useState(0);
  const [neuralReady, setNeuralReady] = useState(false);
  const [mtWarmStatus, setMtWarmStatus] = useState<string | null>(MT_WARM_PREPARING);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setMtWarmStatus(MT_WARM_PREPARING);
      await sharedTranslationEngine.warmUp((p) => {
        if (cancelled) return;
        if (p.phase === 'download') {
          setMtWarmStatus(`${MT_WARM_DOWNLOADING} ${p.index}/${p.total}`);
        } else {
          setMtWarmStatus(MT_WARM_PREPARING);
        }
      });
      if (cancelled) return;
      const ready = sharedTranslationEngine.isNeuralReady();
      setNeuralReady(ready);
      if (!ready) {
        setMtWarmStatus(MT_WARM_FAILED);
        // Clear the failure banner after a beat so phrasebook mode feels calm.
        setTimeout(() => {
          if (!cancelled) setMtWarmStatus(null);
        }, 4000);
      } else {
        setMtWarmStatus(null);
      }
      // NE→EN loads in the background and shares the progress callback;
      // clear whatever banner it may have raised once it settles.
      await sharedTranslationEngine.whenReverseSettled();
      if (!cancelled && ready) setMtWarmStatus(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    hardStopAudio();
    setMode(next);
  };

  return (
    <SafeAreaView style={styles.root}>
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
        >
          <HomeScreen
            key={seedKey}
            active={mode === 'auto' && overlay === null}
            seed={seed}
            neuralReady={neuralReady}
            mtWarmStatus={mtWarmStatus}
            onOpenHistory={() => {
              hardStopAudio();
              setOverlay('history');
            }}
            onOpenSettings={() => {
              hardStopAudio();
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
        >
          <ConversationScreen
            active={mode === 'conversation' && overlay === null}
            neuralReady={neuralReady}
            mtWarmStatus={mtWarmStatus}
          />
        </View>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, mode === 'auto' && styles.tabOn]}
          onPress={() => switchMode('auto')}
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
        >
          <Text
            style={[styles.tabLabel, mode === 'conversation' && styles.tabLabelOn]}
          >
            Conversation
          </Text>
          <Text
            style={[styles.tabHint, mode === 'conversation' && styles.tabHintOn]}
          >
            Speak · Pass · Speak
          </Text>
        </Pressable>
      </View>

      {/* Overlays render on top so the screens beneath keep their state. */}
      {overlay ? (
        <View style={styles.overlay}>
          {overlay === 'history' ? (
            <HistoryScreen
              onClose={() => setOverlay(null)}
              onSelect={(item) => {
                hardStopAudio();
                setSeed(item);
                setSeedKey((k) => k + 1);
                setMode('auto');
                setOverlay(null);
              }}
            />
          ) : overlay === 'settings' ? (
            <SettingsScreen
              onClose={() => setOverlay(null)}
              onOpenMeaningReview={() => setOverlay('meaning')}
              neuralReady={neuralReady}
            />
          ) : (
            <MeaningReviewScreen onClose={() => setOverlay('settings')} />
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
