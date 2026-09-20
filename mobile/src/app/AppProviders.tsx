import { useEffect, type ReactNode } from 'react';
import { AuthProvider } from '../features/auth/AuthProvider';
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

/** Optional identity. Missing Supabase config leaves children usable. */
export function AppProviders({ children }: Props) {
  return (
    <AuthProvider>
      <LegacyOutboxMigration />
      {children}
    </AuthProvider>
  );
}
