/**
 * NepTranslate design tokens — crimson/saffron brand, mint conversation surface.
 * ThemeProvider + useTheme() drive light/dark from system Appearance when
 * app.json userInterfaceStyle is automatic.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  bg: string;
  surface: string;
  text: string;
  textSecondary: string;
  textPlaceholder: string;
  blue: string;
  blueSoft: string;
  pasteBg: string;
  divider: string;
  star: string;
  mintBg: string;
  mintCard: string;
  forest: string;
  forestSoft: string;
  danger: string;
  crimson: string;
  saffron: string;
  /** Focus ring / selected control outline */
  focus: string;
  /** Error surface (banner / field) */
  errorBg: string;
  errorBorder: string;
  errorText: string;
  /** Sentence highlight on camera / overlay */
  sentenceHighlight: string;
  sentenceHighlightSoft: string;
  bannerInfoBg: string;
  bannerInfoBorder: string;
  bannerWarnBg: string;
  bannerWarnBorder: string;
  bannerOfflineBg: string;
  bannerOfflineBorder: string;
  onPrimary: string;
};

export type ThemeTypography = {
  title: { fontSize: number; fontWeight: '600' | '700'; lineHeight: number };
  body: { fontSize: number; fontWeight: '400' | '500'; lineHeight: number };
  caption: { fontSize: number; fontWeight: '400' | '600'; lineHeight: number };
  label: { fontSize: number; fontWeight: '700' | '800'; letterSpacing: number };
  glyph: { fontSize: number; fontWeight: '700'; lineHeight: number };
};

export type ThemeSpacing = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type ThemeRadii = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
};

export type ThemeElevation = {
  none: { elevation: number; shadowOpacity: number };
  card: {
    elevation: number;
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
  };
};

export type AppTheme = {
  scheme: ColorScheme;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
  elevation: ThemeElevation;
  focus: { ringWidth: number; ringColor: string };
  error: { bg: string; border: string; text: string };
  sentenceHighlight: { fill: string; soft: string };
};

const lightColors: ThemeColors = {
  bg: '#F7F1EA',
  surface: '#FFFFFF',
  text: '#1A1410',
  textSecondary: '#6B5E55',
  textPlaceholder: '#9A8D84',
  blue: '#1A73E8',
  blueSoft: '#D2E3FC',
  pasteBg: '#F3E6D8',
  divider: '#E8DDD2',
  star: '#E8A317',
  mintBg: '#E8F2EC',
  mintCard: '#FFFFFF',
  forest: '#0D652D',
  forestSoft: '#C4E7D4',
  danger: '#D93025',
  crimson: '#C8102E',
  saffron: '#E8A317',
  focus: '#C8102E',
  errorBg: '#FEE2E2',
  errorBorder: '#FECACA',
  errorText: '#D93025',
  sentenceHighlight: '#E8A317',
  sentenceHighlightSoft: 'rgba(232, 163, 23, 0.28)',
  bannerInfoBg: '#E8F2EC',
  bannerInfoBorder: '#C4E7D4',
  bannerWarnBg: '#FFF4E0',
  bannerWarnBorder: '#F5D48A',
  bannerOfflineBg: '#F3E6D8',
  bannerOfflineBorder: '#E8DDD2',
  onPrimary: '#FFFFFF',
};

const darkColors: ThemeColors = {
  bg: '#1A1410',
  surface: '#2A221C',
  text: '#F7F1EA',
  textSecondary: '#C4B5A8',
  textPlaceholder: '#8A7B70',
  blue: '#8AB4F8',
  blueSoft: '#1E3A5F',
  pasteBg: '#3A2F28',
  divider: '#3F342C',
  star: '#E8A317',
  mintBg: '#1A2E24',
  mintCard: '#2A221C',
  forest: '#81C995',
  forestSoft: '#1E3B2C',
  danger: '#F28B82',
  crimson: '#E85A6B',
  saffron: '#E8A317',
  focus: '#E8A317',
  errorBg: '#3B1C1C',
  errorBorder: '#7F1D1D',
  errorText: '#F28B82',
  sentenceHighlight: '#E8A317',
  sentenceHighlightSoft: 'rgba(232, 163, 23, 0.35)',
  bannerInfoBg: '#1A2E24',
  bannerInfoBorder: '#2A4A38',
  bannerWarnBg: '#3A2E14',
  bannerWarnBorder: '#6B5420',
  bannerOfflineBg: '#3A2F28',
  bannerOfflineBorder: '#3F342C',
  onPrimary: '#FFFFFF',
};

/** @deprecated Prefer getTheme(scheme).colors or useTheme().colors — kept for existing StyleSheets. */
export const colors = lightColors;

export const typography: ThemeTypography = {
  title: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  glyph: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
};

export const spacing: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 32,
};

export const radii: ThemeRadii = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 999,
};

function elevationFor(scheme: ColorScheme): ThemeElevation {
  const shadow = scheme === 'dark' ? '#000000' : '#1A1410';
  return {
    none: { elevation: 0, shadowOpacity: 0 },
    card: {
      elevation: 2,
      shadowColor: shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: scheme === 'dark' ? 0.4 : 0.08,
      shadowRadius: 3,
    },
  };
}

function resolveScheme(scheme: ColorSchemeName | null | undefined): ColorScheme {
  return scheme === 'dark' ? 'dark' : 'light';
}

export function getTheme(scheme: ColorScheme | ColorSchemeName | null | undefined): AppTheme {
  const resolved = resolveScheme(scheme);
  const c = resolved === 'dark' ? darkColors : lightColors;
  return {
    scheme: resolved,
    colors: c,
    typography,
    spacing,
    radii,
    elevation: elevationFor(resolved),
    focus: { ringWidth: 2, ringColor: c.focus },
    error: { bg: c.errorBg, border: c.errorBorder, text: c.errorText },
    sentenceHighlight: { fill: c.sentenceHighlight, soft: c.sentenceHighlightSoft },
  };
}

type ThemeContextValue = {
  theme: AppTheme;
  setScheme: (scheme: ColorScheme | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Optional override. When omitted, follows system Appearance.
 * Pass scheme={null} to clear an override and track the system again.
 */
export function ThemeProvider({
  children,
  scheme: forcedScheme,
}: {
  children: ReactNode;
  scheme?: ColorScheme | null;
}) {
  const [override, setOverride] = useState<ColorScheme | null>(
    forcedScheme === undefined ? null : forcedScheme,
  );
  const [system, setSystem] = useState<ColorScheme>(() =>
    resolveScheme(Appearance.getColorScheme()),
  );

  useEffect(() => {
    if (forcedScheme !== undefined) {
      setOverride(forcedScheme);
    }
  }, [forcedScheme]);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(resolveScheme(colorScheme));
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const active = override ?? system;
    return {
      theme: getTheme(active),
      setScheme: (next) => setOverride(next),
    };
  }, [override, system]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Active theme from ThemeProvider, or system Appearance when no provider. */
export function useTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  const [system, setSystem] = useState<ColorScheme>(() =>
    resolveScheme(Appearance.getColorScheme()),
  );

  useEffect(() => {
    if (ctx) return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(resolveScheme(colorScheme));
    });
    return () => sub.remove();
  }, [ctx]);

  if (ctx) return ctx.theme;
  return getTheme(system);
}

export function useThemeControls(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  const theme = useTheme();
  if (ctx) return ctx;
  return {
    theme,
    setScheme: () => undefined,
  };
}
