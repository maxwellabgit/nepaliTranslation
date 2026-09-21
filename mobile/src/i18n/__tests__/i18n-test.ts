import { t } from '../index';

describe('i18n catalogs', () => {
  test('returns English for secondary-surface keys by default', () => {
    expect(t('history.emptyTitle')).toBe('No translations yet');
    expect(t('settings.title', 'en')).toBe('Settings');
    expect(t('contributions.offlineBanner', 'en')).toContain('offline');
  });

  test('returns Nepali for a few keys (तिमी register, not तँ)', () => {
    expect(t('history.emptyTitle', 'ne')).toBe('अहिलेसम्म अनुवाद छैन');
    expect(t('common.offline', 'ne')).toBe('तिमी अफलाइन छौ');
    expect(t('common.offline', 'ne')).not.toContain('तँ');
    expect(t('learn.noVoiceDetail', 'ne')).toContain('तिमी');
    expect(t('contributions.emptyTitle', 'ne')).toBe('अहिलेसम्म योगदान छैन');
    expect(t('settings.title', 'ne')).toBe('सेटिङ');
  });
});
