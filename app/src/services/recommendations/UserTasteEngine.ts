import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';
import {
  dbGetTopArtists,
  dbGetTopTracks,
  dbGetTotalListeningTime,
} from '@/src/services/database/LibraryDatabase';

const TASTE_KEY = 'soniq-taste-profile';
const TASTE_TTL = 30 * 60 * 1000; // 30 minutes

export type TasteProfile = {
  topArtists: Array<{ name: string; count: number; totalSeconds: number }>;
  topTracks: Array<{ trackId: string; title: string; artist: string; count: number }>;
  dominantLanguages: string[];
  totalListeningSeconds: number;
  hasHistory: boolean;
  refreshedAt: number;
};

// Known artist → primary language map
const ARTIST_LANG: Record<string, string> = {
  'arijit singh': 'hindi', 'atif aslam': 'hindi', 'shreya ghoshal': 'hindi',
  'neha kakkar': 'hindi', 'badshah': 'hindi', 'sonu nigam': 'hindi',
  'lata mangeshkar': 'hindi', 'kishore kumar': 'hindi', 'udit narayan': 'hindi',
  'kumar sanu': 'hindi', 'alka yagnik': 'hindi', 'jubin nautiyal': 'hindi',
  'armaan malik': 'hindi', 'darshan raval': 'hindi', 'b praak': 'hindi',
  'a.r. rahman': 'tamil', 'ar rahman': 'tamil', 'anirudh ravichander': 'tamil',
  'sid sriram': 'tamil', 'vijay antony': 'tamil', 'harris jayaraj': 'tamil',
  'devi sri prasad': 'telugu', 'thaman s': 'telugu', 's.s. thaman': 'telugu',
  'bts': 'korean', 'blackpink': 'korean', 'twice': 'korean',
  'stray kids': 'korean', 'exo': 'korean', 'seventeen': 'korean',
  'drake': 'english', 'the weeknd': 'english', 'taylor swift': 'english',
  'ariana grande': 'english', 'ed sheeran': 'english', 'dua lipa': 'english',
  'eminem': 'english', 'kendrick lamar': 'english', 'post malone': 'english',
  'billie eilish': 'english', 'harry styles': 'english', 'olivia rodrigo': 'english',
  'weeknd': 'english', 'rihanna': 'english', 'beyonce': 'english',
};

// Unicode script detection — returns a language string or null
function detectScript(text: string): string | null {
  if (/[ऀ-ॿ]/.test(text)) return 'hindi';
  if (/[஀-௿]/.test(text)) return 'tamil';
  if (/[ఀ-౿]/.test(text)) return 'telugu';
  if (/[ಀ-೿]/.test(text)) return 'kannada';
  if (/[ഀ-ൿ]/.test(text)) return 'malayalam';
  if (/[؀-ۿ]/.test(text)) return 'arabic';
  if (/[가-힯ᄀ-ᇿ]/.test(text)) return 'korean';
  if (/[぀-ヿ]/.test(text)) return 'japanese';
  return null;
}

export function detectLanguage(artistName: string, title = ''): string {
  const scriptLang = detectScript(`${artistName} ${title}`);
  if (scriptLang) return scriptLang;
  const lower = artistName.toLowerCase().trim();
  for (const [key, lang] of Object.entries(ARTIST_LANG)) {
    if (lower === key || lower.includes(key) || (key.length > 4 && key.includes(lower))) return lang;
  }
  return 'english';
}

const EMPTY: TasteProfile = {
  topArtists: [], topTracks: [], dominantLanguages: ['english'],
  totalListeningSeconds: 0, hasHistory: false, refreshedAt: 0,
};

export class UserTasteEngine {
  static async getProfile(): Promise<TasteProfile> {
    const cached = getLocalJSON<TasteProfile>(TASTE_KEY, EMPTY);
    if (cached.refreshedAt > 0 && Date.now() - cached.refreshedAt < TASTE_TTL) return cached;
    return this.refresh();
  }

  static async refresh(): Promise<TasteProfile> {
    const [topArtistsRaw, topTracksRaw, totalSeconds] = await Promise.all([
      dbGetTopArtists(10).catch(() => [] as Array<{ artist: string; count: number; totalSeconds: number }>),
      dbGetTopTracks(10).catch(() => [] as Array<{ trackId: string; title: string; artist: string; count: number; totalSeconds: number }>),
      dbGetTotalListeningTime().catch(() => 0),
    ]);

    // Language distribution from top artists
    const langCounts: Record<string, number> = {};
    for (const a of topArtistsRaw) {
      const lang = detectLanguage(a.artist);
      langCounts[lang] = (langCounts[lang] ?? 0) + a.count;
    }

    const dominantLanguages = Object.entries(langCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([lang]) => lang)
      .slice(0, 3);

    const profile: TasteProfile = {
      topArtists: topArtistsRaw.map((a) => ({ name: a.artist, count: a.count, totalSeconds: a.totalSeconds })),
      topTracks: topTracksRaw.map((t) => ({ trackId: t.trackId, title: t.title, artist: t.artist, count: t.count })),
      dominantLanguages: dominantLanguages.length > 0 ? dominantLanguages : ['english'],
      totalListeningSeconds: totalSeconds,
      hasHistory: topArtistsRaw.length > 0 || totalSeconds > 60,
      refreshedAt: Date.now(),
    };

    setLocalJSON(TASTE_KEY, profile);
    return profile;
  }

  /** Build search query strings for home screen sections. */
  static getPersonalizedQueries(profile: TasteProfile): string[] {
    const year = new Date().getFullYear();
    const queries: string[] = [];
    for (const a of profile.topArtists.slice(0, 3)) queries.push(`${a.name} best songs`);
    for (const lang of profile.dominantLanguages.slice(0, 2)) {
      queries.push(`top ${lang} songs ${year}`);
      if (lang !== 'english') queries.push(`best ${lang} hits`);
    }
    if (queries.length === 0) {
      queries.push(`top hindi songs ${year}`, 'global top hits');
    }
    return queries;
  }
}
