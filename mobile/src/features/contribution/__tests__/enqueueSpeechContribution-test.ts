import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveStartupConsent,
  clearStartupConsent,
} from '../../../storage/startupConsent';
import { saveLocalConsent } from '../../../storage/contributionConsent';
import {
  setRuntimeFeatureFlags,
  DEFAULT_FEATURE_FLAGS,
} from '../../../app/featureFlags';
import { enqueueSpeechContribution } from '../enqueueSpeechContribution';
import { MEDIA_OUTBOX_KEY } from '../../../storage/mediaOutbox';

describe('enqueueSpeechContribution (G2 raw speech-media in V1)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setRuntimeFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      contributionTextEnabled: true,
      contributionSpeechEnabled: true,
    });
  });

  const validInput = {
    signedIn: true,
    authConfigured: true,
    localUri: 'file:///documents/audio-1.m4a',
    contentType: 'audio/m4a',
    byteSize: 12345,
  };

  test('rejects when startup consent gate has not been passed', async () => {
    await clearStartupConsent();
    await saveLocalConsent(true);
    const result = await enqueueSpeechContribution(validInput);
    expect(result).toEqual({ ok: false, reason: 'startup_gate' });
  });

  test('rejects guests even after startup consent', async () => {
    await saveStartupConsent({
      terms: true,
      privacy: true,
      age18Plus: true,
    });
    const result = await enqueueSpeechContribution({
      ...validInput,
      signedIn: false,
    });
    expect(result).toEqual({ ok: false, reason: 'guest' });
  });

  test('rejects when contribution_speech_enabled is off', async () => {
    await saveStartupConsent({
      terms: true,
      privacy: true,
      age18Plus: true,
    });
    await saveLocalConsent(true);
    setRuntimeFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      contributionTextEnabled: true,
      contributionSpeechEnabled: false,
    });
    const result = await enqueueSpeechContribution(validInput);
    expect(result).toEqual({ ok: false, reason: 'flag_off' });
  });

  test('enqueues when startup consent + media consent + flag are all on', async () => {
    await saveStartupConsent({
      terms: true,
      privacy: true,
      age18Plus: true,
    });
    await saveLocalConsent(true);
    const result = await enqueueSpeechContribution(validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.kind).toBe('speech');
    expect(result.item.local_uri).toBe(validInput.localUri);
    const raw = await AsyncStorage.getItem(MEDIA_OUTBOX_KEY);
    expect(raw).toBeTruthy();
    const items = JSON.parse(raw!) as Array<{ kind: string }>;
    expect(items.some((i) => i.kind === 'speech')).toBe(true);
  });

  test('rejects invalid inputs (empty uri or zero size)', async () => {
    await saveStartupConsent({
      terms: true,
      privacy: true,
      age18Plus: true,
    });
    await saveLocalConsent(true);
    expect(
      await enqueueSpeechContribution({ ...validInput, localUri: '' }),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(
      await enqueueSpeechContribution({ ...validInput, byteSize: 0 }),
    ).toEqual({ ok: false, reason: 'invalid' });
  });
});
