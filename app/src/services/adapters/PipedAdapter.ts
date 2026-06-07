import { BaseAdapter } from '@/src/services/adapters/BaseAdapter';
import { Track, Artist, Album, Playlist } from '@/src/models/types';
import { normalizeTrack } from '@/src/services/search/trackNormalizer';

const DEFAULT_PIPED_BASE_URL = 'https://pipedapi.kavin.rocks';

// Hardcoded fallback instances — always kept at the END of the live list so
// dynamic instances (fetched by PipedInstanceService) are tried first.
const HARDCODED_PIPED_INSTANCES: ReadonlyArray<string> = [
  DEFAULT_PIPED_BASE_URL,
  'https://api.piped.private.coffee',
  'https://pipedapi.syncpundit.io',
  'https://pipedapi.moomoo.me',
  'https://api-piped.mha.fi',
  'https://pipedapi.tokhmi.xyz',
  'https://api.piped.projectsegfau.lt',
  'https://piped-api.garudalinux.org',
];

// Mutable at runtime — PipedAdapter.setInstances() prepends fresh dynamic URLs.
let PIPED_BASE_URLS: string[] = [...HARDCODED_PIPED_INSTANCES];

type PipedSearchItem = {
  duration?: number | string;
  thumbnail?: string;
  thumbnailUrl?: string;
  title?: string;
  type?: string;
  uploaderName?: string;
  uploader?: string;
  uploaderUrl?: string;
  url?: string;
};

type PipedAudioStream = {
  bitrate?: number;
  codec?: string;
  format?: string;
  mimeType?: string;
  quality?: string;
  url?: string;
  videoOnly?: boolean;
};

export type PipedStreamCandidate = {
  url: string;
  bitrate: number;
  format: string;
  mimeType: string;
  sourceLabel: 'Piped' | 'Proxy';
  baseUrl: string;
};

type PipedRelatedStream = {
  duration?: number | string;
  thumbnail?: string;
  thumbnailUrl?: string;
  title?: string;
  type?: string;
  uploaderName?: string;
  uploader?: string;
  uploaderUrl?: string;
  url?: string;
};

type PipedStreamsResponse = {
  audioStreams?: PipedAudioStream[];
  duration?: number;
  thumbnailUrl?: string;
  title?: string;
  uploader?: string;
  uploaderUrl?: string;
  relatedStreams?: PipedRelatedStream[];
};

export class PipedAdapter extends BaseAdapter {
  readonly sourceName = 'piped';

  private readonly primaryBaseUrl: string;

  constructor(baseUrl = DEFAULT_PIPED_BASE_URL) {
    super();
    this.primaryBaseUrl = baseUrl;
  }

  /** Always reads from the live module-level array, so setInstances() takes effect immediately. */
  private get baseUrls(): string[] {
    if (this.primaryBaseUrl === DEFAULT_PIPED_BASE_URL) return PIPED_BASE_URLS;
    return [this.primaryBaseUrl, ...PIPED_BASE_URLS.filter((url) => url !== this.primaryBaseUrl)];
  }

  /**
   * Overwrites the live instance list with `urls` (dynamic) followed by the
   * hardcoded fallback instances, so the hardcoded set is always reachable.
   */
  static setInstances(urls: string[]): void {
    const fresh = urls.filter((u) => !(HARDCODED_PIPED_INSTANCES as string[]).includes(u));
    PIPED_BASE_URLS = [...fresh, ...HARDCODED_PIPED_INSTANCES];
  }

