// Direct YouTube InnerTube extraction — the same technique free apps like
// Joytify, NewPipe and ViMusic use. We hit YouTube's *private* /youtubei/v1/player
// endpoint with a mobile/TV client context. Those clients return audio stream
// URLs DIRECTLY in `streamingData.adaptiveFormats[].url` — already un-ciphered,
// with no `signatureCipher` to decrypt — so we never need youtubei.js (which can't
// bundle in Metro because of its Node-only deps: undici, jintr, readable-stream).
//
// This is what actually produces a full-length, reliable stream without depending
// on flaky community Piped/Invidious proxy instances.

import { Track } from '@/src/models/types';
import { normalizeTrack } from '@/src/services/search/trackNormalizer';

// Public InnerTube API key — baked into the YouTube web/mobile clients, not a secret.
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const PLAYER_ENDPOINT = `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`;

// YouTube Music search — returns real YouTube videoIds for any query, globally
// (verified working from UK). WEB_REMIX is YT Music's own web client.
const YTM_SEARCH_ENDPOINT = 'https://music.youtube.com/youtubei/v1/search?prettyPrint=false';
const YTM_CONTEXT = {
  client: { clientName: 'WEB_REMIX', clientVersion: '1.20240101.01.00', hl: 'en', gl: 'US' },
};
// Filter param that restricts results to Songs only (not videos/albums/artists).
const SONGS_FILTER_PARAMS = 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D';

const REQUEST_TIMEOUT_MS = 9000;

// Audio-only itags we accept, in order of preference. expo-audio plays AAC/m4a
// most reliably on both platforms, so m4a itags are ranked above opus/webm.
//   140 = m4a AAC ~128kbps   |   256/258 = m4a AAC ~192/384kbps (HE/LC)
//   251 = opus ~160kbps      |   250/249 = opus ~70/50kbps
const AUDIO_ITAG_PRIORITY = [256, 258, 140, 251, 250, 249, 139];

type AdaptiveFormat = {
  itag?: number;
  url?: string;
  mimeType?: string;
  bitrate?: number;
  audioQuality?: string;
  // present (instead of `url`) only on the WEB client — these clients never return it
  signatureCipher?: string;
  cipher?: string;
};

type PlayerResponse = {
  playabilityStatus?: { status?: string; reason?: string };
  streamingData?: {
    adaptiveFormats?: AdaptiveFormat[];
    formats?: AdaptiveFormat[];
  };
};

/**
 * Each client returns direct (un-ciphered) URLs but with different reliability /
 * availability. ANDROID_VR currently needs no PoToken and rarely throttles; the
 * iOS and TV-embedded clients are tried as fallbacks for videos the first refuses.
 */
const CLIENTS: Array<{ name: string; userAgent: string; context: Record<string, unknown> }> = [
  {
    name: 'ANDROID_VR',
    userAgent: 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; GB) gzip',
    context: {
      client: {
        clientName: 'ANDROID_VR',
        clientVersion: '1.60.19',
        deviceMake: 'Oculus',
        deviceModel: 'Quest 3',
        osName: 'Android',
        osVersion: '12',
        androidSdkVersion: 32,
        hl: 'en',
        gl: 'US',
      },
    },
  },
  {
    name: 'IOS',
    userAgent: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)',
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '19.45.4',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '18.1.0.22B83',
        hl: 'en',
        gl: 'US',
      },
    },
  },
  {
    name: 'TVHTML5_EMBED',
    userAgent:
      'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    context: {
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'en',
        gl: 'US',
      },
      thirdParty: { embedUrl: 'https://www.youtube.com' },
    },
  },
];

function pickBestAudioUrl(data: PlayerResponse): string | null {
  if (data.playabilityStatus?.status && data.playabilityStatus.status !== 'OK') {
    return null; // LOGIN_REQUIRED / AGE_VERIFICATION / UNPLAYABLE — let another client try
  }
  const formats = data.streamingData?.adaptiveFormats ?? [];
  const audio = formats.filter(
    (f) => f.url && (f.mimeType?.startsWith('audio/') || typeof f.audioQuality === 'string')
  );
  if (audio.length === 0) return null;

  // Prefer our known-good itags in priority order; fall back to highest bitrate.
  for (const itag of AUDIO_ITAG_PRIORITY) {
    const match = audio.find((f) => f.itag === itag);
    if (match?.url) return match.url;
  }
  const byBitrate = [...audio].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return byBitrate[0]?.url ?? null;
}

async function requestPlayer(videoId: string, client: (typeof CLIENTS)[number]): Promise<string | null> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(PLAYER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Only the User-Agent matters here — it must match the client we declare in
        // the body. We deliberately do NOT send X-YouTube-Client-Name/Version: those
        // are numeric client IDs that differ per client (ANDROID_VR=28, IOS=5, …) and
        // a mismatch with the body's clientName gets the request rejected.
        'User-Agent': client.userAgent,
        Origin: 'https://www.youtube.com',
      },
      body: JSON.stringify({
        ...client.context,
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
        playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const data: PlayerResponse = await res.json();
    return pickBestAudioUrl(data);
  } catch {
    clearTimeout(tid);
    return null;
  }
}

/**
 * Resolves a YouTube videoId to a direct, full-length audio stream URL by calling
 * the InnerTube player endpoint across several client contexts. Returns null only
 * if every client refuses (rare — usually region/age-locked videos), in which case
 * SourceResolver falls through to Piped → Invidious → Cobalt.
 */
