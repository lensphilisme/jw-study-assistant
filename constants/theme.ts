// ============================================================
// Codex Design System — JW Study Assistant
// Editorial / Devotional aesthetic: parchment & ink, sage moss, copper
// ============================================================
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  // Surfaces
  bg: string;            // app background
  bgInverse: string;
  surface: string;       // card surface
  surfaceAlt: string;    // alternate surface
  surfaceRaised: string; // elevated card
  border: string;
  borderStrong: string;

  // Text
  ink: string;           // primary text
  inkMuted: string;
  inkSubtle: string;
  inkInverse: string;

  // Brand
  moss: string;          // sage moss (primary)
  mossSoft: string;      // tinted bg
  mossBorder: string;
  copper: string;        // accent (warm)
  copperSoft: string;
  copperBorder: string;
  amber: string;         // alert/warm
  rose: string;          // destructive

  // Effect
  parchment: string;     // hero accent fill
  shadow: string;
}

export const lightTheme: ThemeTokens = {
  bg:           '#F4ECD7',   // parchment
  bgInverse:    '#0E1224',
  surface:      '#FBF4DF',
  surfaceAlt:   '#EFE5C8',
  surfaceRaised:'#FFFCEF',
  border:       '#D9CCA3',
  borderStrong: '#B8A87A',
  ink:          '#1B1F36',
  inkMuted:     '#4A4F6A',
  inkSubtle:    '#7C7A66',
  inkInverse:   '#FBF4DF',
  moss:         '#4A6B57',
  mossSoft:     'rgba(74,107,87,0.12)',
  mossBorder:   'rgba(74,107,87,0.30)',
  copper:       '#B8753C',
  copperSoft:   'rgba(184,117,60,0.12)',
  copperBorder: 'rgba(184,117,60,0.30)',
  amber:        '#C28840',
  rose:         '#A33B45',
  parchment:    '#E8DBB0',
  shadow:       'rgba(27,31,54,0.10)',
};

export const darkTheme: ThemeTokens = {
  bg:           '#0E1224',   // midnight ink
  bgInverse:    '#F4ECD7',
  surface:      '#161C36',
  surfaceAlt:   '#1E2541',
  surfaceRaised:'#1A2040',
  border:       'rgba(244,236,215,0.10)',
  borderStrong: 'rgba(244,236,215,0.22)',
  ink:          '#F4ECD7',   // warm parchment text
  inkMuted:     '#B5B3A0',
  inkSubtle:    '#7C7A66',
  inkInverse:   '#0E1224',
  moss:         '#7DA88E',
  mossSoft:     'rgba(125,168,142,0.16)',
  mossBorder:   'rgba(125,168,142,0.35)',
  copper:       '#DC9F62',
  copperSoft:   'rgba(220,159,98,0.14)',
  copperBorder: 'rgba(220,159,98,0.32)',
  amber:        '#E8B069',
  rose:         '#E27583',
  parchment:    '#2B2F4D',
  shadow:       'rgba(0,0,0,0.40)',
};

export const fonts = {
  display: Platform.select({
    web: '"Fraunces", "Newsreader", Georgia, serif',
    default: 'Georgia',
  }) as string,
  mono: Platform.select({
    web: '"JetBrains Mono", "Geist Mono", "SF Mono", Menlo, monospace',
    default: 'Menlo',
  }) as string,
  body: Platform.select({
    web: '"Inter Tight", "Inter", -apple-system, system-ui, sans-serif',
    default: 'System',
  }) as string,
};

// ── Theme store ──────────────────────────────────────────────
interface ThemeState {
  mode: ThemeMode;
  t: ThemeTokens;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: 'dark',
  t: darkTheme,
  toggle: () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    set({ mode: next, t: next === 'dark' ? darkTheme : lightTheme });
    AsyncStorage.setItem('jw_sa:theme_mode', next).catch(() => {});
  },
  setMode: (mode) => {
    set({ mode, t: mode === 'dark' ? darkTheme : lightTheme });
    AsyncStorage.setItem('jw_sa:theme_mode', mode).catch(() => {});
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem('jw_sa:theme_mode');
      if (raw === 'light' || raw === 'dark') {
        set({ mode: raw, t: raw === 'dark' ? darkTheme : lightTheme });
      }
    } catch {}
  },
}));
