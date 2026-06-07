import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Track } from '@/src/models/types';
import { mmkvZustandStorage } from '@/src/store/mmkvStorage';
import { PlaybackResolverState, StreamType } from '@/src/services/playback/SourceResolver';

export type SleepTimerMode = 'end_of_track' | 'timed';

/** Temporary on-screen diagnostics — surfaces *why* a source was chosen or rejected. */
export interface PlaybackDiagnostics {
  resolverName: string | null;
  sourceLabel: string | null;
  streamType: StreamType | null;
  urlDomain: string | null;
  failureReason: string | null;
  attemptedSources: string[];
}

export interface SleepTimer {
  mode: SleepTimerMode;
  endTime: number | null; // unix ms, only set when mode === 'timed'
  label: string;
}

interface PlayerStore {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackPosition: number;
  duration: number;
  playbackRate: number;
  activeEngine: 'native' | null;
  seekRequest: { position: number; requestId: number } | null;
  playbackResolverState: PlaybackResolverState | 'idle';
  playbackStatusMessage: string;
  playbackSourceLabel: 'Legal' | 'Piped' | 'Proxy' | 'Downloaded' | null;
  playbackDiagnostics: PlaybackDiagnostics | null;
  sleepTimer: SleepTimer | null;

  // Actions
  setQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track) => void;
  updateQueueTrack: (index: number, track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  
  playTrack: (index: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  
  setIsPlaying: (isPlaying: boolean) => void;
  setPlaybackState: (position: number, duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  requestSeek: (position: number) => void;
  setIsBuffering: (isBuffering: boolean) => void;
  setActiveEngine: (engine: 'native' | null) => void;
  setPlaybackResolverState: (
    state: PlaybackResolverState | 'idle',
    message?: string,
    sourceLabel?: PlayerStore['playbackSourceLabel']
  ) => void;
  setPlaybackDiagnostics: (diagnostics: PlaybackDiagnostics | null) => void;
  setSleepTimer: (timer: SleepTimer | null) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      isBuffering: false,
      playbackPosition: 0,
      duration: 0,
      playbackRate: 1,
      activeEngine: null,
      seekRequest: null,
      playbackResolverState: 'idle',
      playbackStatusMessage: '',
      playbackSourceLabel: null,
      playbackDiagnostics: null,
      sleepTimer: null,

      setQueue: (tracks, startIndex = 0) => {
        const currentIndex = tracks.length ? Math.max(0, Math.min(startIndex, tracks.length - 1)) : -1;
        return set({
        queue: tracks,
        currentIndex,
        playbackPosition: 0,
        duration: tracks[currentIndex]?.duration || 0,
        isPlaying: tracks.length > 0,
      });
      },
      
      addToQueue: (track) => set((state) => ({ 
        queue: [...state.queue, track] 
      })),

      updateQueueTrack: (index, track) => set((state) => {
        if (index < 0 || index >= state.queue.length) return state;

        const queue = [...state.queue];
        queue[index] = track;
        return { queue };
      }),

      removeFromQueue: (index) => set((state) => {
        const newQueue = [...state.queue];
        newQueue.splice(index, 1);
        let newIndex = state.currentIndex;
        if (index < state.currentIndex) newIndex--;
        else if (index === state.currentIndex) {
          // If removing current track, play next or stop
          if (newQueue.length === 0) newIndex = -1;
          else if (newIndex >= newQueue.length) newIndex = newQueue.length - 1;
        }
        return { queue: newQueue, currentIndex: newIndex };
      }),

      clearQueue: () => set({ queue: [], currentIndex: -1, isPlaying: false, playbackPosition: 0, duration: 0 }),

      moveQueueItem: (fromIndex, toIndex) => set((state) => {
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= state.queue.length ||
          toIndex >= state.queue.length ||
          fromIndex === toIndex
        ) {
          return state;
        }

        const queue = [...state.queue];
        const [item] = queue.splice(fromIndex, 1);
        queue.splice(toIndex, 0, item);

        let currentIndex = state.currentIndex;
        if (state.currentIndex === fromIndex) {
          currentIndex = toIndex;
        } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
          currentIndex -= 1;
        } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
          currentIndex += 1;
        }

        return { queue, currentIndex };
      }),

      playTrack: (index) => {
        const state = get();
        if (index >= 0 && index < state.queue.length) {
          set({ currentIndex: index, playbackPosition: 0, isPlaying: true });
        }
      },

      nextTrack: () => {
        const state = get();
        if (state.currentIndex < state.queue.length - 1) {
          set({ currentIndex: state.currentIndex + 1, playbackPosition: 0, isPlaying: true });
        } else {
          // Queue ended
          set({ isPlaying: false, playbackPosition: 0 });
        }
      },

      previousTrack: () => {
        const state = get();
        if (state.playbackPosition > 3) {
          // Restart current track if played for more than 3 seconds
          set({ playbackPosition: 0 });
        } else if (state.currentIndex > 0) {
          set({ currentIndex: state.currentIndex - 1, playbackPosition: 0, isPlaying: true });
        }
      },

      setIsPlaying: (isPlaying) => set({ isPlaying }),
      
      setPlaybackState: (position, duration) => set({
        playbackPosition: position,
        duration: duration
      }),

      setPlaybackRate: (playbackRate) => set({ playbackRate }),

      requestSeek: (position) => set((state) => ({
        seekRequest: {
          position: Math.max(0, position),
          requestId: (state.seekRequest?.requestId || 0) + 1,
        },
        playbackPosition: Math.max(0, position),
      })),

      setIsBuffering: (isBuffering) => set({ isBuffering }),
      
      setActiveEngine: (engine) => set({ activeEngine: engine }),

      setPlaybackResolverState: (playbackResolverState, playbackStatusMessage = '', playbackSourceLabel) =>
        set((state) => ({
          playbackResolverState,
          playbackStatusMessage,
          playbackSourceLabel: playbackSourceLabel === undefined ? state.playbackSourceLabel : playbackSourceLabel,
        })),

      setPlaybackDiagnostics: (playbackDiagnostics) => set({ playbackDiagnostics }),

      setSleepTimer: (sleepTimer) => set({ sleepTimer }),
    }),
    {
      name: 'soniq-player-storage',
      storage: createJSONStorage(() => mmkvZustandStorage),
      partialize: (state) => ({ 
        // Only persist the queue and index, let UI reset playback state
        queue: state.queue, 
        currentIndex: state.currentIndex 
      }),
    }
  )
);
