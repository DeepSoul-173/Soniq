import { Track } from '@/src/models/types';
import { PipedAdapter } from '@/src/services/adapters/PipedAdapter';
import { normalizeTracks } from '@/src/services/search/trackNormalizer';

const pipedAdapter = new PipedAdapter();

export class SearchService {
  static async searchAll(query: string): Promise<Track[]> {
    const result = await pipedAdapter.search(query);
    return normalizeTracks(result.tracks);
  }

  static async prepareTrackForPlayback(track: Track): Promise<Track> {
    return {
      ...track,
      artist: track.artist || track.artistName,
      artwork: track.artwork || track.artworkUrl,
      album: track.album || track.albumName,
    };
  }
}
