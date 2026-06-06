import { BaseAdapter } from '@/src/services/adapters/BaseAdapter';
import { Track, Artist, Album, Playlist } from '@/src/models/types';
import { normalizeTrack } from '@/src/services/search/trackNormalizer';

// Jamendo requires a client ID.
const JAMENDO_CLIENT_ID = process.env.EXPO_PUBLIC_JAMENDO_CLIENT_ID || 'b6747d04'; // Public test ID if available, else needs env

export class JamendoAdapter extends BaseAdapter {
  readonly sourceName = 'jamendo';

  async search(query: string): Promise<{ tracks: Track[]; artists: Artist[]; albums: Album[]; }> {
    try {
      const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=10&search=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (!data.results) return { tracks: [], artists: [], albums: [] };

      const tracks: Track[] = data.results.map((item: any) => normalizeTrack({
        id: `jam_${item.id}`,
        title: item.name,
        artist: item.artist_name,
        artistId: `jam_art_${item.artist_id}`,
        album: item.album_name,
        artwork: item.image,
        duration: parseInt(item.duration, 10),
        sourceType: 'legal',
        streamUrl: item.audio,
        lyricsAvailable: false,
        downloadAvailable: Boolean(item.audiodownload || item.audio),
        genres: item.musicinfo?.tags?.genres || item.tags || [],
        moodTags: item.musicinfo?.tags?.vartags || [],
        sourceLabel: 'Legal',
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

      return data.results.map((item: any) => normalizeTrack({
        id: `jam_${item.id}`,
        title: item.name,
        artist: item.artist_name,
        artistId: `jam_art_${item.artist_id}`,
        album: item.album_name,
        artwork: item.image,
        duration: parseInt(item.duration, 10),
        sourceType: 'legal',
        streamUrl: item.audio,
        lyricsAvailable: false,
        downloadAvailable: Boolean(item.audiodownload || item.audio),
        genres: item.musicinfo?.tags?.genres || item.tags || [],
        moodTags: item.musicinfo?.tags?.vartags || [],
        sourceLabel: 'Legal',
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
    return normalizeTrack({
      id: trackId,
      title: item.name,
      artist: item.artist_name,
      artistId: `jam_art_${item.artist_id}`,
      artwork: item.image,
      duration: parseInt(item.duration, 10),
      sourceType: 'legal',
      streamUrl: item.audio,
      lyricsAvailable: false,
      downloadAvailable: Boolean(item.audiodownload || item.audio),
      genres: item.musicinfo?.tags?.genres || item.tags || [],
      moodTags: item.musicinfo?.tags?.vartags || [],
      sourceLabel: 'Legal',
    });
  }

  async getPlaylist(playlistId: string): Promise<Playlist> {
    throw new Error('Method not implemented.');
  }
}
