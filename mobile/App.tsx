import { useEffect, useState } from 'react';
import { AppProviders } from './src/app/AppProviders';
import { AppShell } from './src/app/AppShell';
import { HomeScreen } from './src/screens/HomeScreen';
import { ConversationScreen } from './src/screens/ConversationScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MeaningReviewScreen } from './src/screens/MeaningReviewScreen';
import { LearnScreen } from './src/screens/LearnScreen';
import { sharedTranslationEngine } from './src/mt/TranslationEngine';
import {
  MT_WARM_DOWNLOADING,
  MT_WARM_FAILED,
  MT_WARM_PREPARING,
} from './src/mt/mtStatus';

export default function App() {
  const [neuralReady, setNeuralReady] = useState(false);
  const [mtWarmStatus, setMtWarmStatus] = useState<string | null>(
    MT_WARM_PREPARING,
  );

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
        setTimeout(() => {
          if (!cancelled) setMtWarmStatus(null);
        }, 4000);
      } else {
        setMtWarmStatus(null);
      }
      await sharedTranslationEngine.whenReverseSettled();
      if (!cancelled && ready) setMtWarmStatus(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppProviders>
      <AppShell
        neuralReady={neuralReady}
        mtWarmStatus={mtWarmStatus}
        AutoPane={(props) => <HomeScreen {...props} />}
        ConversationPane={(props) => <ConversationScreen {...props} />}
        LearnPane={(props) => <LearnScreen {...props} />}
        HistoryOverlay={(props) => <HistoryScreen {...props} />}
        SettingsOverlay={(props) => <SettingsScreen {...props} />}
        MeaningOverlay={(props) => <MeaningReviewScreen {...props} />}
      />
    </AppProviders>
  );
}
