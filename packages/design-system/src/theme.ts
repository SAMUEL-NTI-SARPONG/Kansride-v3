import { colors } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 36, fontWeight: '800' as const, lineHeight: 42, letterSpacing: -1.1 },
  h1: { fontSize: 30, fontWeight: '800' as const, lineHeight: 36, letterSpacing: -0.7 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 31, letterSpacing: -0.35 },
  h3: { fontSize: 19, fontWeight: '700' as const, lineHeight: 26, letterSpacing: -0.15 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyBold: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  small: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700' as const, lineHeight: 18, letterSpacing: 0.2 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '700' as const, lineHeight: 22, letterSpacing: 0.1 },
} as const;

export const shadows = {
  sm: { shadowColor: '#263D38', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 5, elevation: 2 },
  md: { shadowColor: '#263D38', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 5 },
  lg: { shadowColor: '#263D38', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 9 },
} as const;

export const borders = {
  thin: 1,
  regular: 1.5,
  strong: 2,
} as const;

export const layout = {
  screenPadding: 20,
  minTouchTarget: 48,
  bottomTabContentHeight: 64,
} as const;

export const theme = { colors, spacing, borderRadius, typography, shadows, borders, layout } as const;
export type Theme = typeof theme;
