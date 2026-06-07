import { Track } from '@/src/models/types';
import { normalizeTrack } from '@/src/services/search/trackNormalizer';

const DEEZER_BASE = 'https://api.deezer.com';

type DeezerTrack = {
  id: number;
  title: string;
  duration: number;
  preview: string;
  artist: { id: number; name: string; picture_medium: string };
  album: { id: number; title: string; cover_medium: string; cover_xl: string };
};

type DeezerArtist = {
  id: number;
  name: string;
  picture_medium: string;
  picture_xl: string;
};

async function fetchDeezer<T>(url: string): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function formatTrack(t: DeezerTrack): Track {
  return normalizeTrack({
    id: `deezer_${t.id}`,
    title: t.title,
    artist: t.artist.name,
    artistId: `deezer_artist_${t.artist.id}`,
    artwork: t.album.cover_xl || t.album.cover_medium || t.artist.picture_medium,
    duration: t.duration,
    sourceType: 'legal',
    streamUrl: t.preview,
    // Deezer's public API only ever returns a ~30s preview clip. Flag it so the
    // resolver never plays it as a full legal stream — it first tries to find a
    // full YouTube match, and only uses this preview as an absolute last resort.
    isPreviewOnly: true,
    genres: [],
    moodTags: [],
    sourceLabel: 'Deezer',
  });
}

export class DeezerAdapter {
  static async searchTracks(query: string, limit = 10): Promise<Track[]> {
    const data = await fetchDeezer<{ data: DeezerTrack[] }>(
      `${DEEZER_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    if (!data?.data) return [];
    return data.data.filter((t) => t.preview?.length > 0).map(formatTrack);
  }

  static async getArtistImage(name: string): Promise<string | null> {
    const data = await fetchDeezer<{ data: DeezerArtist[] }>(
      `${DEEZER_BASE}/search/artist?q=${encodeURIComponent(name)}&limit=1`
    );
    const a = data?.data?.[0];
    return a ? (a.picture_xl || a.picture_medium || null) : null;
  }

  static async getArtistTopTracks(artistName: string, limit = 10): Promise<Track[]> {
    const artists = await fetchDeezer<{ data: DeezerArtist[] }>(
      `${DEEZER_BASE}/search/artist?q=${encodeURIComponent(artistName)}&limit=1`
    );
    const artist = artists?.data?.[0];
    if (!artist) return this.searchTracks(`${artistName} top songs`, limit);

    const data = await fetchDeezer<{ data: DeezerTrack[] }>(
      `${DEEZER_BASE}/artist/${artist.id}/top?limit=${limit}`
    );
    if (!data?.data?.length) return this.searchTracks(artistName, limit);
    return data.data.filter((t) => t.preview).map(formatTrack);
  }

  /** Resolve a single streaming URL for a track by searching Deezer — used by SourceResolver. */
  static async resolvePreviewUrl(title: string, artist: string): Promise<string | null> {
    const tracks = await this.searchTracks(`${title} ${artist}`, 3);
    return tracks[0]?.streamUrl ?? null;
  }
}
