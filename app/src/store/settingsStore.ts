import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvZustandStorage } from '@/src/store/mmkvStorage';

export interface AppSettings {
  // Profile & customization
  displayName: string;
  profileImageUri: string;
  accentColor: string;
  preferredListeningMoods: string[];
  useDenseLists: boolean;

  // 1. Playback
  autoplay: boolean;
  playInBackground: boolean;
  gaplessPlayback: boolean;
  crossfadeDuration: number;
  normalizeVolume: boolean;
  monoAudio: boolean;
  allowExplicitContent: boolean;
  autoplaySimilar: boolean;
  defaultRepeatMode: 'off' | 'track' | 'queue';
  defaultShuffle: boolean;
  resumeOnReopen: boolean;
  seekStep: number;
  preferredStartVolume: number;

  // 2. Audio Quality
  wifiStreamingQuality: 'low' | 'normal' | 'high' | 'very_high';
  cellularStreamingQuality: 'low' | 'normal' | 'high' | 'very_high';
  downloadQuality: 'normal' | 'high' | 'very_high';
  autoAdjustQuality: boolean;
  highQualityOnlyOnWifi: boolean;
  preferredSourceOrder: string[]; // e.g. ['piped']

  // 3. Data Saving
  dataSaver: boolean;
  disableAutoplayVideos: boolean;
  streamOnCellular: boolean;
  downloadOnCellular: boolean;
  cacheSizeLimit: number; // in MB
  offlineMode: boolean;
  smartDownload: boolean;
  autoCleanCache: boolean;

  // 4. Notifications
  pushNotifications: boolean;
  notifyRecommendations: boolean;
  notifyNewReleases: boolean;
  notifyPlaylistUpdates: boolean;
  notifyAppAnnouncements: boolean;
  quietHoursEnabled: boolean;

  // 5. Content & Display
  theme: 'system' | 'light' | 'dark';
  dynamicThemeFromArtwork: boolean;
  compactMode: boolean;
  largeText: boolean;
  showExplicitBadges: boolean;
  reducedMotion: boolean;
  animatedBackground: boolean;
  showVisualizer: boolean;

  // 6. Library & Personalization
  favoriteGenres: string[];
  recommendationSensitivity: number; // 0.0 to 1.0
  diversityVsFamiliarity: number; // 0.0 to 1.0 (1.0 = highly diverse)
  discoveryMode: boolean;

  // 7. Search & Recommendation Behavior
  prioritizeLocalResults: boolean;
  safeSearch: boolean;
  recommendationFreshness: 'low' | 'medium' | 'high';
  sourceBlending: boolean;

  // 8. Queue & Player
  autoAddRecommendations: boolean;
  persistQueue: boolean;
  clearQueueOnSourceSwitch: boolean;

  // 9. Privacy
  analyticsOptIn: boolean;
  personalizationOptIn: boolean;
  saveSearchHistory: boolean;
  showRecentlyPlayed: boolean;
  privateSession: boolean;
  localOnlyMode: boolean;

  // 10. Developer
  debugLogs: boolean;
  mockMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  displayName: 'Soniq Listener',
  profileImageUri: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&q=80&w=400&h=400',
  accentColor: '#FF2A70',
  preferredListeningMoods: ['Focus', 'Electronic', 'Ambient'],
  useDenseLists: false,

  autoplay: true,
  playInBackground: true,
  gaplessPlayback: true,
  crossfadeDuration: 0,
  normalizeVolume: true,
  monoAudio: false,
  allowExplicitContent: true,
  autoplaySimilar: true,
  defaultRepeatMode: 'off',
  defaultShuffle: false,
  resumeOnReopen: true,
  seekStep: 10,
  preferredStartVolume: 100,

  wifiStreamingQuality: 'high',
  cellularStreamingQuality: 'normal',
  downloadQuality: 'high',
  autoAdjustQuality: true,
  highQualityOnlyOnWifi: false,
  preferredSourceOrder: ['piped'],

  dataSaver: false,
  disableAutoplayVideos: false,
  streamOnCellular: true,
  downloadOnCellular: false,
  cacheSizeLimit: 1024,
  offlineMode: false,
  smartDownload: false,
  autoCleanCache: true,

  pushNotifications: true,
  notifyRecommendations: true,
  notifyNewReleases: true,
  notifyPlaylistUpdates: false,
  notifyAppAnnouncements: true,
  quietHoursEnabled: false,

  theme: 'dark',
  dynamicThemeFromArtwork: true,
  compactMode: false,
  largeText: false,
  showExplicitBadges: true,
  reducedMotion: false,
  animatedBackground: true,
  showVisualizer: false,

  favoriteGenres: [],
  recommendationSensitivity: 0.5,
  diversityVsFamiliarity: 0.5,
  discoveryMode: false,

  prioritizeLocalResults: true,
  safeSearch: false,
  recommendationFreshness: 'medium',
  sourceBlending: true,

  autoAddRecommendations: true,
  persistQueue: true,
  clearQueueOnSourceSwitch: false,

  analyticsOptIn: true,
  personalizationOptIn: true,
  saveSearchHistory: true,
  showRecentlyPlayed: true,
  privateSession: false,
  localOnlyMode: false,

  debugLogs: false,
  mockMode: false,
};

interface SettingsStore {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  toggleListeningMood: (mood: string) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: value,
          },
        })),
      toggleListeningMood: (mood) =>
        set((state) => {
          const exists = state.settings.preferredListeningMoods.includes(mood);
          return {
            settings: {
              ...state.settings,
              preferredListeningMoods: exists
                ? state.settings.preferredListeningMoods.filter((item) => item !== mood)
                : [...state.settings.preferredListeningMoods, mood],
            },
          };
        }),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'soniq-settings-storage',
      storage: createJSONStorage(() => mmkvZustandStorage),
    }
  )
);