export async function resolveViaInnertube(videoId: string): Promise<string | null> {
  if (!videoId) return null;
  for (const client of CLIENTS) {
    const url = await requestPlayer(videoId, client);
    if (url) return url;
  }
  return null;
}

export type InnertubeSelfTest = {
  ok: boolean;
  videoId: string;
  /** Per-client result, in the order they were tried. */
  clients: Array<{ name: string; ok: boolean; urlDomain: string | null; detail: string }>;
  /** First client that produced a playable URL, or null if all failed. */
  winningClient: string | null;
  durationMs: number;
};

function domainOf(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/^https?:\/\/([^/]+)/i);
  return m ? m[1] : null;
}

/**
 * Dev diagnostic — runs the InnerTube player call against a known-public videoId
 * across every client and reports which ones returned a direct audio URL. Lets you
 * confirm YouTube extraction works the moment the app launches, without playing a
 * song or digging through the player diagnostics panel.
 */
export async function runInnertubeSelfTest(
  videoId = 'dQw4w9WgXcQ'
): Promise<InnertubeSelfTest> {
  const startedAt = Date.now();
  const clients: InnertubeSelfTest['clients'] = [];
  let winningClient: string | null = null;

  for (const client of CLIENTS) {
    let url: string | null = null;
    let detail = '';
    try {
      url = await requestPlayer(videoId, client);
      detail = url ? 'got audio URL' : 'no audio URL (refused / locked)';
    } catch (e) {
      detail = e instanceof Error ? e.message : 'request error';
    }
    const ok = Boolean(url);
    if (ok && !winningClient) winningClient = client.name;
    clients.push({ name: client.name, ok, urlDomain: domainOf(url), detail });
  }

  return {
    ok: Boolean(winningClient),
    videoId,
    clients,
    winningClient,
    durationMs: Date.now() - startedAt,
  };
}

// ── YouTube Music search ─────────────────────────────────────────────────────
// The YT Music search response is a deeply nested render tree. Rather than walk
// the exact (and brittle) path, we recursively pull out the parts we need.

function findFirst(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  if (key in (obj as Record<string, unknown>)) return (obj as Record<string, unknown>)[key];
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const r = findFirst(v, key);
    if (r !== undefined) return r;
  }
  return undefined;
}

function collectByKey(obj: unknown, key: string, out: unknown[] = []): unknown[] {
  if (!obj || typeof obj !== 'object') return out;
  if (key in (obj as Record<string, unknown>)) out.push((obj as Record<string, unknown>)[key]);
  for (const v of Object.values(obj as Record<string, unknown>)) collectByKey(v, key, out);
  return out;
}

async function ytmSearch(query: string): Promise<unknown | null> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(YTM_SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Origin: 'https://music.youtube.com',
      },
      body: JSON.stringify({ context: YTM_CONTEXT, query, params: SONGS_FILTER_PARAMS }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(tid);
    return null;
  }
}

function parseDurationText(text: string): number {
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((total, p) => total * 60 + p, 0);
}

/**
 * Searches YouTube Music and returns playable Track objects, each carrying a real
 * YouTube videoId so SourceResolver can stream them full-length via InnerTube.
 * This is the primary, globally-available search source.
 */
export async function searchYouTubeTracks(query: string, limit = 15): Promise<Track[]> {
  const data = await ytmSearch(query);
  if (!data) return [];
  const items = collectByKey(data, 'musicResponsiveListItemRenderer');
  const tracks: Track[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    const videoId = findFirst(item, 'videoId') as string | undefined;
    if (!videoId || seen.has(videoId)) continue;

    const flex = (item.flexColumns as unknown[]) ?? [];
    const titleRuns =
      (findFirst(flex[0], 'runs') as Array<{ text?: string }> | undefined) ?? [];
    const title = titleRuns[0]?.text;
    if (!title) continue;

    const subRuns =
      (findFirst(flex[1], 'runs') as Array<{ text?: string }> | undefined) ?? [];
    const subTexts = subRuns.map((r) => r.text).filter((t): t is string => Boolean(t) && t !== ' • ');
    const artist = subTexts[0] || 'Unknown Artist';
    const durText = subTexts.find((t) => /^\d+:\d{2}$/.test(t));
    const duration = durText ? parseDurationText(durText) : 0;

    const thumbs = (findFirst(item, 'thumbnails') as Array<{ url?: string }> | undefined) ?? [];
    const artwork = thumbs.length ? thumbs[thumbs.length - 1]?.url : undefined;

    seen.add(videoId);
    tracks.push(
      normalizeTrack({
        id: `piped_${videoId}`,
        title,
        artist,
        artwork,
        duration,
        sourceType: 'piped',
        pipedVideoId: videoId,
        sourceLabel: 'Piped',
        genres: ['Music'],
        moodTags: ['youtube'],
      })
    );
    if (tracks.length >= limit) break;
  }
  return tracks;
}

/**
 * Finds the single best YouTube videoId for a track by title + artist. Used by
 * SourceResolver to give a full YouTube stream to tracks whose metadata came from
 * a non-YouTube source (e.g. a Deezer preview result).
 */
export async function searchYouTubeVideoId(title: string, artist: string): Promise<string | null> {
  const query = [title, artist].filter(Boolean).join(' ');
  if (!query) return null;
  const data = await ytmSearch(query);
  if (!data) return null;
  const items = collectByKey(data, 'musicResponsiveListItemRenderer');
  for (const item of items) {
    const videoId = findFirst(item, 'videoId') as string | undefined;
    if (videoId) return videoId;
  }
  // Fallback: any videoId anywhere in the response.
  return (findFirst(data, 'videoId') as string | undefined) ?? null;
}
