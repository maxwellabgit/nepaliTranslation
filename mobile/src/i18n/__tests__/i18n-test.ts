import { t } from '../index';

describe('i18n catalogs', () => {
  test('returns English for secondary-surface keys by default', () => {
    expect(t('history.emptyTitle')).toBe('No translations yet');
    expect(t('settings.title', 'en')).toBe('Settings');
    expect(t('contributions.offlineBanner', 'en')).toContain('offline');
    expect(t('tabs.translate', 'en')).toBe('Translate');
    expect(t('camera.allow', 'en')).toBe('Allow camera');
  });

  test('returns Nepali for a few keys (तिमी register, not तँ)', () => {
    expect(t('history.emptyTitle', 'ne')).toBe('अहिलेसम्म अनुवाद छैन');
    expect(t('common.offline', 'ne')).toBe('तिमी अफलाइन छौ');
    expect(t('common.offline', 'ne')).not.toContain('तँ');
    expect(t('learn.noVoiceDetail', 'ne')).toContain('तिमी');
    expect(t('contributions.emptyTitle', 'ne')).toBe('अहिलेसम्म योगदान छैन');
    expect(t('settings.title', 'ne')).toBe('सेटिङ');
    expect(t('tabs.learn', 'ne')).toBe('सिकाइ');
  });

  test('quality and privacy Settings copy point to Mark incorrect and on-device camera', () => {
    expect(t('settings.qualityBody', 'en')).toContain('imperfect');
    expect(t('settings.qualityBody', 'en')).toContain('Mark incorrect');
    expect(t('settings.privacyBody', 'en')).toMatch(/on this device/i);
    expect(t('settings.privacyBody', 'en')).toMatch(/not saved/i);
    expect(t('settings.qualityBody', 'ne')).toContain('Mark incorrect');
    expect(t('settings.privacyBody', 'ne')).toContain('यन्त्र');
    expect(t('settings.legalNotLive', 'en')).toMatch(/not live yet/i);
    expect(t('settings.legalNotLive', 'ne')).toContain('लाइभ');
  });

  test('interpolates params', () => {
    expect(t('learn.credits', 'en', { count: 3 })).toBe('3 credits');
    expect(t('ads.houseCopy', 'en')).toContain('App Store');
    expect(t('ads.houseCopy', 'en')).not.toContain('$0.99');
  });

  test('en and ne catalogs share the same keys', () => {
    const { en } = require('../en') as typeof import('../en');
    const { ne } = require('../ne') as typeof import('../ne');
    expect(Object.keys(ne).sort()).toEqual(Object.keys(en).sort());
  });
});
