export type PremiumThemeMode = 'dark' | 'light' | 'system';

export const premiumDark = {
  mode: 'dark' as const,
  bg: '#070A12',
  bg2: '#0E1422',
  surface: '#121A29',
  surface2: '#182235',
  surface3: '#233048',
  border: 'rgba(239,232,211,0.10)',
  borderStrong: 'rgba(239,232,211,0.20)',
  text: '#F8F2E7',
  textMuted: '#B8C0CF',
  textSoft: '#E4E9F1',
  primary: '#8BE3B2',
  primaryDeep: '#2F7657',
  accent: '#A9BCFF',
  gold: '#F5CC72',
  rose: '#F08CA0',
  violet: '#C5A3FF',
  cyan: '#77DDE7',
  coral: '#FF9E82',
  emerald: '#8BE3B2',
  danger: '#F9707D',
  success: '#8BE3B2',
  warning: '#F5CC72',
  glow: 'rgba(139,227,178,0.22)',
  glowBlue: 'rgba(169,188,255,0.18)',
  cardShadow: 'rgba(0,0,0,0.36)',
  heroGradient: ['#1B1432', '#0D2330', '#070A12'] as const,
  cardGradient: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.025)'] as const,
  buttonGradient: ['#54B884', '#2F7657'] as const,
  accentGradient: ['#A9BCFF', '#8BE3B2'] as const,
  sunriseGradient: ['#F5CC72', '#FF9E82', '#C5A3FF'] as const,
  oceanGradient: ['#77DDE7', '#A9BCFF', '#8BE3B2'] as const,
  royalGradient: ['#2F7657', '#435EA8', '#1B1432'] as const,
};

export const premiumLight = {
  mode: 'light' as const,
  bg: '#F8F3EA',
  bg2: '#EEE6D8',
  surface: '#FFFDF8',
  surface2: '#F2ECDF',
  surface3: '#E4DAC8',
  border: 'rgba(32,38,51,0.11)',
  borderStrong: 'rgba(32,38,51,0.20)',
  text: '#18212F',
  textMuted: '#657081',
  textSoft: '#334155',
  primary: '#2F7657',
  primaryDeep: '#21583F',
  accent: '#435EA8',
  gold: '#A97422',
  rose: '#B94E62',
  violet: '#7651B8',
  cyan: '#167A87',
  coral: '#B85A43',
  emerald: '#2F7657',
  danger: '#B42335',
  success: '#2F7657',
  warning: '#A97422',
  glow: 'rgba(47,118,87,0.16)',
  glowBlue: 'rgba(67,94,168,0.12)',
  cardShadow: 'rgba(32,38,51,0.13)',
  heroGradient: ['#FFF0D7', '#E6F7F4', '#F8F3EA'] as const,
  cardGradient: ['rgba(255,255,255,0.98)', 'rgba(241,236,224,0.82)'] as const,
  buttonGradient: ['#3A8E66', '#21583F'] as const,
  accentGradient: ['#435EA8', '#2F7657'] as const,
  sunriseGradient: ['#F4C567', '#E88468', '#9170C9'] as const,
  oceanGradient: ['#5FB9C2', '#7387D7', '#3A8E66'] as const,
  royalGradient: ['#21583F', '#435EA8', '#30214F'] as const,
};

export type PremiumTheme = typeof premiumDark;

export function getPremiumTheme(mode: PremiumThemeMode = 'dark', systemScheme: 'dark' | 'light' | null | undefined = 'dark') {
  const resolved = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  return resolved === 'light' ? premiumLight : premiumDark;
}

export const premium = premiumDark;

export const premiumRadii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
};

export const premiumSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  xxl: 42,
};

export const premiumType = {
  eyebrow: { fontSize: 11, letterSpacing: 1.4, fontWeight: '900' as const },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '900' as const, letterSpacing: -0.4 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '900' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 25, fontWeight: '400' as const },
  small: { fontSize: 13, lineHeight: 19, fontWeight: '600' as const },
};

export const premiumCard = {
  backgroundColor: premium.surface,
  borderColor: premium.border,
  borderWidth: 1,
  borderRadius: '$6',
};

export const premiumHeaderTitle = {
  color: premium.text,
  fontWeight: '900' as const,
  letterSpacing: -0.6,
};
