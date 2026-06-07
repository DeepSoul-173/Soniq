import { Track } from '@/src/models/types';
import { PipedAdapter, PipedStreamCandidate } from '@/src/services/adapters/PipedAdapter';
import { normalizeTrack } from '@/src/services/search/trackNormalizer';
import { DownloadManager } from '@/src/services/downloads/DownloadManager';
import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';
import { useSettingsStore } from '@/src/store/settingsStore';
import { StreamCache } from '@/src/services/playback/StreamCache';
import { ResolverHealth } from '@/src/services/playback/ResolverHealth';
import { JioSaavnAdapter } from '@/src/services/adapters/JioSaavnAdapter';
import { DeezerAdapter } from '@/src/services/adapters/DeezerAdapter';
import { resolveViaInnertube, searchYouTubeVideoId } from '@/src/services/adapters/InnertubeAdapter';

export type PlaybackResolverState = 'buffering' | 'validating' | 'retrying' | 'ready' | 'failed';

/**
 * What kind of audio a resolved URL actually serves:
 *  - full_stream:  the complete track (YouTube/JioSaavn CDN, downloaded file, direct legal URL)
 *  - preview_only: a short clip — e.g. Deezer's public search API only ever returns ~30s previews
 *  - invalid:      resolution failed outright, no playable URL was produced
 * Playback must never silently treat a preview as a normal full-length source.
 */
export type StreamType = 'full_stream' | 'preview_only' | 'invalid';

export type ResolvedPlaybackSource = {
  track: Track;
  url: string;
  sourceLabel: 'Legal' | 'Piped' | 'Proxy' | 'Downloaded';
  streamType: StreamType;
  /** Stable resolver key that produced this URL — e.g. 'piped', 'jiosaavn', 'cache', 'downloaded'. */
  resolverName: string;
  attemptedSources: string[];
};

type CachedSource = {
  url: string;
  sourceLabel: ResolvedPlaybackSource['sourceLabel'];
  streamType: StreamType;
  resolverName: string;
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

// Cobalt instances — rotated sequentially to avoid hammering one endpoint.
const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt.api.timelessnesses.me',
  'https://cob.catto.moe',
];

const COBALT_LAST_KEY = 'soniq-cobalt-last-instance';

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
  // Resolver-level cooldown (incl. 429 backoff) is enforced by ResolverHealth
  // before this is ever called — see the RESOLVERS loop below.

  // Start from the last instance that succeeded to avoid always hitting index 0.
  const lastIdx = getLocalJSON<number>(COBALT_LAST_KEY, 0);
  const ordered = [
    ...COBALT_INSTANCES.slice(lastIdx),
    ...COBALT_INSTANCES.slice(0, lastIdx),
  ];

  for (let i = 0; i < ordered.length; i++) {
    const api = ordered[i];
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: 'audio',
          audioFormat: 'best',
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);

      if (res.status === 429) {
        // Rate-limited — tell ResolverHealth to cool Cobalt down for 30 minutes.
        ResolverHealth.recordFailure('cobalt', 30 * 60 * 1000);
        return null;
      }

      if (!res.ok) continue;

      const data = await res.json();
      if ((data.status === 'stream' || data.status === 'redirect') && data.url) {
        // Remember this instance so it's tried first next time.
        const absIdx = COBALT_INSTANCES.indexOf(api);
        if (absIdx >= 0) setLocalJSON(COBALT_LAST_KEY, absIdx);
        return data.url as string;
      }
    } catch {
      // network error — try next instance
    }
  }
  return null;
}

// ── Stream Resolution Layer ──────────────────────────────────────────────────
// Search results are metadata, not guaranteed-playable URLs (see SearchService).
// Each resolver below knows how to turn a Track into one playable stream URL
// from a specific public source. SourceResolver.resolve() tries them in an
// order driven by ResolverHealth — sources that have been working keep their
// priority; sources that keep failing or get rate-limited cool down and sink
// to the bottom — so the retry chain adapts itself over time instead of being
// hard-coded.

const videoIdOf = (track: Track) => track.pipedVideoId || track.id.replace(/^piped_/, '');

/** A track whose id actually maps to a YouTube videoId (vs. Deezer/JioSaavn metadata). */
const isYouTubeTrack = (track: Track) => Boolean(track.pipedVideoId) || track.id.startsWith('piped_');

