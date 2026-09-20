import { useEffect, type ReactNode } from 'react';
import { AuthProvider } from '../features/auth/AuthProvider';
import { EntitlementProvider } from '../features/entitlements/EntitlementProvider';
import { migrateLegacyReviewQueue } from '../storage/contributionOutbox';

type Props = {
  children: ReactNode;
};

function LegacyOutboxMigration() {
  useEffect(() => {
    void migrateLegacyReviewQueue();
  }, []);
  return null;
}

/** Optional identity + entitlements. Missing Supabase leaves children usable. */
export function AppProviders({ children }: Props) {
  return (
    <AuthProvider>
      <EntitlementProvider>
        <LegacyOutboxMigration />
        {children}
      </EntitlementProvider>
    </AuthProvider>
  );
}
