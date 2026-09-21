import { useEffect, useState } from 'react';
import { useServices } from '../services/ServiceContext';
import type { UiLang } from './t';

/**
 * UI language for secondary surfaces. Defaults to English until a Settings
 * preference ships; callers may pass an override into `t(key, lang)`.
 */
export function useUiLang(override?: UiLang): UiLang {
  return override ?? 'en';
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
