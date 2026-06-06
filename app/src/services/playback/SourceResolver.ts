import { Track } from '@/src/models/types';
import { PipedAdapter, PipedStreamCandidate } from '@/src/services/adapters/PipedAdapter';
import { normalizeTrack } from '@/src/services/search/trackNormalizer';
import { DownloadManager } from '@/src/services/downloads/DownloadManager';
import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';
import { useSettingsStore } from '@/src/store/settingsStore';

export type PlaybackResolverState = 'buffering' | 'validating' | 'retrying' | 'ready' | 'failed';

export type ResolvedPlaybackSource = {
  track: Track;
  url: string;
  sourceLabel: 'Legal' | 'Piped' | 'Proxy' | 'Downloaded';
  attemptedSources: string[];
};

type CachedSource = {
  url: string;
  sourceLabel: ResolvedPlaybackSource['sourceLabel'];
  savedAt: number;
};

type ResolveOptions = {
  onState?: (state: PlaybackResolverState, message: string) => void;
};

const CACHE_KEY = 'soniq-playback-source-cache';
const CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes
const pipedAdapter = new PipedAdapter();

// Invidious public instances — used as final fallback when all Piped instances fail.
const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://inv.tux.pizza',
  'https://invidious.privacydev.net',
  'https://invidious.lunar.icu',
  'https://invidious.perennialte.ch',
  'https://inv.nadeko.net',
];

// Cobalt.tools API — alternative downloader, supports YouTube audio
const COBALT_API = 'https://api.cobalt.tools';

type InvidiousAdaptiveFormat = {
  url?: string;
  type?: string;
  audioQuality?: string;
  bitrate?: number;
};

