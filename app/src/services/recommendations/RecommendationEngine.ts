import { Track } from '@/src/models/types';
import { PipedAdapter } from '@/src/services/adapters/PipedAdapter';
import { useSettingsStore } from '@/src/store/settingsStore';

const pipedAdapter = new PipedAdapter();

export class RecommendationEngine {
  /**
   * Generates a recommendation for the next track based on the current track and user settings.
   */
  static async getNextRecommendation(currentTrack?: Track): Promise<Track | null> {
    const settings = useSettingsStore.getState().settings;
    
    const query = currentTrack?.artistName || 'popular songs';
    const { tracks: trendingTracks } = await pipedAdapter.search(query).catch((error) => {
      console.error('Piped recommendations failed', error);
      return { tracks: [] };
    });
    
    if (!currentTrack) {
      // Cold start: return a random trending track
      return trendingTracks[Math.floor(Math.random() * trendingTracks.length)] || null;
    }

    // Filter out the current track
    let candidates = trendingTracks.filter(t => t.id !== currentTrack.id);

    // Apply settings: diversity vs familiarity
    // If diversity is low (familiarity high), prefer same artist or genre
    if (settings.diversityVsFamiliarity < 0.5) {
      const similarCandidates = candidates.filter(
        t => t.artistId === currentTrack.artistId || t.genre === currentTrack.genre
      );
      if (similarCandidates.length > 0) {
        candidates = similarCandidates;
      }
    }

    // Apply safe search setting
    if (settings.safeSearch) {
      // In a real scenario, filter out tracks marked explicit
    }

    if (candidates.length === 0) return null;

    // Pick a random track from candidates
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }
}
