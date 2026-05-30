import { BaseAdapter } from '@/src/services/adapters/BaseAdapter';
import { Track, Artist, Album, Playlist } from '@/src/models/types';

const DEFAULT_PIPED_BASE_URL = 'https://pipedapi.kavin.rocks';
const PIPED_BASE_URLS = [
  DEFAULT_PIPED_BASE_URL,
  'https://api.piped.private.coffee',
  'https://pipedapi.syncpundit.io',
  'https://pipedapi.moomoo.me',
  'https://api-piped.mha.fi',
];

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

type PipedStreamsResponse = {
  audioStreams?: PipedAudioStream[];
  duration?: number;
  thumbnailUrl?: string;
  title?: string;
  uploader?: string;
  uploaderUrl?: string;
};

export class PipedAdapter extends BaseAdapter {
  readonly sourceName = 'piped';

  private readonly baseUrls: string[];

  constructor(baseUrl = DEFAULT_PIPED_BASE_URL) {
    super();
    this.baseUrls = [baseUrl, ...PIPED_BASE_URLS.filter((url) => url !== baseUrl)];
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
    const data: PipedStreamsResponse = await this.requestJson(`/streams/${encodeURIComponent(videoId)}`);
    const stream = this.selectBestAudioStream(data.audioStreams || []);

    if (!stream?.url) {
      throw new Error('No playable Piped audio stream was found.');
    }

    return stream.url;
  }

  async getTrendingTracks(): Promise<Track[]> {
    const results = await this.search('top songs');
    return results.tracks;
  }

  async getTrackDetails(trackId: string): Promise<Track> {
    const videoId = trackId.replace(/^piped_/, '');
    const data: PipedStreamsResponse = await this.requestJson(`/streams/${encodeURIComponent(videoId)}`);
    const stream = this.selectBestAudioStream(data.audioStreams || []);

    if (!stream?.url) {
      throw new Error('No playable Piped audio stream was found.');
    }

    return {
      id: `piped_${videoId}`,
      title: data.title || 'Unknown Title',
      artistId: data.uploaderUrl || data.uploader || 'piped_unknown_artist',
      artistName: data.uploader || 'Unknown Artist',
      artworkUrl: data.thumbnailUrl,
      duration: data.duration || 0,
      sourceType: 'piped',
      streamUrl: stream.url,
      pipedVideoId: videoId,
      tags: ['piped'],
      genre: 'Music',
    };
  }

  async getPlaylist(_playlistId: string): Promise<Playlist> {
    throw new Error('Piped playlists are not implemented.');
  }

  private formatSearchResult(item: PipedSearchItem): Track | null {
    const videoId = this.extractVideoId(item.url);
    if (!videoId || !item.title) return null;

    const artistName = item.uploaderName || item.uploader || 'Unknown Artist';

    return {
      id: `piped_${videoId}`,
      title: item.title,
      artistId: item.uploaderUrl || `piped_artist_${artistName}`,
      artistName,
      artworkUrl: item.thumbnail || item.thumbnailUrl,
      duration: this.parseDuration(item.duration),
      sourceType: 'piped',
      pipedVideoId: videoId,
      tags: ['piped'],
      genre: 'Music',
    };
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
    const audioOnly = streams.filter((stream) => stream.url && !stream.videoOnly);
    const preferred = audioOnly.filter((stream) => this.isPreferredAudioFormat(stream));
    const candidates = preferred.length > 0 ? preferred : audioOnly;

    return [...candidates].sort((a, b) => {
      const bitrateDelta = this.getBitrate(b) - this.getBitrate(a);
      if (bitrateDelta !== 0) return bitrateDelta;
      return this.getFormatRank(b) - this.getFormatRank(a);
    })[0] || null;
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
}