async function resolveViaInvidious(videoId: string): Promise<string | null> {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${base}/api/v1/videos/${encodeURIComponent(videoId)}`, {
        headers: { 'User-Agent': 'Soniq/1.0' },
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) continue;
      const data = await res.json();
      const formats: InvidiousAdaptiveFormat[] = Array.isArray(data.adaptiveFormats)
        ? data.adaptiveFormats
        : [];
      const audio = formats
        .filter((f) => f.url && f.type?.startsWith('audio/'))
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      if (audio[0]?.url) return audio[0].url;
    } catch {
      // try next
    }
  }
  return null;
}

async function resolveViaCobalt(videoId: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(COBALT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        audioFormat: 'best',
        isAudioOnly: true,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json();
    // cobalt returns { status: 'stream'|'redirect', url }
    if ((data.status === 'stream' || data.status === 'redirect') && data.url) {
      return data.url as string;
    }
  } catch {
    // cobalt unavailable
  }
  return null;
}

export class SourceResolver {
  static async resolve(track: Track, options: ResolveOptions = {}): Promise<ResolvedPlaybackSource> {
    const attemptedSources: string[] = [];
    const settings = useSettingsStore.getState().settings;
    const cachedSources = getLocalJSON<Record<string, CachedSource>>(CACHE_KEY, {});

    options.onState?.('buffering', 'Preparing source');

    // 1. Downloaded file — always preferred
    if (settings.streamDownloadedSongsFirst) {
      const downloaded = await DownloadManager.getDownloadedTrack(track.id);
      if (downloaded?.localUri) {
        attemptedSources.push('Downloaded');
        return this.finish(track, downloaded.localUri, 'Downloaded', attemptedSources);
      }
    }

    // 2. Fresh cache hit (25-minute TTL)
    const cached = cachedSources[track.id];
    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
      attemptedSources.push(`${cached.sourceLabel} cache`);
      options.onState?.('validating', `Checking cached ${cached.sourceLabel} source`);
      // Piped/Proxy cache hits contain YouTube CDN URLs — trust them directly.
      const trusted = cached.sourceLabel !== 'Legal';
      if (await this.validateStreamUrl(cached.url, trusted)) {
        return this.finish(track, cached.url, cached.sourceLabel, attemptedSources);
      }
    }

    // 3. Legal / direct source (Jamendo, Internet Archive)
    const legalUrl = this.getLegalSource(track);
    if (legalUrl) {
      attemptedSources.push('Legal');
      options.onState?.('validating', 'Checking legal source');
      if (await this.validateStreamUrl(legalUrl, false)) {
        return this.finishAndCache(track, legalUrl, 'Legal', attemptedSources);
      }
    }

    // 4. Piped stream candidates (all instances tried in parallel for speed)
    const pipedVideoId = track.pipedVideoId || track.id.replace(/^piped_/, '');
    if (pipedVideoId) {
      options.onState?.('validating', 'Fetching audio stream via Piped');
      const candidates = await pipedAdapter
        .getStreamCandidates(pipedVideoId)
        .catch(() => [] as PipedStreamCandidate[]);

      for (const candidate of candidates) {
        attemptedSources.push(candidate.sourceLabel);
        options.onState?.(
          'validating',
          `Trying ${candidate.sourceLabel} — ${candidate.format || 'audio'}`
        );
        // YouTube CDN / Piped proxy URLs: trust them — HEAD/range requests return 403
        // even when the stream is perfectly valid for actual playback.
        if (this.isStableAudioCandidate(candidate) && await this.validateStreamUrl(candidate.url, true)) {
          return this.finishAndCache(track, candidate.url, candidate.sourceLabel, attemptedSources);
        }
      }
    }

    // 5. Invidious fallback
    if (pipedVideoId) {
      options.onState?.('retrying', 'Trying Invidious fallback');
      const invidiousUrl = await resolveViaInvidious(pipedVideoId).catch(() => null);
      if (invidiousUrl && await this.validateStreamUrl(invidiousUrl, true)) {
        attemptedSources.push('Invidious');
        return this.finishAndCache(track, invidiousUrl, 'Proxy', attemptedSources);
      }
    }

    // 6. Cobalt.tools final fallback
    if (pipedVideoId) {
      options.onState?.('retrying', 'Trying Cobalt fallback');
      const cobaltUrl = await resolveViaCobalt(pipedVideoId).catch(() => null);
      if (cobaltUrl && await this.validateStreamUrl(cobaltUrl, true)) {
        attemptedSources.push('Cobalt');
        return this.finishAndCache(track, cobaltUrl, 'Proxy', attemptedSources);
      }
    }

    options.onState?.('failed', 'No playable source found');
    throw new Error(`No playable source found. Tried: ${attemptedSources.join(', ') || 'none'}`);
  }

  /**
   * Validates a stream URL before handing it to the audio player.
   *
   * @param trusted  Pass `true` for Piped/Invidious/YouTube CDN URLs — these return
   *                 403/206 inconsistently on pre-flight requests but stream fine.
   *                 Skip validation and let the audio player handle errors itself.
   */
  static async validateStreamUrl(url: string, trusted = false): Promise<boolean> {
    if (!url) return false;
    if (url.startsWith('file://')) return true;

    // YouTube CDN hostnames (googlevideo.com, rr*.sn-*.googlevideo.com) and
    // known Piped/Invidious proxy domains reject HEAD/range pre-checks but
    // work perfectly in the actual audio player. Trust them unconditionally.
    if (
      trusted ||
      url.includes('googlevideo.com') ||
      url.includes('.piped.') ||
      url.includes('piped.video') ||
      url.includes('piped.kavin') ||
      url.includes('pipedproxy.') ||
      url.includes('yt-cdn.') ||
      url.includes('invidious.')
    ) {
      return true;
    }

    // For legal / CDN sources, do a fast range-GET sanity check with a timeout.
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-1023' },
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      return res.ok || res.status === 206;
    } catch {
      // Network error or abort — be optimistic for audio playback
      return true;
    }
  }

  private static getLegalSource(track: Track) {
    if (
      track.sourceType === 'legal' ||
      track.sourceType === 'jamendo' ||
      track.sourceType === 'internet_archive'
    ) {
      return track.streamUrl;
    }
    return undefined;
  }

  private static isStableAudioCandidate(candidate: PipedStreamCandidate) {
    const descriptor = `${candidate.format} ${candidate.mimeType} ${candidate.url}`.toLowerCase();
    return (
      descriptor.includes('m4a') ||
      descriptor.includes('mp4') ||
      descriptor.includes('webm') ||
      descriptor.includes('audio/')
    );
  }

  private static finishAndCache(
    track: Track,
    url: string,
    sourceLabel: ResolvedPlaybackSource['sourceLabel'],
    attemptedSources: string[]
  ) {
    const cachedSources = getLocalJSON<Record<string, CachedSource>>(CACHE_KEY, {});
    cachedSources[track.id] = { url, sourceLabel, savedAt: Date.now() };
    setLocalJSON(CACHE_KEY, cachedSources);
    return this.finish(track, url, sourceLabel, attemptedSources);
  }

  private static finish(
    track: Track,
    url: string,
    sourceLabel: ResolvedPlaybackSource['sourceLabel'],
    attemptedSources: string[]
  ): ResolvedPlaybackSource {
    return {
      url,
      sourceLabel,
      attemptedSources,
      track: normalizeTrack({
        ...track,
        artist: track.artist || track.artistName,
        artwork: track.artwork || track.artworkUrl,
        album: track.album || track.albumName,
        streamUrl: url,
        sourceType:
          sourceLabel === 'Proxy'
            ? 'proxy'
            : sourceLabel === 'Downloaded'
              ? 'downloaded'
              : track.sourceType,
        sourceLabel,
        localUri: sourceLabel === 'Downloaded' ? url : track.localUri,
        sourceValidatedAt: Date.now(),
      }),
    };
  }
}
