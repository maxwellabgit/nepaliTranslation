import { useEffect, useState } from 'react';

import type { AdService, ConsentState } from '../../services/contracts';

/** UMP may finish after remote flags and the initial screen render. */
export function useAdConsent(ads: AdService): ConsentState {
  const [consent, setConsent] = useState<ConsentState>(() => ads.getConsentState());

  useEffect(() => {
    const update = (next: ConsentState) => {
      setConsent((previous) =>
        previous.canRequestAds === next.canRequestAds &&
        previous.privacyOptionsRequired === next.privacyOptionsRequired
          ? previous
          : next,
      );
    };
    const unsubscribe = ads.subscribeConsent?.(update);
    update(ads.getConsentState());
    return unsubscribe;
  }, [ads]);

  return consent;
}
