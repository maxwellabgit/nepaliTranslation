import Constants from 'expo-constants';

export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authConfigured: boolean;
  /** RevenueCat public Apple API key only — never a webhook/secret key. */
  revenueCatAppleApiKey?: string;
};

function readExtra(): Record<string, unknown> {
  const extra = Constants.expoConfig?.extra;
  return extra && typeof extra === 'object' ? extra : {};
}

function jwtRole(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = globalThis.atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const parsed = JSON.parse(json) as { role?: unknown };
    return typeof parsed.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
}

/** Publishable config only. A service-role key is treated as missing. */
export function readPublicEnv(
  env: Record<string, string | undefined> = process.env,
): PublicEnv {
  const extra = readExtra();
  const supabaseUrl = (
    env.EXPO_PUBLIC_SUPABASE_URL ??
    (typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl : '')
  ).trim();
  const supabaseAnonKey = (
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    (typeof extra.supabaseAnonKey === 'string' ? extra.supabaseAnonKey : '')
  ).trim();
  const looksSecret =
    supabaseAnonKey.includes('service_role') ||
    supabaseAnonKey.startsWith('sb_secret_') ||
    jwtRole(supabaseAnonKey) === 'service_role';
  return {
    supabaseUrl,
    supabaseAnonKey: looksSecret ? '' : supabaseAnonKey,
    authConfigured: Boolean(supabaseUrl && supabaseAnonKey && !looksSecret),
    revenueCatAppleApiKey: (
      env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ??
      (typeof extra.revenueCatAppleApiKey === 'string'
        ? extra.revenueCatAppleApiKey
        : '')
    ).trim(),
  };
}
