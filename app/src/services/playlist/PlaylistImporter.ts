/**
 * PlaylistImporter — imports playlists from YouTube and Spotify URLs.
 *
 * YouTube: fetches tracks via Piped API /playlists/{id} (supports pagination).
 * Spotify: extracts track names + artists from the Spotify open-graph API
 *          (no auth required), then searches each via Piped to resolve streams.
 *
 * All resolved tracks are saved to SQLite via LibraryDatabase.
 * Returns a Playlist object ready for use in the app.
 */

import { Track, Playlist } from '@/src/models/types';
import { normalizeTrack } from '@/src/services/search/trackNormalizer';
import { dbUpsertTrack, dbSavePlaylist } from '@/src/services/database/LibraryDatabase';
import { SearchService } from '@/src/services/search/SearchService';

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://pipedapi.syncpundit.io',
];

// ── Piped API types ───────────────────────────────────────────────────────────

type PipedPlaylistResponse = {
  name?: string;
  description?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  nextpage?: string | null;
  relatedStreams?: PipedStreamItem[];
};

type PipedStreamItem = {
  url?: string;          // "/watch?v=xxxxx"
  title?: string;
  thumbnail?: string;
  uploaderName?: string;
  uploader?: string;
  uploaderUrl?: string;
  duration?: number;
  type?: string;
};

type SpotifyTrackMeta = {
  title: string;
  artist: string;
};

// ── URL parsers ───────────────────────────────────────────────────────────────

function extractYouTubePlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    // youtube.com/playlist?list=PL... or youtu.be with list param
    const listParam = parsed.searchParams.get('list');
    if (listParam) return listParam;
    // https://www.youtube.com/watch?v=xxx&list=PL...
    return null;
  } catch {
    const match = url.match(/[?&]list=([^&]+)/);
    return match?.[1] ?? null;
  }
}

