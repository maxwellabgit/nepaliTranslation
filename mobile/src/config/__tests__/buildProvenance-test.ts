import { readBuildProvenance, formatBuildProvenance } from '../buildProvenance';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.7.0',
      ios: { buildNumber: '35' },
      extra: {
        ads: { env: 'test' },
        gitSha: 'abcdef1234567890abcdef1234567890abcdef12',
        releaseChannel: 'testflight-internal',
      },
    },
    nativeBuildVersion: '35',
  },
}));

describe('readBuildProvenance', () => {
  it('summarizes version / build / git / channel / ads / model', () => {
    const p = readBuildProvenance();
    expect(p.appVersion).toBe('1.7.0');
    expect(p.buildNumber).toBe('35');
    expect(p.gitShaShort).toBe('abcdef1');
    expect(p.releaseChannel).toBe('testflight-internal');
    expect(p.adsEnv).toBe('test');
    // model manifest ships real IT2 revisions; the short form is 7 chars.
    expect(p.modelEnIndicRevisionShort).toHaveLength(7);
    expect(p.modelIndicEnRevisionShort).toHaveLength(7);
    expect(p.modelFamily).toMatch(/IndicTrans2-dist-200M/);
  });

  it('formats a one-line diagnostic string with no secrets', () => {
    const line = formatBuildProvenance(readBuildProvenance());
    expect(line).toMatch(/^v1\.7\.0 \(35\) · testflight-internal · ads:test · git:abcdef1 · model:[0-9a-f]{7}\/[0-9a-f]{7}$/);
  });
});
