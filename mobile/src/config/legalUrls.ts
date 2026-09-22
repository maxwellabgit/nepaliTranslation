/**
 * Public legal / support URLs from env or app.config extra.
 * Empty → Settings shows honest "not live yet" copy (do not invent hosts).
 */

import Constants from 'expo-constants';

export type LegalPublicUrls = {
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
  supportUrl: string;
  /** Account / data deletion help page (optional; Settings still has in-app delete). */
  deletionInfoUrl: string;
  /** Host that should eventually serve /app-ads.txt (documentation only). */
  appAdsTxtUrl: string;
};

function readExtra(): Record<string, unknown> {
  const extra = Constants.expoConfig?.extra;
  return extra && typeof extra === 'object' ? extra : {};
}

function readLegalExtra(): Record<string, unknown> {
  const extra = readExtra();
  const legal = extra.legal;
  return legal && typeof legal === 'object'
    ? (legal as Record<string, unknown>)
    : {};
}

function pick(
  env: Record<string, string | undefined>,
  envKey: string,
  extraKey: string,
): string {
  const fromEnv = (env[envKey] ?? '').trim();
  if (fromEnv) return fromEnv;
  const legal = readLegalExtra();
  const fromExtra = legal[extraKey];
  return typeof fromExtra === 'string' ? fromExtra.trim() : '';
}

export function readLegalPublicUrls(
  env: Record<string, string | undefined> = process.env,
): LegalPublicUrls {
  return {
    privacyPolicyUrl: pick(env, 'EXPO_PUBLIC_PRIVACY_POLICY_URL', 'privacyPolicyUrl'),
    termsOfServiceUrl: pick(
      env,
      'EXPO_PUBLIC_TERMS_OF_SERVICE_URL',
      'termsOfServiceUrl',
    ),
    supportUrl: pick(env, 'EXPO_PUBLIC_SUPPORT_URL', 'supportUrl'),
    deletionInfoUrl: pick(env, 'EXPO_PUBLIC_DELETION_INFO_URL', 'deletionInfoUrl'),
    appAdsTxtUrl: pick(env, 'EXPO_PUBLIC_APP_ADS_TXT_URL', 'appAdsTxtUrl'),
  };
}

export function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}