  async search(query: string): Promise<{ tracks: Track[]; artists: Artist[]; albums: Album[]; }> {
    const data = await this.requestJson(`/search?q=${encodeURIComponent(query)}&filter=music_songs`);
    const items: PipedSearchItem[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

    return {
      tracks: items
        .map((item) => this.formatSearchResult(item))
        .filter((track): track is Track => Boolean(track)),
      artists: [],
      albums: [],
    };
  }

  async getStream(videoId: string): Promise<string> {
    const stream = (await this.getStreamCandidates(videoId))[0];
    if (!stream) {
      throw new Error('No playable Piped audio stream was found.');
    }

    return stream.url;
  }

  /** Returns the YouTube "Up Next" / related-video list for a given videoId.
   *  These are the same tracks YouTube's radio would queue — high-quality
   *  genre/vibe matches, not generic keyword results. */
  async getRelatedStreams(videoId: string): Promise<Track[]> {
    for (const baseUrl of this.baseUrls) {
      try {
        const data: PipedStreamsResponse = await this.requestJsonFromBase(
          baseUrl,
          `/streams/${encodeURIComponent(videoId)}`
        );
        const related = data.relatedStreams ?? [];
        const tracks = related
          .map((item) => this.formatSearchResult(item as PipedSearchItem))
          .filter((t): t is Track => Boolean(t));
        if (tracks.length > 0) return tracks;
      } catch {
        // try next instance
      }
    }
    return [];
  }

  async getStreamCandidates(videoId: string): Promise<PipedStreamCandidate[]> {
    const errors: string[] = [];

    // Race all instances — return immediately from the first one that succeeds.
    // This avoids the long sequential wait when early instances are slow/down.
    const raceResult = await Promise.any(
      this.baseUrls.map(async (baseUrl) => {
        const data: PipedStreamsResponse = await this.requestJsonFromBase(
          baseUrl,
          `/streams/${encodeURIComponent(videoId)}`
        );
        const streams = this.sortAudioStreams(data.audioStreams || []);
        const candidates = streams
          .map((stream) => ({
            url: stream.url || '',
            bitrate: this.getBitrate(stream),
            format: stream.format || '',
            mimeType: stream.mimeType || '',
            sourceLabel: (baseUrl === DEFAULT_PIPED_BASE_URL ? 'Piped' : 'Proxy') as 'Piped' | 'Proxy',
            baseUrl,
          }))
          .filter((c) => Boolean(c.url));
        if (candidates.length === 0) throw new Error('No audio streams');
        return candidates;
      })
    ).catch(() => [] as PipedStreamCandidate[]);

    if (raceResult.length > 0) return raceResult;

    // Fallback: sequential if race fails
    for (const baseUrl of this.baseUrls) {
      try {
        const data: PipedStreamsResponse = await this.requestJsonFromBase(
          baseUrl,
          `/streams/${encodeURIComponent(videoId)}`
        );
        const streams = this.sortAudioStreams(data.audioStreams || []);
        const candidates = streams
          .map((stream) => ({
            url: stream.url || '',
            bitrate: this.getBitrate(stream),
            format: stream.format || '',
            mimeType: stream.mimeType || '',
            sourceLabel: (baseUrl === DEFAULT_PIPED_BASE_URL ? 'Piped' : 'Proxy') as 'Piped' | 'Proxy',
            baseUrl,
          }))
          .filter((c) => Boolean(c.url));
        if (candidates.length > 0) return candidates;
      } catch (error) {
        errors.push(`${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`No Piped stream candidates found. ${errors.join(' | ')}`);
  }

  async getTrendingTracks(): Promise<Track[]> {
    const results = await this.search('top songs');
    return results.tracks;
  }

  async getTrackDetails(trackId: string): Promise<Track> {
    const videoId = trackId.replace(/^piped_/, '');
    const data: PipedStreamsResponse = await this.requestJson(`/streams/${encodeURIComponent(videoId)}`);
    const stream = this.sortAudioStreams(data.audioStreams || [])[0];

    if (!stream?.url) {
      throw new Error('No playable Piped audio stream was found.');
    }

    return normalizeTrack({
      id: `piped_${videoId}`,
      title: data.title || 'Unknown Title',
      artist: data.uploader || 'Unknown Artist',
      artistId: data.uploaderUrl || data.uploader || 'piped_unknown_artist',
      artwork: data.thumbnailUrl,
      duration: data.duration || 0,
      sourceType: 'piped',
      streamUrl: stream.url,
      pipedVideoId: videoId,
      genres: ['Music'],
      moodTags: ['piped'],
      sourceLabel: 'Piped',
    });
  }

  async getPlaylist(_playlistId: string): Promise<Playlist> {
    throw new Error('Piped playlists are not implemented.');
  }

  private formatSearchResult(item: PipedSearchItem): Track | null {
    const videoId = this.extractVideoId(item.url);
    if (!videoId || !item.title) return null;

    const artistName = item.uploaderName || item.uploader || 'Unknown Artist';

    return normalizeTrack({
      id: `piped_${videoId}`,
      title: item.title,
      artist: artistName,
      artistId: item.uploaderUrl || `piped_artist_${artistName}`,
      artwork: item.thumbnail || item.thumbnailUrl,
      duration: this.parseDuration(item.duration),
      sourceType: 'piped',
      pipedVideoId: videoId,
      lyricsAvailable: false,
      downloadAvailable: false,
      genres: ['Music'],
      moodTags: ['piped'],
      sourceLabel: 'Piped',
    });
  }

  private extractVideoId(url?: string): string | null {
    if (!url) return null;

    try {
      const parsed = new URL(url, DEFAULT_PIPED_BASE_URL);
      return parsed.searchParams.get('v');
    } catch {
      const match = url.match(/[?&]v=([^&]+)/);
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
  }

  private parseDuration(duration?: number | string): number {
    if (typeof duration === 'number') return duration;
    if (!duration) return 0;

    const parts = duration.split(':').map((part) => parseInt(part, 10));
    if (parts.some(Number.isNaN)) return parseInt(duration, 10) || 0;

    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  private selectBestAudioStream(streams: PipedAudioStream[]): PipedAudioStream | null {
    return this.sortAudioStreams(streams)[0] || null;
  }

  private sortAudioStreams(streams: PipedAudioStream[]): PipedAudioStream[] {
    const audioOnly = streams.filter((stream) => stream.url && !stream.videoOnly);
    const preferred = audioOnly.filter((stream) => this.isPreferredAudioFormat(stream));
    const candidates = preferred.length > 0 ? preferred : audioOnly;

    return [...candidates].sort((a, b) => {
      const bitrateDelta = this.getBitrate(b) - this.getBitrate(a);
      if (bitrateDelta !== 0) return bitrateDelta;
      return this.getFormatRank(b) - this.getFormatRank(a);
    });
  }

  private isPreferredAudioFormat(stream: PipedAudioStream): boolean {
    const descriptor = `${stream.format || ''} ${stream.mimeType || ''} ${stream.url || ''}`.toLowerCase();
    return descriptor.includes('m4a') || descriptor.includes('mp4') || descriptor.includes('webm');
  }

  private getBitrate(stream: PipedAudioStream): number {
    if (typeof stream.bitrate === 'number' && stream.bitrate > 0) return stream.bitrate;
    const qualityMatch = stream.quality?.match(/(\d+)/);
    return qualityMatch ? parseInt(qualityMatch[1], 10) : 0;
  }

  private getFormatRank(stream: PipedAudioStream): number {
    const descriptor = `${stream.format || ''} ${stream.mimeType || ''}`.toLowerCase();
    if (descriptor.includes('m4a') || descriptor.includes('mp4')) return 2;
    if (descriptor.includes('webm')) return 1;
    return 0;
  }

  private async requestJson(path: string) {
    const errors: string[] = [];

    for (const baseUrl of this.baseUrls) {
      try {
        const response = await fetch(`${baseUrl}${path}`);
        if (!response.ok) {
          errors.push(`${baseUrl} returned HTTP ${response.status}`);
          continue;
        }

        return await response.json();
      } catch (error) {
        errors.push(`${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`Piped request failed. ${errors.join(' | ')}`);
  }

  private async requestJsonFromBase(baseUrl: string, path: string) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 7000);
    try {
      const response = await fetch(`${baseUrl}${path}`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (e) {
      clearTimeout(tid);
      throw e;
    }
  }
}
