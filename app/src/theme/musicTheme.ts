import { AppSettings } from '@/src/store/settingsStore';

export const ACCENT_OPTIONS = [
  { label: 'Pulse', value: '#FF2A70' },
  { label: 'Signal', value: '#18D8A7' },
  { label: 'Solar', value: '#FFB84D' },
  { label: 'Skyline', value: '#58A6FF' },
] as const;

export const GENRE_OPTIONS = ['Electronic', 'Indie', 'Focus', 'Rock', 'Ambient', 'Acoustic'];

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

export function getAccent(settings: AppSettings) {
  return settings.accentColor || ACCENT_OPTIONS[0].value;
}

export function getTheme(settings: AppSettings) {
  const isLight = settings.theme === 'light';
  const accent = getAccent(settings);

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
    gradient: isLight
      ? ['#FFF2F6', '#F8F8F6', '#F8F8F6'] as const
      : ['#2A111E', '#08090B', '#08090B'] as const,
  };
}
