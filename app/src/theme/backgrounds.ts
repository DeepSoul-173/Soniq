import { AppSettings } from '@/src/store/settingsStore';

// Curated backdrop catalog for the WhatsApp-style background picker.
// Gradients/live use only colour arrays (no assets, no network). "Global" images
// are free curated remote photos; users can also pick their own from the device.

export type GradientPreset = { key: string; label: string; colors: readonly [string, string, string] };
export type LivePreset = { key: string; label: string; from: readonly [string, string, string]; to: readonly [string, string, string] };
export type GlobalImage = { key: string; label: string; uri: string };

export const GRADIENT_BACKGROUNDS: GradientPreset[] = [
  { key: 'onyx',     label: 'Onyx',      colors: ['#1A1612', '#0B0B0D', '#000000'] },
  { key: 'midnight', label: 'Midnight',  colors: ['#1B2735', '#0B1622', '#05070C'] },
  { key: 'plum',     label: 'Plum Night', colors: ['#2A1F3D', '#1A1530', '#0E0B18'] },
  { key: 'ember',    label: 'Ember',     colors: ['#2A140E', '#1A0D0A', '#080505'] },
  { key: 'forest',   label: 'Deep Forest', colors: ['#10241C', '#0A1812', '#040806'] },
  { key: 'rose',     label: 'Rosewood',  colors: ['#2C1620', '#1A0E16', '#0A050A'] },
];

export const LIVE_BACKGROUNDS: LivePreset[] = [
  { key: 'aurora',  label: 'Aurora',  from: ['#16243A', '#102033', '#0A1622'], to: ['#1E3A2E', '#15263A', '#0A1622'] },
  { key: 'dusk',    label: 'Dusk',    from: ['#2A1F3D', '#1A1530', '#0E0B18'], to: ['#3A1F33', '#241530', '#0E0B18'] },
  { key: 'tide',    label: 'Tide',    from: ['#0E2230', '#0A1822', '#050E14'], to: ['#10303A', '#0A2230', '#05121A'] },
  { key: 'champagne', label: 'Champagne', from: ['#241D12', '#15110B', '#0A0805'], to: ['#322714', '#1C160C', '#0A0805'] },
];

export const GLOBAL_IMAGES: GlobalImage[] = [
  { key: 'g_studio', label: 'Studio',  uri: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=900' },
  { key: 'g_neon',   label: 'City',    uri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=900' },
  { key: 'g_marble', label: 'Marble',  uri: 'https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?auto=format&fit=crop&q=80&w=900' },
  { key: 'g_sakura', label: 'Sakura',  uri: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&q=80&w=900' },
  { key: 'g_dunes',  label: 'Dunes',   uri: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&q=80&w=900' },
  { key: 'g_ocean',  label: 'Ocean',   uri: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&q=80&w=900' },
];

/** True when the user has chosen any backdrop other than the skin default. */
export function hasCustomBackground(settings: AppSettings): boolean {
  return (settings.backgroundType ?? 'theme') !== 'theme';
}

/** Root screen background colour — transparent when a custom backdrop is active so
 *  the app-wide AppBackground shows through; otherwise the skin's solid colour. */
export function screenBackground(settings: AppSettings, themeBackground: string): string {
  return hasCustomBackground(settings) ? 'transparent' : themeBackground;
}

export function gradientColorsFor(key: string): readonly [string, string, string] {
  return GRADIENT_BACKGROUNDS.find((g) => g.key === key)?.colors ?? GRADIENT_BACKGROUNDS[0].colors;
}

export function livePresetFor(key: string): LivePreset {
  return LIVE_BACKGROUNDS.find((l) => l.key === key) ?? LIVE_BACKGROUNDS[0];
}

export function globalImageUri(key: string): string | null {
  return GLOBAL_IMAGES.find((g) => g.key === key)?.uri ?? null;
}
