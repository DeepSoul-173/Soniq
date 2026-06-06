import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Track, Playlist } from '@/src/models/types';
import { mmkvZustandStorage } from '@/src/store/mmkvStorage';
import {
  dbSetLiked,
  dbUpsertTrack,
  dbRecordPlay,
  dbSavePlaylist,
  dbRemovePlaylist,
} from '@/src/services/database/LibraryDatabase';

// Zustand/MMKV handles reactive in-memory state and fast serialisation.
// SQLite (LibraryDatabase) receives async writes for every mutation so that
// play-history and large libraries persist relationally beyond MMKV limits.

interface LibraryStore {
  likedTracks: Track[];
  savedPlaylists: Playlist[];
  recentlyPlayed: Track[];

  toggleLikeTrack: (track: Track) => void;
  isLiked: (trackId: string) => boolean;

  savePlaylist: (playlist: Playlist) => void;
  removePlaylist: (playlistId: string) => void;

  addRecentlyPlayed: (track: Track) => void;
  clearRecentlyPlayed: () => void;
}

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      likedTracks: [],
      savedPlaylists: [],
      recentlyPlayed: [],

      toggleLikeTrack: (track) => {
        const exists = get().likedTracks.some((t) => t.id === track.id);
        set((state) =>
          exists
            ? { likedTracks: state.likedTracks.filter((t) => t.id !== track.id) }
            : { likedTracks: [...state.likedTracks, track] }
        );
        // Mirror to SQLite (fire-and-forget)
        dbUpsertTrack(track).then(() => dbSetLiked(track.id, !exists)).catch(() => undefined);
      },

      isLiked: (trackId) => get().likedTracks.some((t) => t.id === trackId),

      savePlaylist: (playlist) => {
        set((state) =>
          state.savedPlaylists.some((p) => p.id === playlist.id)
            ? state
            : { savedPlaylists: [...state.savedPlaylists, playlist] }
        );
        dbSavePlaylist(playlist).catch(() => undefined);
      },

      removePlaylist: (playlistId) => {
        set((state) => ({
          savedPlaylists: state.savedPlaylists.filter((p) => p.id !== playlistId),
        }));
        dbRemovePlaylist(playlistId).catch(() => undefined);
      },

      addRecentlyPlayed: (track) => {
        set((state) => ({
          recentlyPlayed: [track, ...state.recentlyPlayed.filter((t) => t.id !== track.id)].slice(0, 50),
        }));
        // Full play-history record (includes play_count, timestamps) stored in SQLite
        dbRecordPlay(track).catch(() => undefined);
      },

      clearRecentlyPlayed: () => set({ recentlyPlayed: [] }),
    }),
    {
      name: 'soniq-library-storage',
      storage: createJSONStorage(() => mmkvZustandStorage),
    }
  )
);
