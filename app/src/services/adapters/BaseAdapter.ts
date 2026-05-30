import { Track, Playlist, Album, Artist } from '@/src/models/types';

export abstract class BaseAdapter {
  abstract readonly sourceName: string;
  
  /**
   * Search across the data source.
   */
  abstract search(query: string): Promise<{
    tracks: Track[];
    artists: Artist[];
    albums: Album[];
  }>;

  /**
   * Get trending or featured tracks.
   */
  abstract getTrendingTracks(): Promise<Track[]>;

  /**
   * Get detailed information for a specific track.
   * Useful for fetching full streaming URLs right before playback.
   */
  abstract getTrackDetails(trackId: string): Promise<Track>;

  /**
   * Get a playlist by ID.
   */
  abstract getPlaylist(playlistId: string): Promise<Playlist>;
}
