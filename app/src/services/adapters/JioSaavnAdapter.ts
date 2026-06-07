import { Track } from '@/src/models/types';
import { normalizeTrack } from '@/src/services/search/trackNormalizer';

// Community-maintained JioSaavn API wrapper — returns full-length stream URLs.
const SAAVN_BASE = 'https://saavn.dev/api';

type SaavnImage = { quality: string; url: string };
type SaavnDownloadUrl = { quality: string; url: string };

type SaavnSong = {
  id: string;
  name: string;
  duration: string | number;
  language: string;
  image: SaavnImage[];
  downloadUrl: SaavnDownloadUrl[];
  primaryArtists: string;
  album: { id: string; name: string };
};

type SaavnSearchResponse = {
  status: string;
  data: { results: SaavnSong[] };
};

async function fetchSaavn<T>(url: string): Promise<T | null> {
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

function getBestUrl(urls: SaavnDownloadUrl[]): string | null {
  for (const q of ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps']) {
    const found = urls.find((u) => u.quality === q && u.url);
    if (found) return found.url;
  }
  return urls.find((u) => u.url)?.url ?? null;
}

function getBestImage(images: SaavnImage[]): string | null {
  return (images.find((i) => i.quality === '500x500') ?? images.slice(-1)[0])?.url ?? null;
}

function formatSong(s: SaavnSong): Track | null {
  const streamUrl = getBestUrl(s.downloadUrl);
  if (!streamUrl) return null;
  return normalizeTrack({
    id: `saavn_${s.id}`,
    title: s.name,
    artist: s.primaryArtists || 'Unknown Artist',
    artistId: `saavn_artist_${s.primaryArtists?.replace(/\s+/g, '_') ?? 'unknown'}`,
    artwork: getBestImage(s.image) ?? undefined,
    duration: typeof s.duration === 'string' ? parseInt(s.duration, 10) : (s.duration ?? 0),
    sourceType: 'legal',
    streamUrl,
    genres: [s.language || 'hindi'],
    moodTags: [s.language || 'hindi'],
    sourceLabel: 'JioSaavn',
  });
}

export class JioSaavnAdapter {
  static async searchTracks(query: string, limit = 10): Promise<Track[]> {
    const data = await fetchSaavn<SaavnSearchResponse>(
      `${SAAVN_BASE}/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=0`
    );
    if (data?.status !== 'SUCCESS' || !Array.isArray(data.data?.results)) return [];
    return data.data.results.map(formatSong).filter((t): t is Track => t !== null);
  }

  /** Used by SourceResolver — find a stream URL for a track by title + artist. */
  static async resolveTrack(title: string, artist: string): Promise<string | null> {
    const query = [title, artist].filter(Boolean).join(' ');
    const tracks = await this.searchTracks(query, 3);
    // Pick the track whose title most closely matches to avoid wrong results
    const normalized = title.toLowerCase();
    const best = tracks.find((t) => t.title.toLowerCase().includes(normalized)) ?? tracks[0];
    return best?.streamUrl ?? null;
  }
}
