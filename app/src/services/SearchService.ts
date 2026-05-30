import { PipedAdapter } from '@/src/services/adapters/PipedAdapter';
import { Track } from '@/src/models/types';

const pipedAdapter = new PipedAdapter();

export class SearchService {
  static async searchAll(query: string): Promise<Track[]> {
    const result = await pipedAdapter.search(query);
    return result.tracks;
  }

  static async prepareTrackForPlayback(track: Track): Promise<Track> {
    if (track.sourceType !== 'piped') return track;

    const videoId = track.pipedVideoId || track.id.replace(/^piped_/, '');
    const streamUrl = await pipedAdapter.getStream(videoId);

    return {
      ...track,
      streamUrl,
      pipedVideoId: videoId,
    };
  }
}
