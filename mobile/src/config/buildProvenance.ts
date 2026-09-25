import Constants from 'expo-constants';

/**
 * R0 build-provenance readout.
 *
 * Exposes the release identity a physical-device tester needs to quote
 * in `DEVICE_PROOF.md` or a support bug: marketing version, iOS build
 * number, short Git SHA baked at build time, release channel/env, ads
 * environment, and model manifest short hashes.
 *
 * Everything here comes from `Constants.expoConfig` or the manifest JSON.
 * No secret material is read or exposed. Missing values render as
 * `unknown` rather than crashing the surface.
 */

import manifest from '../mt/onnx/it2-release-manifest.json';

export type BuildProvenance = {
  appVersion: string;
  buildNumber: string;
  gitSha: string;
  gitShaShort: string;
  releaseChannel: string;
  adsEnv: 'test' | 'test-ssv' | 'live' | 'unknown';
  modelFamily: string;
  modelEnIndicRevision: string;
  modelIndicEnRevision: string;
  modelEnIndicRevisionShort: string;
  modelIndicEnRevisionShort: string;
};

function readExtra(): Record<string, unknown> {
  const extra = Constants.expoConfig?.extra;
  return extra && typeof extra === 'object' ? extra : {};
}

function readAdsEnv(extra: Record<string, unknown>): 'test' | 'test-ssv' | 'live' | 'unknown' {
  const ads = extra.ads;
  if (ads && typeof ads === 'object') {
    const env = (ads as Record<string, unknown>).env;
    if (env === 'production' || env === 'live') return 'live';
    if (env === 'test') return 'test';
    if (env === 'test-ssv') return 'test-ssv';
  }
  const explicit = process.env.EXPO_PUBLIC_ADS_ENV;
  if (explicit === 'live' || explicit === 'test' || explicit === 'test-ssv') return explicit;
  return 'unknown';
}

function short(sha: string, n = 7): string {
  if (!sha) return '';
  return sha.slice(0, n);
}

export function readBuildProvenance(): BuildProvenance {
  const cfg = Constants.expoConfig;
  const extra = readExtra();
  const gitSha =
    (typeof extra.gitSha === 'string' && extra.gitSha) ||
    process.env.EXPO_PUBLIC_GIT_SHA ||
    '';
  const releaseChannel =
    (typeof extra.releaseChannel === 'string' && extra.releaseChannel) ||
    process.env.EXPO_PUBLIC_RELEASE_CHANNEL ||
    'unknown';
  const enIndicRev =
    (manifest as { bundles?: { 'en-indic'?: { revision?: string } } }).bundles?.[
      'en-indic'
    ]?.revision ?? '';
  const indicEnRev =
    (manifest as { bundles?: { 'indic-en'?: { revision?: string } } }).bundles?.[
      'indic-en'
    ]?.revision ?? '';
  return {
    appVersion: cfg?.version ?? 'unknown',
    buildNumber: cfg?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? '',
    gitSha,
    gitShaShort: short(gitSha),
    releaseChannel,
    adsEnv: readAdsEnv(extra),
    modelFamily:
      (manifest as { family?: string }).family ?? 'IndicTrans2-dist-200M-ONNX',
    modelEnIndicRevision: enIndicRev,
    modelIndicEnRevision: indicEnRev,
    modelEnIndicRevisionShort: short(enIndicRev),
    modelIndicEnRevisionShort: short(indicEnRev),
  };
}

/**
 * One-line summary suitable for logs and diagnostic screens. Contains no
 * secret material.
 */
export function formatBuildProvenance(p: BuildProvenance): string {
  const buildTail = p.buildNumber ? ` (${p.buildNumber})` : '';
  const sha = p.gitShaShort ? p.gitShaShort : 'unknown';
  return `v${p.appVersion}${buildTail} · ${p.releaseChannel} · ads:${p.adsEnv} · git:${sha} · model:${p.modelEnIndicRevisionShort || '?'}/${p.modelIndicEnRevisionShort || '?'}`;
}
