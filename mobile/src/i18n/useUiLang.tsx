import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useServices } from '../services/ServiceContext';
import { loadPrefs, savePrefs, type UiLangPref } from '../storage/prefs';
import type { UiLang } from './t';

type UiLangContextValue = {
  lang: UiLang;
  setLang: (lang: UiLang) => void;
  ready: boolean;
};

const UiLangContext = createContext<UiLangContextValue | null>(null);

export function UiLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPrefs().then((prefs) => {
      if (cancelled) return;
      setLangState(prefs.uiLang);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((next: UiLang) => {
    setLangState(next);
    void loadPrefs().then((prefs) =>
      savePrefs({ ...prefs, uiLang: next as UiLangPref }),
    );
  }, []);

  const value = useMemo(
    () => ({ lang, setLang, ready }),
    [lang, setLang, ready],
  );

  return (
    <UiLangContext.Provider value={value}>{children}</UiLangContext.Provider>
  );
}

/**
 * Persisted UI language (English | नेपाली). Works before sign-in.
 * Optional override is for tests or one-off previews.
 */
export function useUiLang(override?: UiLang): UiLang {
  const ctx = useContext(UiLangContext);
  if (override) return override;
  return ctx?.lang ?? 'en';
}

export function useSetUiLang(): (lang: UiLang) => void {
  const ctx = useContext(UiLangContext);
  return ctx?.setLang ?? (() => undefined);
}

/** Subscribe to AppServices.network for offline banners on optional-service screens. */
export function useNetworkOffline(): boolean {
  const { network } = useServices();
  const [offline, setOffline] = useState(() => network.isOffline());

  useEffect(() => {
    setOffline(network.isOffline());
    return network.subscribe(setOffline);
  }, [network]);

  return offline;
}
