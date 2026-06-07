import { Track } from '@/src/models/types';
import { PipedAdapter } from '@/src/services/adapters/PipedAdapter';
import { JioSaavnAdapter } from '@/src/services/adapters/JioSaavnAdapter';
import { DeezerAdapter } from '@/src/services/adapters/DeezerAdapter';
import { searchYouTubeTracks } from '@/src/services/adapters/InnertubeAdapter';
import { normalizeTracks } from '@/src/services/search/trackNormalizer';

const pipedAdapter = new PipedAdapter();

function dedup(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const key = t.title.toLowerCase() + (t.artist || '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class SearchService {
  /**
   * Search across all available sources.
   * Order of preference: YouTube/InnerTube (direct full streams, works globally incl.
   * UK) → Piped (YouTube via proxy) → JioSaavn (full Indian songs) → Deezer (30s
   * previews, last resort). All fire in parallel; results merge in preference order.
   *
   * YouTube is first because it's the only source verified reliable everywhere and
   * every result carries a real videoId that SourceResolver can stream full-length.
   */
  static async searchAll(query: string): Promise<Track[]> {
    const [ytResult, pipedResult, saavnResult, deezerResult] = await Promise.allSettled([
      searchYouTubeTracks(query, 15),
      pipedAdapter.search(query).then((r) => normalizeTracks(r.tracks)),
      JioSaavnAdapter.searchTracks(query, 10),
      DeezerAdapter.searchTracks(query, 8),
    ]);

    const youtube = ytResult.status === 'fulfilled' ? ytResult.value : [];
    const piped = pipedResult.status === 'fulfilled' ? pipedResult.value : [];
    const saavn = saavnResult.status === 'fulfilled' ? saavnResult.value : [];
    const deezer = deezerResult.status === 'fulfilled' ? deezerResult.value : [];

    // YouTube first (direct full streams), then Piped (YouTube via proxy), then
    // JioSaavn (full Indian songs), then Deezer (preview fallback only).
    // Deduplicate by title+artist so the same song doesn't appear from every source.
    const merged = dedup([...youtube, ...piped, ...saavn, ...deezer]);
    return merged;
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
