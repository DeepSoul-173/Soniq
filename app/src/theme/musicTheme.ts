import { Platform } from 'react-native';
import { AppSettings, AppearanceSkin } from '@/src/store/settingsStore';

export const ACCENT_OPTIONS = [
  { label: 'Pulse', value: '#FF2A70' },
  { label: 'Signal', value: '#18D8A7' },
  { label: 'Solar', value: '#FFB84D' },
  { label: 'Skyline', value: '#58A6FF' },
] as const;

// ─── Aesthetic skins ─────────────────────────────────────────────────────────
// Each skin is a complete visual identity. 'luxe' (Onyx & Ivory) is the default —
// quiet luxury, near-black/warm-cream with a single restrained champagne accent.
// 'sakura' is a dreamy anime night/day with soft pinks and lavender. 'classic'
// keeps neutral surfaces and honours the user-chosen accent colour.

export const SKIN_OPTIONS: {
  value: AppearanceSkin;
  label: string;
  blurb: string;
  previewBg: string;
  previewAccent: string;
}[] = [
  { value: 'luxe', label: 'Onyx & Ivory', blurb: 'Quiet luxury — ink, cream & champagne', previewBg: '#0B0B0D', previewAccent: '#C8A96A' },
  { value: 'sakura', label: 'Sakura', blurb: 'Dreamy anime night — soft pink & lavender', previewBg: '#14121F', previewAccent: '#F5A9C4' },
  { value: 'classic', label: 'Classic', blurb: 'Neutral surfaces with your accent colour', previewBg: '#08090B', previewAccent: '#FF2A70' },
];

export interface ThemePalette {
  isLight: boolean;
  accent: string;
  background: string;
  surface: string;
  elevated: string;
  muted: string;
  text: string;
  secondaryText: string;
  faintText: string;
  border: string;
  overlay: string;
  gradient: readonly [string, string, string];
}

// Weighted, "settled" motion — luxury animation has mass: slow in, gentle settle.
// Components feed `MOTION.spring` to reanimated withSpring, or build an easing
// from `easeOutBezier`. Kept as plain data so this file stays dependency-light.
export const MOTION = {
  spring: { damping: 18, stiffness: 140, mass: 1 },
  springSoft: { damping: 24, stiffness: 90, mass: 1.1 },
  durationFast: 240,
  duration: 420,
  durationSlow: 640,
  easeOutBezier: [0.16, 1, 0.3, 1] as const, // a confident "settle" curve
};

// Editorial typography. A serif for display/titles is what makes a screen feel
// like a magazine instead of an app. We use the platform serif (Georgia on iOS,
// Noto/Droid Serif on Android) so it works with zero bundled font assets.
export const FONTS = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string,
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string,
};

const PALETTES: Record<string, ThemePalette> = {
  // ── Luxe: Onyx (dark) & Ivory (light) ──
  luxe_dark: {
    isLight: false,
    accent: '#C8A96A', // champagne — used on <5% of the screen
    background: '#0B0B0D',
    surface: '#141416',
    elevated: '#1C1C1F',
    muted: '#242427',
    text: '#F4F1EA', // warm ivory, never pure white
    secondaryText: '#9A968C',
    faintText: '#6E6B63',
    border: 'rgba(244, 241, 234, 0.08)',
    overlay: 'rgba(11, 11, 13, 0.90)',
    gradient: ['#1A1612', '#0B0B0D', '#0B0B0D'],
  },
  luxe_light: {
    isLight: true,
    accent: '#B8923E', // deeper champagne for contrast on cream
    background: '#F4F1EA', // warm cream, never pure white
    surface: '#FBF9F4',
    elevated: '#EDE9DF',
    muted: '#E4DFD3',
    text: '#1A1813', // warm ink
    secondaryText: '#6B6557',
    faintText: '#918B7C',
    border: 'rgba(26, 24, 19, 0.10)',
    overlay: 'rgba(244, 241, 234, 0.90)',
    gradient: ['#FBF6EA', '#F4F1EA', '#F4F1EA'],
  },
  // ── Sakura: dreamy anime night & day ──
  sakura_dark: {
    isLight: false,
    accent: '#F5A9C4', // soft sakura pink
    background: '#14121F', // deep plum-navy night
    surface: '#1D1A2E',
    elevated: '#262138',
    muted: '#322B47',
    text: '#F3EEFA',
    secondaryText: '#B5AED0',
    faintText: '#7E789A',
    border: 'rgba(243, 238, 250, 0.09)',
    overlay: 'rgba(20, 18, 31, 0.90)',
    gradient: ['#2A1F3D', '#1A1530', '#14121F'], // dreamy night sky
  },
  sakura_light: {
    isLight: true,
    accent: '#E87FA8', // sakura pink, deeper for light contrast
    background: '#FBF1F6', // soft pink-cream
    surface: '#FFF7FB',
    elevated: '#FCEAF2',
    muted: '#F6DDE9',
    text: '#2E2433', // soft plum-ink
    secondaryText: '#7A6B82',
    faintText: '#A99BB0',
    border: 'rgba(46, 36, 51, 0.08)',
    overlay: 'rgba(251, 241, 246, 0.90)',
    gradient: ['#FDEAF3', '#F3ECFB', '#FBF1F6'], // pastel pink → lavender
  },
};

