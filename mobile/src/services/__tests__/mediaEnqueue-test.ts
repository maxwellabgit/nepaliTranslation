import {
  canUploadContributionMedia,
  CONTRIBUTION_CONSENT_VERSION,
} from '../../features/auth/consent';
import {
  setRuntimeFeatureFlags,
  DEFAULT_FEATURE_FLAGS,
} from '../../app/featureFlags';
import { enqueueEligibleMedia, enqueueEligibleSpeechRecording } from '../mediaEnqueue';
import { setSharingTogglesForTests } from '../../storage/sharingToggles';

const mockLoadLocalConsent = jest.fn();
const mockEnqueueMediaItem = jest.fn();

jest.mock('../../storage/contributionConsent', () => ({
  loadLocalConsent: (...args: unknown[]) => mockLoadLocalConsent(...args),
}));

jest.mock('../../storage/mediaOutbox', () => ({
  ...jest.requireActual('../../storage/mediaOutbox'),
  enqueueMediaItem: (...args: unknown[]) => mockEnqueueMediaItem(...args),
  newMediaIdempotencyKey: () => 'test-media-key',
}));

jest.mock('expo-file-system', () => {
  class FakeFile {
    uri: string;
    exists = true;
    size = 2048;
    constructor(a: unknown, b?: string) {
      if (typeof a === 'string') this.uri = a;
      else this.uri = `file:///documents/${b ?? 'x'}`;
    }
    copy(dest: { uri: string }) {
      dest.uri = `${this.uri}.copied`;
    }
  }
  class FakeDirectory {
    exists = false;
    create() {
      this.exists = true;
    }
  }
  return {
    File: FakeFile,
    Directory: FakeDirectory,
    Paths: { document: 'file:///documents' },
  };
});

describe('mediaEnqueue gates', () => {
  beforeEach(() => {
    mockLoadLocalConsent.mockResolvedValue({
      consent_version: CONTRIBUTION_CONSENT_VERSION,
      age_confirmed: true,
      saved_at: new Date().toISOString(),
    });
    mockEnqueueMediaItem.mockImplementation(async (input: Record<string, unknown>) => ({
      id: 'media_test',
      status: 'queued',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...input,
    }));
    setSharingTogglesForTests({ speech: false, photos: false });
    setRuntimeFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      learnEnabled: true,
      contributionPhotosEnabled: true,
      contributionSpeechEnabled: true,
    });
  });

  test('guests enqueue nothing', async () => {
    const result = await enqueueEligibleMedia({
      kind: 'photo',
      sourceUri: 'file:///tmp/cam.jpg',
      signedIn: false,
      authConfigured: true,
    });
    expect(result).toBeNull();
    expect(mockEnqueueMediaItem).not.toHaveBeenCalled();
  });

  test('photos flag-off enqueues nothing', async () => {
    setRuntimeFeatureFlags({
      ...DEFAULT_FEATURE_FLAGS,
      learnEnabled: true,
      contributionPhotosEnabled: false,
      contributionSpeechEnabled: true,
    });
    const result = await enqueueEligibleMedia({
      kind: 'photo',
      sourceUri: 'file:///tmp/cam.jpg',
      signedIn: true,
      authConfigured: true,
    });
    expect(result).toBeNull();
  });

  test('sharing toggle off enqueues nothing', async () => {
    const result = await enqueueEligibleMedia({
      kind: 'photo',
      sourceUri: 'file:///tmp/cam.jpg',
      signedIn: true,
      authConfigured: true,
    });
    expect(result).toBeNull();
  });

  test('consented adult with photos flag and sharing toggle enqueues', async () => {
    setSharingTogglesForTests({ speech: true, photos: true });
    const result = await enqueueEligibleMedia({
      kind: 'photo',
      sourceUri: 'file:///tmp/cam.jpg',
      signedIn: true,
      authConfigured: true,
    });
    expect(result).not.toBeNull();
    expect(mockEnqueueMediaItem).toHaveBeenCalled();
  });

  test('speech enqueue API works when a recording URI is provided', async () => {
    setSharingTogglesForTests({ speech: true, photos: false });
    const result = await enqueueEligibleSpeechRecording({
      sourceUri: 'file:///tmp/rec.m4a',
      signedIn: true,
      authConfigured: true,
      contentType: 'audio/mp4',
    });
    expect(result).not.toBeNull();
  });

  test('canUploadContributionMedia helper matches gate', () => {
    expect(
      canUploadContributionMedia({
        authConfigured: true,
        signedIn: true,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: true,
        kind: 'speech',
        speechEnabled: true,
        photosEnabled: false,
      }).ok,
    ).toBe(true);
  });
});
