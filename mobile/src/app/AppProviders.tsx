import type { ReactNode } from 'react';
import { AuthProvider } from '../features/auth/AuthProvider';

type Props = {
  children: ReactNode;
};

/** Optional identity. Missing Supabase config leaves children usable. */
export function AppProviders({ children }: Props) {
  return <AuthProvider>{children}</AuthProvider>;
}