function extractSpotifyPlaylistId(url: string): string | null {
  // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
  const match = url.match(/spotify\.com\/playlist\/([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

// ── Piped fetch helpers ───────────────────────────────────────────────────────

async function pipedFetch<T>(path: string): Promise<T> {
  const errors: string[] = [];
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}${path}`);
      if (!res.ok) { errors.push(`${base}: HTTP ${res.status}`); continue; }
      return (await res.json()) as T;
    } catch (err) {
      errors.push(`${base}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`Piped request failed for ${path}. ${errors.join(' | ')}`);
}

// Collect all pages of a playlist (up to maxPages to avoid run-away loops)
async function fetchAllPipedPlaylistTracks(
  playlistId: string,
  maxPages = 10
): Promise<{ name: string; description: string; thumbnail: string; items: PipedStreamItem[] }> {
  const first = await pipedFetch<PipedPlaylistResponse>(`/playlists/${encodeURIComponent(playlistId)}`);
  const items: PipedStreamItem[] = [...(first.relatedStreams ?? [])];
  let nextpage = first.nextpage;
  let page = 1;

  while (nextpage && page < maxPages) {
    try {
      const more = await pipedFetch<PipedPlaylistResponse>(
        `/nextpage/playlists/${encodeURIComponent(playlistId)}?nextpage=${encodeURIComponent(nextpage)}`
      );
      items.push(...(more.relatedStreams ?? []));
      nextpage = more.nextpage ?? null;
      page++;
    } catch {
      break;
    }
  }

  return {
    name: first.name ?? 'Imported Playlist',
    description: first.description ?? '',
    thumbnail: first.thumbnailUrl ?? first.bannerUrl ?? '',
    items,
  };
}

// ── Track normalisation ───────────────────────────────────────────────────────

function streamItemToTrack(item: PipedStreamItem): Track | null {
  const videoId = item.url?.match(/[?&]v=([^&]+)/)?.[1];
  if (!videoId || !item.title) return null;

  const artist = item.uploaderName ?? item.uploader ?? 'Unknown Artist';
  return normalizeTrack({
    id: `piped_${videoId}`,
    title: item.title,
    artist,
    artistId: item.uploaderUrl ?? `piped_artist_${artist}`,
    artwork: item.thumbnail,
    duration: typeof item.duration === 'number' ? item.duration : 0,
    sourceType: 'piped',
    pipedVideoId: videoId,
    lyricsAvailable: false,
    downloadAvailable: true,
    genres: ['Music'],
    moodTags: ['imported'],
    sourceLabel: 'Piped',
  });
}

// ── Spotify: open-graph embed metadata (no auth) ──────────────────────────────

async function fetchSpotifyTrackMetas(playlistId: string): Promise<SpotifyTrackMeta[]> {
  // Spotify's embed API exposes a public JSON endpoint for playlists.
  const url = `https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/${playlistId}`;
  // oembed only returns title + thumbnail — not track list.
  // For full track list we use the unofficial embed/playlist page and parse
  // the __NEXT_DATA__ JSON blob.  This is fragile; if it fails we bail out.
  try {
    const res = await fetch(
      `https://open.spotify.com/playlist/${playlistId}`,
      { headers: { 'Accept-Language': 'en-US', 'User-Agent': 'Mozilla/5.0' } }
    );
    const html = await res.text();
    const dataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
    if (!dataMatch) return [];

    const json = JSON.parse(dataMatch[1]);
    // Path varies by Spotify CDN version; try common paths
    const items: SpotifyTrackMeta[] = [];
    const playlist =
      json?.props?.pageProps?.state?.data?.entity?.trackList ??
      json?.props?.pageProps?.initialStoreState?.entities?.playlists?.[playlistId]?.tracks?.items ??
      [];

    for (const item of playlist) {
      const name = item?.track?.name ?? item?.title ?? item?.name;
      const artistList = item?.track?.artists ?? item?.artists ?? [];
      const artist = Array.isArray(artistList)
        ? artistList.map((a: { name?: string }) => a.name).filter(Boolean).join(', ')
        : typeof artistList === 'string' ? artistList : '';
      if (name) items.push({ title: name, artist });
    }

    return items;
  } catch {
    return [];
  }
}

async function resolveSpotifyTracks(metas: SpotifyTrackMeta[]): Promise<Track[]> {
  const results: Track[] = [];
  for (const meta of metas) {
    const query = `${meta.title} ${meta.artist}`.trim();
    try {
      const found = await SearchService.searchAll(query);
      if (found[0]) results.push(found[0]);
    } catch {
      // skip unresolvable tracks
    }
  }
  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ImportResult = {
  playlist: Playlist;
  trackCount: number;
  skipped: number;
};

export class PlaylistImporter {
  /**
   * Import a YouTube or Spotify playlist URL.
   * Saves tracks + playlist to SQLite and returns the Playlist.
   *
   * @throws Error if the URL is not recognised or the network request fails.
   */
  static async import(url: string, onProgress?: (loaded: number, total: number) => void): Promise<ImportResult> {
    const ytId = extractYouTubePlaylistId(url);
    if (ytId) return this.importYouTube(ytId, onProgress);

    const spotifyId = extractSpotifyPlaylistId(url);
    if (spotifyId) return this.importSpotify(spotifyId, onProgress);

    throw new Error(
      'Unrecognised playlist URL. Paste a YouTube playlist URL (youtube.com/playlist?list=...) ' +
      'or a Spotify playlist URL (open.spotify.com/playlist/...).'
    );
  }

  private static async importYouTube(
    playlistId: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<ImportResult> {
    const { name, description, thumbnail, items } = await fetchAllPipedPlaylistTracks(playlistId);

    const tracks: Track[] = [];
    let skipped = 0;

    for (let i = 0; i < items.length; i++) {
      const track = streamItemToTrack(items[i]);
      if (track) {
        tracks.push(track);
      } else {
        skipped++;
      }
      onProgress?.(i + 1, items.length);
    }

    const playlist: Playlist = {
      id: `yt_playlist_${playlistId}`,
      title: name,
      description,
      artworkUrl: thumbnail || undefined,
      tracks,
      createdAt: Date.now(),
      sourceType: 'youtube',
    };

    // Persist to SQLite (fire-and-forget per-track, await playlist)
    for (const track of tracks) {
      dbUpsertTrack(track).catch(() => undefined);
    }
    await dbSavePlaylist(playlist);

    return { playlist, trackCount: tracks.length, skipped };
  }

  private static async importSpotify(
    playlistId: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<ImportResult> {
    const metas = await fetchSpotifyTrackMetas(playlistId);
    if (metas.length === 0) {
      throw new Error(
        'Could not extract tracks from Spotify playlist. ' +
        'The playlist may be private or Spotify may have changed their page format.'
      );
    }

    const tracks: Track[] = [];
    let skipped = 0;

    for (let i = 0; i < metas.length; i++) {
      const query = `${metas[i].title} ${metas[i].artist}`.trim();
      try {
        const found = await SearchService.searchAll(query);
        if (found[0]) tracks.push(found[0]);
        else skipped++;
      } catch {
        skipped++;
      }
      onProgress?.(i + 1, metas.length);
    }

    const playlist: Playlist = {
      id: `spotify_playlist_${playlistId}`,
      title: `Spotify Playlist ${playlistId.slice(0, 8)}`,
      description: 'Imported from Spotify',
      artworkUrl: undefined,
      tracks,
      createdAt: Date.now(),
      sourceType: 'spotify',
    };

    for (const track of tracks) {
      dbUpsertTrack(track).catch(() => undefined);
    }
    await dbSavePlaylist(playlist);

    return { playlist, trackCount: tracks.length, skipped };
  }
}