type ResolveOutcome = { url: string; sourceLabel?: ResolvedPlaybackSource['sourceLabel'] } | null;

type StreamResolver = {
  /** Stable key used for health tracking — must never change once shipped. */
  name: string;
  sourceLabel: ResolvedPlaybackSource['sourceLabel'];
  statusMessage: string;
  /** Piped/Invidious/Cobalt CDN URLs return false 403s on pre-flight checks —
   *  trust them and let the audio player handle real failures. Legal/preview
   *  CDNs (Deezer, JioSaavn) are validated with a real range-GET. */
  trusted: boolean;
  /** What this resolver actually serves — drives ordering, caching, and UI labelling. */
  streamType: 'full_stream' | 'preview_only';
  canHandle: (track: Track) => boolean;
  resolve: (track: Track) => Promise<ResolveOutcome>;
};

const RESOLVERS: StreamResolver[] = [
  {
    name: 'innertube',
    sourceLabel: 'Piped',
    statusMessage: 'Fetching audio direct from YouTube',
    // Direct YouTube CDN URLs (googlevideo.com) return false 403s on HEAD/range
    // pre-flight even when they stream fine — trust them like the other YT sources.
    trusted: true,
    streamType: 'full_stream',
    // Direct InnerTube extraction — same method as Joytify/NewPipe/ViMusic. Tried
    // FIRST because it talks to YouTube directly instead of relying on flaky
    // community-run Piped/Invidious proxy instances. For tracks whose metadata came
    // from a non-YouTube source (e.g. a Deezer preview), we first search YouTube by
    // title + artist to obtain a real videoId — so EVERY track can get a full stream.
    canHandle: (track) => Boolean(videoIdOf(track) || track.title),
    resolve: async (track) => {
      let videoId: string | null = isYouTubeTrack(track) ? videoIdOf(track) : null;
      if (!videoId && track.title) {
        videoId = await searchYouTubeVideoId(track.title, track.artist || track.artistName || '').catch(
          () => null
        );
      }
      if (!videoId) return null;
      const url = await resolveViaInnertube(videoId).catch(() => null);
      return url ? { url, sourceLabel: 'Piped' } : null;
    },
  },
  {
    name: 'piped',
    sourceLabel: 'Piped',
    statusMessage: 'Fetching audio stream via Piped',
    trusted: true,
    streamType: 'full_stream',
    canHandle: (track) => Boolean(videoIdOf(track)),
    resolve: async (track) => {
      const candidates = await pipedAdapter.getStreamCandidates(videoIdOf(track)).catch(() => [] as PipedStreamCandidate[]);
      const top = candidates.find((c) => c.url);
      return top ? { url: top.url, sourceLabel: top.sourceLabel } : null;
    },
  },
  {
    name: 'jiosaavn',
    sourceLabel: 'Legal',
    statusMessage: 'Searching JioSaavn',
    trusted: true,
    streamType: 'full_stream',
    canHandle: (track) => Boolean(track.title),
    resolve: async (track) => {
      const url = await JioSaavnAdapter
        .resolveTrack(track.title, track.artist || track.artistName || '')
        .catch(() => null);
      return url ? { url } : null;
    },
  },
  {
    name: 'invidious',
    sourceLabel: 'Proxy',
    statusMessage: 'Trying Invidious fallback',
    trusted: true,
    streamType: 'full_stream',
    canHandle: (track) => Boolean(videoIdOf(track)),
    resolve: async (track) => {
      const url = await resolveViaInvidious(videoIdOf(track)).catch(() => null);
      return url ? { url } : null;
    },
  },
  {
    name: 'cobalt',
    sourceLabel: 'Proxy',
    statusMessage: 'Trying Cobalt fallback',
    trusted: true,
    streamType: 'full_stream',
    canHandle: (track) => Boolean(videoIdOf(track)),
    resolve: async (track) => {
      const url = await resolveViaCobalt(videoIdOf(track)).catch(() => null);
      return url ? { url } : null;
    },
  },
  {
    name: 'deezer',
    sourceLabel: 'Legal',
    statusMessage: 'Trying Deezer (30-second preview — last resort only)',
    trusted: true,
    // Deezer's public search API only ever exposes a ~30s `preview` clip, never
    // the full track. It must never be ranked or cached as if it were a normal
    // full-length source — see the two-phase resolution in `resolve()` below.
    streamType: 'preview_only',
    canHandle: (track) => Boolean(track.title),
    resolve: async (track) => {
      const url = await DeezerAdapter
        .resolvePreviewUrl(track.title, track.artist || track.artistName || '')
        .catch(() => null);
      return url ? { url } : null;
    },
  },
];

