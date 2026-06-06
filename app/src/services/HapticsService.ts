/**
 * HapticsService — thin wrapper around expo-haptics.
 *
 * Install the package first:
 *   npx expo install expo-haptics
 *
 * Until it's installed every method is a safe no-op so nothing breaks.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Haptics: any = null;

try {
  // Dynamic require so a missing package doesn't crash the module.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require('expo-haptics');
} catch {
  // expo-haptics not installed — all calls become no-ops.
}

export class HapticsService {
  /** Light tap — use for toggles, chip selections. */
  static light() {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  /** Medium impact — use for like / unlike, play/pause. */
  static medium() {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }

  /** Heavy impact — use for destructive actions. */
  static heavy() {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  }

  /** Success notification — use after download completes, backup created. */
  static success() {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }

  /** Error notification — use when playback fails. */
  static error() {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }
}
