import { Appearance } from 'react-native';
import { getTheme, colors } from '../theme';

describe('theme tokens', () => {
  test('light theme keeps crimson/saffron brand and semantic extras', () => {
    const theme = getTheme('light');
    expect(theme.scheme).toBe('light');
    expect(theme.colors.crimson).toBe('#C8102E');
    expect(theme.colors.saffron).toBe('#E8A317');
    expect(theme.colors.bg).toBe(colors.bg);
    expect(theme.focus.ringColor).toBe(theme.colors.focus);
    expect(theme.error.text).toBe(theme.colors.errorText);
    expect(theme.sentenceHighlight.fill).toBe(theme.colors.sentenceHighlight);
    expect(theme.spacing.md).toBe(12);
    expect(theme.radii.xl).toBe(16);
    expect(theme.typography.title.fontSize).toBe(18);
    expect(theme.elevation.card.elevation).toBeGreaterThan(0);
  });

  test('dark theme resolves distinct surfaces while keeping brand accents', () => {
    const theme = getTheme('dark');
    expect(theme.scheme).toBe('dark');
    expect(theme.colors.bg).not.toBe(colors.bg);
    expect(theme.colors.surface).not.toBe(colors.surface);
    expect(theme.colors.text).not.toBe(colors.text);
    expect(theme.colors.crimson.length).toBeGreaterThan(0);
    expect(theme.colors.saffron).toBe('#E8A317');
    expect(theme.sentenceHighlight.soft).toContain('232, 163, 23');
  });

  test('null / undefined scheme resolve to light; dark is explicit', () => {
    expect(getTheme(null).scheme).toBe('light');
    expect(getTheme(undefined).scheme).toBe('light');
    expect(getTheme('dark').scheme).toBe('dark');
    expect(['light', 'dark', null]).toContain(Appearance.getColorScheme());
  });
});
