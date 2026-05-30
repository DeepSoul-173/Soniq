import { BaseAdapter } from '@/src/services/adapters/BaseAdapter';
import { Track, Artist, Album, Playlist } from '@/src/models/types';

// Jamendo requires a client ID.
const JAMENDO_CLIENT_ID = process.env.EXPO_PUBLIC_JAMENDO_CLIENT_ID || 'b6747d04'; // Public test ID if available, else needs env

export class JamendoAdapter extends BaseAdapter {
  readonly sourceName = 'jamendo';

  async search(query: string): Promise<{ tracks: Track[]; artists: Artist[]; albums: Album[]; }> {
    try {
      const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=10&search=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (!data.results) return { tracks: [], artists: [], albums: [] };

      const tracks: Track[] = data.results.map((item: any) => ({
        id: `jam_${item.id}`,
        title: item.name,
        artistId: `jam_art_${item.artist_id}`,
        artistName: item.artist_name,
        albumName: item.album_name,
        artworkUrl: item.image,
        duration: parseInt(item.duration, 10),
        sourceType: 'jamendo',
        streamUrl: item.audio,
        tags: item.tags || [],
        genre: 'Unknown', // Jamendo uses tags rather than a single genre
      }));

      return { tracks, artists: [], albums: [] };
    } catch (e) {
      console.error('Jamendo search failed', e);
      return { tracks: [], artists: [], albums: [] };
    }
  }

  async getTrendingTracks(): Promise<Track[]> {
    try {
      const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=10&boost=listens_week`);
      const data = await response.json();
      
      if (!data.results) return [];

      return data.results.map((item: any) => ({
        id: `jam_${item.id}`,
        title: item.name,
        artistId: `jam_art_${item.artist_id}`,
        artistName: item.artist_name,
        albumName: item.album_name,
        artworkUrl: item.image,
        duration: parseInt(item.duration, 10),
        sourceType: 'jamendo',
        streamUrl: item.audio,
        tags: item.tags || [],
      }));
    } catch (e) {
      console.error('Jamendo trending failed', e);
      return [];
    }
  }

  async getTrackDetails(trackId: string): Promise<Track> {
    const rawId = trackId.replace('jam_', '');
    const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&id=${rawId}`);
    const data = await response.json();
    if (!data.results || data.results.length === 0) throw new Error('Jamendo track not found');
    const item = data.results[0];
    return {
      id: trackId,
      title: item.name,
      artistId: `jam_art_${item.artist_id}`,
      artistName: item.artist_name,
      artworkUrl: item.image,
      duration: parseInt(item.duration, 10),
      sourceType: 'jamendo',
      streamUrl: item.audio,
      tags: item.tags || [],
    };
  }

  async getPlaylist(playlistId: string): Promise<Playlist> {
    throw new Error('Method not implemented.');
  }
}
