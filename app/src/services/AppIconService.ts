/**
 * AppIconService — handles dynamic app icon switching and streak-based
 * icon auto-unlock ("Gold / Streak" unlocks after 100 songs played).
 *
 * iOS: fully supported in EAS / dev builds via Expo's alternateIcons config.
 *      Not supported in Expo Go (returns a graceful error message).
 *
 * Android: requires the withAndroidAlternateIcons config plugin and a dev
 *          build.  The user's preference is persisted so it applies next build.
 *
 * Icon name → iOS alternateIcons key mapping:
 *   'default'  → null (resets to the primary icon)
 *   'dark'     → 'icon-dark'
 *   'neon'     → 'icon-neon'
 *   'gold'     → 'icon-gold'
 */

import { Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'soniq-app-icon' });

const PLAYS_KEY = 'total-play-count';
const ICON_KEY = 'current-icon';
const STREAK_THRESHOLD = 100;

export type AppIconId = 'default' | 'dark' | 'neon' | 'gold';

export interface AppIconMeta {
  id: AppIconId;
  label: string;
  description: string;
  /** Minimum total plays required to unlock (0 = always unlocked) */
  playsRequired: number;
  /** iOS alternateIcons key (null = primary icon) */
  iosName: string | null;
  /** Android activity-alias name */
  androidAlias: string | null;
  /** Preview accent hex for the in-app preview tile */
  previewBg: string;
  previewAccent: string;
}

export const APP_ICONS: AppIconMeta[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'The classic Soniq look.',
    playsRequired: 0,
    iosName: null,
    androidAlias: null,
    previewBg: '#1a0a2e',
    previewAccent: '#C77DFF',
  },
  {
    id: 'dark',
    label: 'Dark Mode',
    description: 'Pure black with a monochrome mark.',
    playsRequired: 0,
    iosName: 'icon-dark',
    androidAlias: '.MainActivityIconDark',
    previewBg: '#0a0a0a',
    previewAccent: '#E0E0E0',
  },
  {
    id: 'neon',
    label: 'Neon Outline',
    description: 'Glowing cyan lines on void black.',
    playsRequired: 0,
    iosName: 'icon-neon',
    androidAlias: '.MainActivityIconNeon',
    previewBg: '#001010',
    previewAccent: '#00FFD0',
  },
  {
    id: 'gold',
    label: 'Gold / Streak',
    description: `Listen to ${STREAK_THRESHOLD} songs to unlock automatically, or select it here once earned.`,
    playsRequired: STREAK_THRESHOLD,
    iosName: 'icon-gold',
    androidAlias: '.MainActivityIconGold',
    previewBg: '#1a1200',
    previewAccent: '#FFD700',
  },
];

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Lazily locate the iOS setAlternateIconNameAsync function across known locations. */
function resolveSetIconFn(): ((name: string | null) => Promise<void>) | null {
  // Expo SDK 50+ exposes this on the top-level 'expo' package
  for (const moduleName of ['expo', 'expo-application']) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(moduleName) as Record<string, unknown>;
      const fn = mod['setAlternateIconNameAsync'];
      if (typeof fn === 'function') {
        return fn as (name: string | null) => Promise<void>;
      }
    } catch {
      // module not available
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export class AppIconService {
  // ── State accessors ─────────────────────────────────────────────────────────

  static get currentIconId(): AppIconId {
    return (storage.getString(ICON_KEY) as AppIconId) ?? 'default';
  }

  static get totalPlayCount(): number {
    return storage.getNumber(PLAYS_KEY) ?? 0;
  }

  static isIconUnlocked(icon: AppIconMeta): boolean {
    return this.totalPlayCount >= icon.playsRequired;
  }

  // ── Icon switching ───────────────────────────────────────────────────────────

  static async setIcon(iconId: AppIconId): Promise<{ success: boolean; message?: string }> {
    const meta = APP_ICONS.find((i) => i.id === iconId);
    if (!meta) return { success: false, message: 'Unknown icon.' };

    if (!this.isIconUnlocked(meta)) {
      const remaining = meta.playsRequired - this.totalPlayCount;
      return {
        success: false,
        message: `Listen to ${remaining} more song${remaining !== 1 ? 's' : ''} to unlock this icon.`,
      };
    }

    if (Platform.OS === 'android') {
      // Android requires native PackageManager calls which need a dev build.
      // Persist the preference — the config plugin applied the manifest aliases,
      // but enabling them at runtime needs a native module bridge.
      storage.set(ICON_KEY, iconId);
      return {
        success: false,
        message:
          'Android icon switching requires a custom dev build. Your choice has been saved and will activate after you rebuild the app.',
      };
    }

    if (Platform.OS === 'ios') {
      const setFn = resolveSetIconFn();
      if (!setFn) {
        // Graceful degradation for Expo Go
        storage.set(ICON_KEY, iconId);
        return {
          success: false,
          message:
            'App icon switching is not available in Expo Go. Build a development or production build to enable it.',
        };
      }
      try {
        await setFn(meta.iosName);
        storage.set(ICON_KEY, iconId);
        return { success: true };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Failed to change the app icon.',
        };
      }
    }

    return { success: false, message: 'App icon switching is only available on iOS and Android.' };
  }

  // ── Streak / play-count tracking ─────────────────────────────────────────────

  /**
   * Call this once per completed track play.
   * Returns true and fires the gold icon auto-switch when the streak milestone
   * is hit for the first time.
   */
  static async recordPlay(): Promise<{ milestoneReached: boolean }> {
    const prev = this.totalPlayCount;
    const next = prev + 1;
    storage.set(PLAYS_KEY, next);

    // Check for gold milestone (exactly at threshold to avoid repeat triggers)
    if (prev < STREAK_THRESHOLD && next >= STREAK_THRESHOLD && this.currentIconId === 'default') {
      // Auto-switch to gold icon as a delightful surprise
      await this.setIcon('gold');
      return { milestoneReached: true };
    }

    return { milestoneReached: false };
  }

  /**
   * Explicitly check streak and upgrade icon.
   * Safe to call on app launch to recover from missed triggers.
   */
  static async checkStreakMilestone(): Promise<void> {
    if (
      this.totalPlayCount >= STREAK_THRESHOLD &&
      this.currentIconId === 'default'
    ) {
      await this.setIcon('gold');
    }
  }
}