// Full-stream-capable resolvers are always tried first, in health-adapted order.
// Preview-only resolvers (Deezer) are only ever consulted as an absolute last
// resort, and are never allowed to be promoted ahead of full-stream sources —
// otherwise a "lucky" Deezer success rate would keep sinking playback to 30s clips.
const FULL_STREAM_RESOLVERS = RESOLVERS.filter((r) => r.streamType === 'full_stream');
const PREVIEW_RESOLVERS = RESOLVERS.filter((r) => r.streamType === 'preview_only');
const RESOLVER_BY_NAME = new Map(RESOLVERS.map((r) => [r.name, r]));

export class SourceResolver {
  static async resolve(track: Track, options: ResolveOptions = {}): Promise<ResolvedPlaybackSource> {
    const attemptedSources: string[] = [];
    const settings = useSettingsStore.getState().settings;
    const cachedSources = getLocalJSON<Record<string, CachedSource>>(CACHE_KEY, {});

    options.onState?.('buffering', 'Preparing source');

    // 1. Downloaded file — always preferred, always a full local copy
    if (settings.streamDownloadedSongsFirst) {
      const downloaded = await DownloadManager.getDownloadedTrack(track.id);
      if (downloaded?.localUri) {
        attemptedSources.push('Downloaded');
        return this.finish(track, downloaded.localUri, 'Downloaded', 'full_stream', 'downloaded', attemptedSources);
      }
    }

    // 1.5 Local audio file cache (expo-file-system) — only ever populated from full streams (see below)
    if (await StreamCache.isCached(track.id)) {
      attemptedSources.push('StreamCache');
      return this.finish(track, StreamCache.getPath(track.id), 'Downloaded', 'full_stream', 'cache', attemptedSources);
    }

    // 2. Fresh cache hit (25-minute TTL). Only trust entries written by this
    // version that carry streamType/resolverName — older entries (or anything
    // that slipped through as a preview) are treated as a miss and re-resolved.
    const cached = cachedSources[track.id];
    if (cached?.streamType === 'full_stream' && cached.resolverName && Date.now() - cached.savedAt < CACHE_TTL_MS) {
      attemptedSources.push(`${cached.sourceLabel} cache`);
      options.onState?.('validating', `Checking cached ${cached.sourceLabel} source`);
      // Piped/Proxy cache hits contain YouTube CDN URLs — trust them directly.
      const trusted = cached.sourceLabel !== 'Legal';
      if (await this.validateStreamUrl(cached.url, trusted)) {
        return this.finish(track, cached.url, cached.sourceLabel, cached.streamType, cached.resolverName, attemptedSources);
      }
    }

    // 3. Legal / direct source (Jamendo, Internet Archive — already a final, full-length URL)
    const legalUrl = this.getLegalSource(track);
    if (legalUrl) {
      attemptedSources.push('Legal');
      options.onState?.('validating', 'Checking legal source');
      if (await this.validateStreamUrl(legalUrl, false)) {
        return this.finishAndCache(track, legalUrl, 'Legal', 'full_stream', 'legal', attemptedSources);
      }
    }

    // 4. Full-stream resolvers first — Piped, JioSaavn, Invidious, Cobalt.
    // Order adapts to ResolverHealth: sources that keep working stay near the
    // front, sources that fail repeatedly or get rate-limited (e.g. Cobalt 429)
    // cool down and sink to the back automatically — but ALWAYS within this
    // full-stream group, never mixed with preview-only sources.
    const fullResult = await this.tryResolverGroup(FULL_STREAM_RESOLVERS, track, attemptedSources, options);
    if (fullResult) return fullResult;

    // 5. Absolute last resort — preview-only sources (Deezer's ~30s clips).
    // Tried only when every full-stream resolver has failed, marked clearly as
    // `preview_only`, and never written to any cache so the next play attempt
    // starts fresh and keeps looking for a full stream.
    const previewResult = await this.tryResolverGroup(PREVIEW_RESOLVERS, track, attemptedSources, options);
    if (previewResult) return previewResult;

    // 6. Existing-preview passthrough — a Deezer search result already carries its
    // ~30s preview in streamUrl. If no full stream could be found anywhere, play
    // that clip (clearly flagged preview_only, never cached) rather than failing.
    if (track.isPreviewOnly && track.streamUrl) {
      attemptedSources.push('Deezer (30s preview)');
      options.onState?.('ready', 'Preview only — no full stream available');
      return this.finish(track, track.streamUrl, 'Legal', 'preview_only', 'deezer', attemptedSources);
    }

    options.onState?.('failed', 'No playable source found');
    throw new Error(`No playable source found. Tried: ${attemptedSources.join(', ') || 'none'}`);
  }

