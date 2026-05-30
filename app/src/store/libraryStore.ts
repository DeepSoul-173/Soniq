import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Track, Playlist } from '@/src/models/types';
import { mmkvZustandStorage } from '@/src/store/mmkvStorage';

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

      toggleLikeTrack: (track) => set((state) => {
        const exists = state.likedTracks.some(t => t.id === track.id);
        if (exists) {
          return { likedTracks: state.likedTracks.filter(t => t.id !== track.id) };
        } else {
          return { likedTracks: [...state.likedTracks, track] };
        }
      }),

      isLiked: (trackId) => {
        return get().likedTracks.some(t => t.id === trackId);
      },

      savePlaylist: (playlist) => set((state) => {
        if (!state.savedPlaylists.some(p => p.id === playlist.id)) {
          return { savedPlaylists: [...state.savedPlaylists, playlist] };
        }
        return state;
      }),

      removePlaylist: (playlistId) => set((state) => ({
        savedPlaylists: state.savedPlaylists.filter(p => p.id !== playlistId)
      })),

      addRecentlyPlayed: (track) => set((state) => {
        const filtered = state.recentlyPlayed.filter(t => t.id !== track.id);
        return { 
          // Keep last 50 tracks
          recentlyPlayed: [track, ...filtered].slice(0, 50) 
        };
      }),

      clearRecentlyPlayed: () => set({ recentlyPlayed: [] }),
    }),
    {
      name: 'soniq-library-storage',
      storage: createJSONStorage(() => mmkvZustandStorage),
    }
  )
);
