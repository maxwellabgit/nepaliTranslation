import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchNextContribution,
  newIdempotencyKey,
  submitContribution,
} from '../contributionApi';
import { CONTRIBUTION_CONSENT_VERSION } from '../../auth/consent';
import { getSupabase } from '../../../services/supabase';
import { saveLocalConsent } from '../../../storage/contributionConsent';
import {
  setRuntimeFeatureFlags,
  DEFAULT_FEATURE_FLAGS,
} from '../../../app/featureFlags';
import { readPublicEnv } from '../../../config/env';

jest.mock('../../../config/env', () => ({
  readPublicEnv: jest.fn(),
}));

const mockReadPublicEnv = readPublicEnv as jest.Mock;

const enabledFlags = {
  ...DEFAULT_FEATURE_FLAGS,
  contributionTextEnabled: true,
  learnEnabled: true,
};

describe('contributionApi', () => {
  beforeEach(async () => {
    setRuntimeFeatureFlags(enabledFlags);
    mockReadPublicEnv.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      authConfigured: true,
    });
    globalThis.fetch = jest.fn() as typeof fetch;
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { access_token: 'tok' } },
        })),
      },
    });
    await saveLocalConsent(true);
  });

  test('disabled flag blocks network without requiring sign-in', async () => {
    setRuntimeFeatureFlags({ ...enabledFlags, contributionTextEnabled: false });
    const result = await fetchNextContribution({
      signedIn: true,
      authConfigured: true,
    });
    expect(result).toEqual({ ok: false, reason: 'disabled' });
  });

  test('fetchNextContribution returns assignment on success', async () => {
    const assignment = {
      public_task_id: 'task-1',
      assignment_id: 'assign-1',
      source_text: 'hi',
      model_output: 'नमस्ते',
      direction: 'en-ne',
      formality: 'formal',
      script: 'deva',
      reward_label: 'Earn credits',
    };
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ assignment }),
    });

    const result = await fetchNextContribution({
      signedIn: true,
      authConfigured: true,
    });
    expect(result).toEqual({ ok: true, assignment });
  });

  test('fetchNextContribution maps server consent and age errors', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 'consent_required' } }),
    });
    expect(
      await fetchNextContribution({ signedIn: true, authConfigured: true }),
    ).toEqual({ ok: false, reason: 'consent' });

    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 'age_required' } }),
    });
    expect(
      await fetchNextContribution({ signedIn: true, authConfigured: true }),
    ).toEqual({ ok: false, reason: 'age' });
  });

  test('fetchNextContribution maps consent_outdated to consent', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: 'consent_outdated' } }),
    });
    expect(
      await fetchNextContribution({ signedIn: true, authConfigured: true }),
    ).toEqual({ ok: false, reason: 'consent' });
  });

  test('fetchNextContribution requires sign-in before network', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null } })),
      },
    });
    expect(
      await fetchNextContribution({ signedIn: true, authConfigured: true }),
    ).toEqual({ ok: false, reason: 'sign_in' });
  });

  test('fetchNextContribution gates on local consent version', async () => {
    await saveLocalConsent(false);
    expect(
      await fetchNextContribution({ signedIn: true, authConfigured: true }),
    ).toEqual({ ok: false, reason: 'age' });

    await saveLocalConsent(true);
    const bad = {
      consent_version: 'old',
      age_confirmed: true,
      saved_at: new Date().toISOString(),
    };
    await AsyncStorage.setItem(
      'neptranslate.contribution_consent.v1',
      JSON.stringify(bad),
    );
    expect(
      await fetchNextContribution({ signedIn: true, authConfigured: true }),
    ).toEqual({ ok: false, reason: 'consent' });
    expect(CONTRIBUTION_CONSENT_VERSION).toBeTruthy();
  });

  test('submitContribution rejects empty edit text', async () => {
    const result = await submitContribution({
      signedIn: true,
      authConfigured: true,
      assignmentId: 'a1',
      action: 'edit',
      responseText: '   ',
      idempotencyKey: 'idem-1',
    });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  test('submitContribution returns receipt on success', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        receipt_id: 'rec-1',
        status: 'received',
        reward_label: 'Earn 3 credits',
      }),
    });

    const result = await submitContribution({
      signedIn: true,
      authConfigured: true,
      assignmentId: 'a1',
      action: 'looks_correct',
      idempotencyKey: 'idem-1',
    });
    expect(result).toEqual({
      ok: true,
      receipt_id: 'rec-1',
      status: 'received',
      reward_label: 'Earn 3 credits',
    });
  });

  test('submitContribution maps lease_expired and rate_limited', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: 'lease_expired' } }),
    });
    expect(
      await submitContribution({
        signedIn: true,
        authConfigured: true,
        assignmentId: 'a1',
        action: 'skip',
        idempotencyKey: 'idem-1',
      }),
    ).toEqual({ ok: false, reason: 'lease_expired' });

    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: 'rate_limited' } }),
    });
    expect(
      await submitContribution({
        signedIn: true,
        authConfigured: true,
        assignmentId: 'a1',
        action: 'skip',
        idempotencyKey: 'idem-2',
      }),
    ).toEqual({ ok: false, reason: 'rate_limited' });
  });

  test('newIdempotencyKey returns unique contrib-prefixed keys', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toMatch(/^contrib_/);
    expect(b).toMatch(/^contrib_/);
    expect(a).not.toBe(b);
  });
});
