import { BaseAdapter } from '@/src/services/adapters/BaseAdapter';
import { Track, Artist, Album, Playlist } from '@/src/models/types';

export class IAAdapter extends BaseAdapter {
  readonly sourceName = 'internet_archive';

  async search(query: string): Promise<{ tracks: Track[]; artists: Artist[]; albums: Album[]; }> {
    try {
      // Search for audio media types with the query
      const searchUrl = `https://archive.org/advancedsearch.php?q=mediatype:audio AND title:(${encodeURIComponent(query)})&fl[]=identifier,title,creator,length,format&sort[]=downloads desc&rows=10&page=1&output=json`;
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (!data.response || !data.response.docs) return { tracks: [], artists: [], albums: [] };

      const tracks: Track[] = data.response.docs.map((doc: any) => ({
        id: `ia_${doc.identifier}`,
        title: doc.title,
        artistId: `ia_creator_${doc.creator || 'unknown'}`,
        artistName: Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || 'Unknown Creator'),
        artworkUrl: `https://archive.org/services/img/${doc.identifier}`,
        // IA returns length as a string like "03:45" or a number of seconds
        duration: this.parseIADuration(doc.length),
        sourceType: 'internet_archive',
        // Direct stream URL requires finding the specific MP3 file inside the item, 
        // we'll approximate the download URL for now and refine in getTrackDetails
        streamUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.mp3`, 
        tags: [],
        genre: 'Archive',
      }));

      return { tracks, artists: [], albums: [] };
    } catch (e) {
      console.error('IA search failed', e);
      return { tracks: [], artists: [], albums: [] };
    }
  }

  async getTrendingTracks(): Promise<Track[]> {
    try {
      const searchUrl = `https://archive.org/advancedsearch.php?q=mediatype:audio AND collection:(audio_music)&fl[]=identifier,title,creator,length&sort[]=downloads desc&rows=10&page=1&output=json`;
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (!data.response || !data.response.docs) return [];

      return data.response.docs.map((doc: any) => ({
        id: `ia_${doc.identifier}`,
        title: doc.title,
        artistId: `ia_creator_${doc.creator || 'unknown'}`,
        artistName: Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || 'Unknown Creator'),
        artworkUrl: `https://archive.org/services/img/${doc.identifier}`,
        duration: this.parseIADuration(doc.length),
        sourceType: 'internet_archive',
        streamUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.mp3`,
      }));
    } catch (e) {
      console.error('IA trending failed', e);
      return [];
    }
  }

  async getTrackDetails(trackId: string): Promise<Track> {
    const identifier = trackId.replace('ia_', '');
    const response = await fetch(`https://archive.org/metadata/${identifier}`);
    const data = await response.json();
    
    if (!data.metadata) throw new Error('IA track not found');

    // Find the first MP3 file
    const mp3File = data.files.find((f: any) => f.format === 'VBR MP3' || f.format === 'MP3');
    const streamUrl = mp3File 
      ? `https://archive.org/download/${identifier}/${mp3File.name}` 
      : `https://archive.org/download/${identifier}/${identifier}.mp3`;

    return {
      id: trackId,
      title: data.metadata.title || 'Unknown Title',
      artistId: `ia_creator_${data.metadata.creator || 'unknown'}`,
      artistName: Array.isArray(data.metadata.creator) ? data.metadata.creator[0] : (data.metadata.creator || 'Unknown Creator'),
      artworkUrl: `https://archive.org/services/img/${identifier}`,
      duration: mp3File ? this.parseIADuration(mp3File.length) : 0,
      sourceType: 'internet_archive',
      streamUrl,
    };
  }

  async getPlaylist(playlistId: string): Promise<Playlist> {
    throw new Error('Method not implemented.');
  }

  private parseIADuration(length: string | number | undefined): number {
    if (!length) return 0;
    if (typeof length === 'number') return length;
    if (typeof length === 'string') {
      const parts = length.split(':');
      if (parts.length === 2) {
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      } else if (parts.length === 3) {
        return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
      }
      return parseInt(length, 10) || 0;
    }
    return 0;
  }
}