export const GENRE_OPTIONS = [
  'Pop', 'Hip-Hop', 'Bollywood', 'Indie', 'Lo-Fi', 'Devotional',
  'Electronic', 'Acoustic', 'Rock', 'Focus', 'Ambient', 'Classical',
  'Jazz', 'R&B', 'Metal', 'Chill',
];

export const LANGUAGE_OPTIONS = [
  'English', 'Hindi', 'Punjabi', 'Tamil', 'Telugu',
  'Malayalam', 'Kannada', 'Bengali', 'Marathi',
];

export const SUGGESTED_ARTISTS = [
  'The Weeknd', 'Taylor Swift', 'Drake', 'Billie Eilish', 'Travis Scott',
  'Arijit Singh', 'Anirudh Ravichander', 'Shreya Ghoshal', 'Sid Sriram',
  'A.R. Rahman', 'Dua Lipa', 'Post Malone', 'Kendrick Lamar', 'Coldplay',
  'Radiohead', 'Pritam', 'Atif Aslam', 'K.K.', 'Shankar-Ehsaan-Loy',
];

export const MINI_PLAYER_HEIGHT = 72;
export const MINI_PLAYER_TAB_GAP = 8;
export const TAB_BAR_HEIGHT = 64;
export const PLAYER_DOCK_HEIGHT = TAB_BAR_HEIGHT + MINI_PLAYER_TAB_GAP + MINI_PLAYER_HEIGHT + 16;

export function getTabBarHeight(bottomInset: number) {
  return TAB_BAR_HEIGHT + Math.max(bottomInset, 8);
}

export function getMiniPlayerBottomOffset(bottomInset: number) {
  return getTabBarHeight(bottomInset) + MINI_PLAYER_TAB_GAP;
}

export function getPlayerDockHeight(bottomInset: number) {
  return getMiniPlayerBottomOffset(bottomInset) + MINI_PLAYER_HEIGHT + 16;
}

function classicPalette(isLight: boolean, accent: string): ThemePalette {
  return {
    isLight,
    accent,
    background: isLight ? '#F8F8F6' : '#08090B',
    surface: isLight ? '#FFFFFF' : '#121418',
    elevated: isLight ? '#F0F1ED' : '#1A1D23',
    muted: isLight ? '#ECEDE9' : '#242831',
    text: isLight ? '#101114' : '#FFFFFF',
    secondaryText: isLight ? '#60646D' : '#A7ADB8',
    faintText: isLight ? '#858A94' : '#737985',
    border: isLight ? 'rgba(16, 17, 20, 0.08)' : 'rgba(255, 255, 255, 0.08)',
    overlay: isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(8, 9, 11, 0.88)',
    gradient: isLight ? ['#FFF2F6', '#F8F8F6', '#F8F8F6'] : ['#2A111E', '#08090B', '#08090B'],
  };
}

/** The effective accent colour for the active skin (skins define their own;
 *  only 'classic' honours the user-picked accentColor). */
export function getAccent(settings: AppSettings): string {
  const skin: AppearanceSkin = settings.appearanceSkin ?? 'luxe';
  const isLight = settings.theme === 'light';
  if (skin === 'luxe') return isLight ? '#B8923E' : '#C8A96A';
  if (skin === 'sakura') return isLight ? '#E87FA8' : '#F5A9C4';
  return settings.accentColor || ACCENT_OPTIONS[0].value;
}

export function getTheme(settings: AppSettings): ThemePalette {
  const isLight = settings.theme === 'light'; // 'system' currently resolves to dark
  const skin: AppearanceSkin = settings.appearanceSkin ?? 'luxe';

  if (skin === 'classic') return classicPalette(isLight, getAccent(settings));
  return PALETTES[`${skin}_${isLight ? 'light' : 'dark'}`] ?? PALETTES.luxe_dark;
}
