import { isHttpsUrl, readLegalPublicUrls } from '../legalUrls';

describe('readLegalPublicUrls', () => {
  test('returns empty strings when env and extra are unset', () => {
    const urls = readLegalPublicUrls({});
    expect(urls.privacyPolicyUrl).toBe('');
    expect(urls.termsOfServiceUrl).toBe('');
    expect(urls.supportUrl).toBe('');
    expect(urls.deletionInfoUrl).toBe('');
    expect(urls.appAdsTxtUrl).toBe('');
  });

  test('reads EXPO_PUBLIC legal URLs when provided', () => {
    const urls = readLegalPublicUrls({
      EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://example.com/privacy',
      EXPO_PUBLIC_TERMS_OF_SERVICE_URL: 'https://example.com/terms',
      EXPO_PUBLIC_SUPPORT_URL: 'https://example.com/support',
      EXPO_PUBLIC_DELETION_INFO_URL: 'https://example.com/delete',
      EXPO_PUBLIC_APP_ADS_TXT_URL: 'https://example.com/app-ads.txt',
    });
    expect(urls.privacyPolicyUrl).toBe('https://example.com/privacy');
    expect(urls.termsOfServiceUrl).toBe('https://example.com/terms');
    expect(urls.supportUrl).toBe('https://example.com/support');
    expect(urls.deletionInfoUrl).toBe('https://example.com/delete');
    expect(urls.appAdsTxtUrl).toBe('https://example.com/app-ads.txt');
  });

  test('isHttpsUrl accepts only https', () => {
    expect(isHttpsUrl('https://example.com/a')).toBe(true);
    expect(isHttpsUrl('http://example.com/a')).toBe(false);
    expect(isHttpsUrl('not a url')).toBe(false);
  });
});