  /** Tries each resolver in `group` (health-ordered within the group) and returns the first success. */
  private static async tryResolverGroup(
    group: StreamResolver[],
    track: Track,
    attemptedSources: string[],
    options: ResolveOptions
  ): Promise<ResolvedPlaybackSource | null> {
    const orderedNames = ResolverHealth.getOrderedNames(group.map((r) => r.name));
    for (const name of orderedNames) {
      const resolver = RESOLVER_BY_NAME.get(name);
      if (!resolver || !resolver.canHandle(track)) continue;
      if (ResolverHealth.isBlocked(name)) continue;

      options.onState?.(
        attemptedSources.length === 0 ? 'validating' : 'retrying',
        resolver.statusMessage
      );

      const startedAt = Date.now();
      try {
        const outcome = await resolver.resolve(track);
        if (!outcome?.url) {
          ResolverHealth.recordFailure(name);
          continue;
        }

        const sourceLabel = outcome.sourceLabel ?? resolver.sourceLabel;
        if (!(await this.validateStreamUrl(outcome.url, resolver.trusted))) {
          ResolverHealth.recordFailure(name);
          continue;
        }

        ResolverHealth.recordSuccess(name, Date.now() - startedAt);
        attemptedSources.push(resolver.streamType === 'preview_only' ? `${sourceLabel} (30s preview)` : sourceLabel);

        if (resolver.streamType === 'preview_only') {
          // Never persisted — keeps the door open for a full stream next time.
          return this.finish(track, outcome.url, sourceLabel, 'preview_only', resolver.name, attemptedSources);
        }

        // Only pre-download to the on-disk audio cache when the user has enabled it.
        if (useSettingsStore.getState().settings.cacheSongs) {
          StreamCache.backgroundCache(track.id, outcome.url);
        }
        return this.finishAndCache(track, outcome.url, sourceLabel, 'full_stream', resolver.name, attemptedSources);
      } catch {
        ResolverHealth.recordFailure(name);
      }
    }
    return null;
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
    // Preview-only tracks (Deezer's 30s clips) carry their preview in streamUrl but
    // must NEVER be served here as a full legal source — they're handled as an
    // absolute last resort in resolve() instead.
    if (track.isPreviewOnly) return undefined;
    if (
      track.sourceType === 'legal' ||
      track.sourceType === 'jamendo' ||
      track.sourceType === 'internet_archive'
    ) {
      return track.streamUrl;
    }
    return undefined;
  }

  private static finishAndCache(
    track: Track,
    url: string,
    sourceLabel: ResolvedPlaybackSource['sourceLabel'],
    streamType: StreamType,
    resolverName: string,
    attemptedSources: string[]
  ) {
    const cachedSources = getLocalJSON<Record<string, CachedSource>>(CACHE_KEY, {});
    cachedSources[track.id] = { url, sourceLabel, streamType, resolverName, savedAt: Date.now() };
    setLocalJSON(CACHE_KEY, cachedSources);
    return this.finish(track, url, sourceLabel, streamType, resolverName, attemptedSources);
  }

  private static finish(
    track: Track,
    url: string,
    sourceLabel: ResolvedPlaybackSource['sourceLabel'],
    streamType: StreamType,
    resolverName: string,
    attemptedSources: string[]
  ): ResolvedPlaybackSource {
    return {
      url,
      sourceLabel,
      streamType,
      resolverName,
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
        // A full stream clears the preview flag; a preview keeps it so the UI badge
        // and the next resolution attempt still know it's only a 30s clip.
        isPreviewOnly: streamType === 'preview_only' ? true : false,
      }),
    };
  }
}
