import { Track } from '@/src/models/types';
import { SearchService } from '@/src/services/search/SearchService';
import { PipedAdapter } from '@/src/services/adapters/PipedAdapter';
import { DeezerAdapter } from '@/src/services/adapters/DeezerAdapter';
import { JamendoAdapter } from '@/src/services/adapters/JamendoAdapter';
import { useLibraryStore } from '@/src/store/libraryStore';
import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';
import { UserTasteEngine, TasteProfile } from '@/src/services/recommendations/UserTasteEngine';
import { useSettingsStore } from '@/src/store/settingsStore';
import {
  dbGetOnRepeat,
  dbGetRecentlyPlayed,
} from '@/src/services/database/LibraryDatabase';

// Bumped to -v2 when the curated artist roster was replaced with dynamic
// recommendations, so any stale cache holding the old hardcoded names is ignored.
const HOME_CACHE_KEY = 'soniq-home-cache-v2';
const HOME_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type HomeRecommendationsResult = {
  sections: HomeRecommendationSection[];
  loadMore: () => Promise<HomeRecommendationSection[]>;
};

export type ArtistRecommendation = {
  id: string;
  name: string;
  image?: string;
  reason: string;
  searchQuery?: string;
};

type AlbumRecommendation = {
  id: string;
  title: string;
  artist: string;
  artwork?: string;
  tracks: Track[];
};

export type HomeRecommendationSection = {
  id: string;
  title: string;
  subtitle: string;
  kind: 'tracks' | 'artists' | 'albums' | 'mixes';
  tracks?: Track[];
  artists?: ArtistRecommendation[];
  albums?: AlbumRecommendation[];
};

const pipedAdapter = new PipedAdapter();

// ── BaRT-style queue blending ────────────────────────────────────────────────
// For every 5 tracks in the auto-queue:
//   3 = "Explore" — YouTube Up Next / related tracks via Piped API (high-quality radio)
//   2 = "Exploit" — user's most played / recently loved tracks from SQLite

const EXPLORE_PER_BATCH = 3;
const EXPLOIT_PER_BATCH = 2;
const BATCH_SIZE = EXPLORE_PER_BATCH + EXPLOIT_PER_BATCH;

export class RecommendationEngine {
  /**
   * Returns a blended radio queue of `count` tracks for the current track.
   *
   * Explore (3/5): Piped `relatedStreams` for the videoId — the same videos
   *   YouTube would queue next; genre/vibe-matched, not keyword results.
   *
   * Exploit (2/5): user's SQLite history — "on repeat" + recently played tracks
   *   that share the current artist or genre.
   */
  static async getRadioQueue(currentTrack: Track, count = 20): Promise<Track[]> {
    const [exploreTracks, exploitTracks] = await Promise.all([
      this.fetchExploreTracks(currentTrack),
      this.fetchExploitTracks(currentTrack),
    ]);

    const seen = new Set<string>([currentTrack.id]);
    const result: Track[] = [];

    // Deduplicate helpers
    const takeExplore = exploitIfFresh(exploreTracks, seen);
    const takeExploit = exploitIfFresh(exploitTracks, seen);

    // Blend: 3 explore + 2 exploit per batch
    const batches = Math.ceil(count / BATCH_SIZE);
    for (let i = 0; i < batches && result.length < count; i++) {
      for (let e = 0; e < EXPLORE_PER_BATCH && result.length < count; e++) {
        const t = takeExplore();
        if (t) result.push(t);
      }
      for (let x = 0; x < EXPLOIT_PER_BATCH && result.length < count; x++) {
        const t = takeExploit();
        if (t) result.push(t);
      }
    }

    // If either pool ran dry, fill remainder from whatever's left
    const remainder = [...takeExplore.remaining(), ...takeExploit.remaining()]
      .filter((t) => !seen.has(t.id));
    for (const t of remainder) {
      if (result.length >= count) break;
      seen.add(t.id);
      result.push(t);
    }

    return result;
  }

  /** Compatibility shim — callers that only need one track (e.g. end-of-queue auto-add). */
  static async getNextRecommendation(currentTrack?: Track): Promise<Track | null> {
    if (!currentTrack) return null;
    const queue = await this.getRadioQueue(currentTrack, 1).catch(() => []);
    return queue[0] ?? null;
  }

  // ── Dynamic artist suggestions ─────────────────────────────────────────────
  // Blends, in priority order: (1) the artists you marked as favourites, (2) the
  // artists you actually play the most (from SQLite history), (3) RELATED artists
  // discovered live from YouTube's "Up Next" for your top track, and only then
  // (4) a language-matched curated fallback. The list shifts as your listening
  // changes — nothing here is a fixed hardcoded roster.

  private static async buildArtistRecommendations(
    profile: TasteProfile,
    favorites: string[]
  ): Promise<ArtistRecommendation[]> {
    const out: ArtistRecommendation[] = [];
    const seen = new Set<string>();
    const add = (name: string, reason: string) => {
      const clean = (name || '').trim();
      const key = clean.toLowerCase();
      if (!clean || key === 'unknown artist' || seen.has(key) || out.length >= 12) return;
      seen.add(key);
      out.push({
        id: `art_${key.replace(/\s+/g, '_')}`,
        name: clean,
        reason,
        searchQuery: `${clean} best songs`,
      });
    };

    // 1. Your favourites (chosen in Profile)
    for (const fav of favorites) add(fav, 'Your favourite');

    // 2. Most played (listening history)
    for (const a of profile.topArtists.slice(0, 6)) add(a.name, `Played ${a.count}×`);

    // 3. Related artists — discovered from the YouTube "Up Next" of your top track
    const seedTrack = profile.topTracks[0];
    const seedVideoId = seedTrack?.trackId?.replace(/^piped_/, '');
    if (seedVideoId && seedVideoId !== seedTrack?.trackId) {
      const related = await pipedAdapter.getRelatedStreams(seedVideoId).catch(() => [] as Track[]);
      const seedArtist = seedTrack?.artist || 'your taste';
      for (const t of related) {
        add(t.artist || t.artistName || '', `Related to ${seedArtist}`);
        if (out.length >= 12) break;
      }
    }

    // 4. Cold-start fallback — no favourites or history yet. Instead of a fixed
    // hardcoded roster, pull real artists from a LIVE trending search biased to the
    // user's main language, so even a brand-new user sees dynamic, current names.
    if (out.length < 8) {
      const lang = profile.dominantLanguages[0];
      const year = new Date().getFullYear();
      const query = lang && lang !== 'english' ? `top ${lang} songs ${year}` : `top songs ${year}`;
      const tracks = await SearchService.searchAll(query).catch(() => [] as Track[]);
      for (const t of tracks) {
        add(t.artist || t.artistName || '', 'Trending now');
        if (out.length >= 12) break;
      }
    }

    return out.slice(0, 12);
  }

  // ── Explore: YouTube Up Next via Piped relatedStreams ──────────────────────

  private static async fetchExploreTracks(currentTrack: Track): Promise<Track[]> {
    const videoId = currentTrack.pipedVideoId ?? currentTrack.id.replace(/^piped_/, '');
    const artist = currentTrack.artist || currentTrack.artistName || '';
    const reason = artist ? `Because you like ${artist}` : 'Soniq Radio';

    let related: Track[] = [];

    // Primary: real YouTube "Up Next" via Piped relatedStreams
    if (videoId && videoId !== currentTrack.id) {
      related = await pipedAdapter.getRelatedStreams(videoId).catch(() => []);
    }

    // Fallback: targeted artist + genre search
    if (related.length === 0) {
      const genre = currentTrack.genres?.[0] || currentTrack.moodTags?.[0] || '';
      const query = artist && genre
        ? `${artist} ${genre} songs`
        : artist
          ? `${artist} top songs`
          : 'popular music';
      related = await SearchService.searchAll(query).catch(() => []);
    }

    // Secondary fallback: generic popular music query
    if (related.length === 0) {
      const query = artist ? `${artist} popular songs` : `top songs ${new Date().getFullYear()}`;
      related = await SearchService.searchAll(query).catch(() => []);
    }

    return related.map((t) => ({ ...t, queueReason: reason }));
  }

  // ── Exploit: user's SQLite history — same artist / genre preference ─────────

  private static async fetchExploitTracks(currentTrack: Track): Promise<Track[]> {
    const artist = (currentTrack.artist || currentTrack.artistName || '').toLowerCase();
    const genres = new Set(
      [...(currentTrack.genres ?? []), ...(currentTrack.moodTags ?? [])].map((g) => g.toLowerCase())
    );

    const [onRepeat, recentlyPlayed, likedTracks] = await Promise.all([
      dbGetOnRepeat(2, 40),
      dbGetRecentlyPlayed(40),
      Promise.resolve(useLibraryStore.getState().likedTracks.slice(0, 40)),
    ]);

    const pool = dedup([...onRepeat, ...recentlyPlayed, ...likedTracks]);

    // Scoring: +2 if same artist, +1 if genre overlap, min 1 to keep some variety
    const scored = pool.map((t) => {
      const tArtist = (t.artist || t.artistName || '').toLowerCase();
      const tGenres = new Set([...(t.genres ?? []), ...(t.moodTags ?? [])].map((g) => g.toLowerCase()));
      const genreOverlap = [...genres].some((g) => tGenres.has(g));
      const score = (tArtist === artist && artist ? 2 : 0) + (genreOverlap ? 1 : 0);
      return { t, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const onRepeatIds = new Set(onRepeat.map((t) => t.id));
    const likedIds = new Set(likedTracks.map((t) => t.id));

    return scored.map(({ t }) => ({
      ...t,
      queueReason: onRepeatIds.has(t.id)
        ? 'On Repeat'
        : likedIds.has(t.id)
          ? 'You Liked This'
          : 'Recently Played',
    }));
  }

  // ── Home screen recommendations ───────────────────────────────────────────
  // Tiered loading: Tier 1 (local + Jamendo + one search) renders immediately;
  // Tier 2 (network-heavy) loads lazily with a 500 ms stagger to avoid
  // rate-limiting community Piped servers.

  static async getHomeRecommendations(): Promise<HomeRecommendationsResult> {
    const year = new Date().getFullYear();

    // Serve from MMKV cache if it's fresh (< 30 min old).
    const cached = getLocalJSON<{ sections: HomeRecommendationSection[]; savedAt: number }>(
      HOME_CACHE_KEY, { sections: [], savedAt: 0 }
    );
    if (cached.savedAt > 0 && Date.now() - cached.savedAt < HOME_CACHE_TTL) {
      return { sections: cached.sections, loadMore: async () => [] };
    }

    const { recentlyPlayed, likedTracks } = useLibraryStore.getState();
    const favoriteArtists = useSettingsStore.getState().settings.favoriteArtists ?? [];

    const profile = await UserTasteEngine.getProfile().catch((): TasteProfile => ({
      topArtists: [], topTracks: [], dominantLanguages: ['english'],
      totalListeningSeconds: 0, hasHistory: false, refreshedAt: 0,
    }));

    const queries = UserTasteEngine.getPersonalizedQueries(profile);
    const dominantLang = profile.dominantLanguages[0] ?? 'english';
    const isIndian = ['hindi', 'tamil', 'telugu', 'kannada', 'malayalam'].includes(dominantLang);
    const langLabel = dominantLang.charAt(0).toUpperCase() + dominantLang.slice(1);

    // ── TIER 1: fast — local DB + Jamendo + one personalised search ───────────
    const jamendoAdapter = new JamendoAdapter();
    const [madeForYou, onRepeatDb, jamendo, artistsWithImages] = await Promise.all([
      SearchService.searchAll(queries[0] ?? `top hits ${year}`),
      dbGetOnRepeat(3, 30).catch(() => [] as Track[]),
      jamendoAdapter.getTrendingTracks().catch(() => [] as Track[]),
      (async () => {
        const raw = await this.buildArtistRecommendations(profile, favoriteArtists);
        return Promise.all(
          raw.map(async (a) => {
            const image = await DeezerAdapter.getArtistImage(a.name).catch(() => null);
            return { ...a, image: image ?? undefined };
          })
        );
      })(),
    ]);

    const tier1: HomeRecommendationSection[] = [];

    if (recentlyPlayed.length > 0 && useSettingsStore.getState().settings.showRecentlyPlayed) {
      tier1.push({
        id: 'recently_played',
        title: 'Recently Played',
        subtitle: 'Pick up where you left off',
        kind: 'tracks',
        tracks: recentlyPlayed.slice(0, 20),
      });
    }

    tier1.push({
      id: 'made_for_you',
      title: profile.hasHistory ? 'Made For You' : 'Discover Music',
      subtitle: profile.hasHistory
        ? `Based on ${profile.topArtists.slice(0, 2).map((a) => a.name).join(', ') || 'your listening'}`
        : "Explore what's trending right now",
      kind: 'tracks',
      tracks: madeForYou,
    });

    tier1.push({
      id: 'artists',
      title: profile.hasHistory ? 'Your Artists' : 'Popular Artists',
      subtitle: profile.hasHistory
        ? 'Based on your listening history'
        : 'Tap an artist to play their top songs',
      kind: 'artists',
      artists: artistsWithImages,
    });

    if (jamendo.length > 0) {
      tier1.push({
        id: 'legal_picks',
        title: 'Legal Picks',
        subtitle: 'Free, licensed music via Jamendo',
        kind: 'tracks',
        tracks: jamendo,
      });
    }

    const onRepeat = onRepeatDb.length ? onRepeatDb : likedTracks.slice(0, 20);
    if (onRepeat.length > 0) {
      tier1.push({
        id: 'on_repeat',
        title: 'On Repeat',
        subtitle: 'Songs you keep coming back to',
        kind: 'tracks',
        tracks: onRepeat,
      });
    }

    // ── TIER 2: lazy — network-heavy searches, 500 ms stagger ─────────────────
    const loadMore = async (): Promise<HomeRecommendationSection[]> => {
      const tier2: HomeRecommendationSection[] = [];

      const globalHits = await SearchService.searchAll(`global top hits ${year}`).catch(() => [] as Track[]);
      tier2.push({ id: 'global_hits', title: 'Global Hits', subtitle: 'Top tracks worldwide right now', kind: 'tracks', tracks: globalHits });

      await delay(500);
      const langHits = await (isIndian
        ? SearchService.searchAll(`${dominantLang} hit songs`)
        : SearchService.searchAll(queries[1] ?? 'top songs right now')
      ).catch(() => [] as Track[]);
      tier2.push({ id: 'lang_hits', title: isIndian ? `${langLabel} Hits` : 'Chart Toppers', subtitle: isIndian ? `Top ${langLabel} songs` : 'Songs everyone is playing', kind: 'tracks', tracks: langHits });

      await delay(500);
      const trending = await SearchService.searchAll(`${dominantLang} top songs ${year}`).catch(() => [] as Track[]);
      tier2.push({ id: 'trending', title: 'Trending Now', subtitle: 'What people are listening to today', kind: 'tracks', tracks: trending });

      await delay(500);
      const newReleases = await SearchService.searchAll(`new music releases ${year}`).catch(() => [] as Track[]);
      tier2.push({ id: 'new_releases', title: 'New Releases', subtitle: 'Fresh drops this week', kind: 'tracks', tracks: newReleases });

      // Persist combined result to MMKV so the next visit is instant.
      setLocalJSON(HOME_CACHE_KEY, { sections: [...tier1, ...tier2], savedAt: Date.now() });
      return tier2;
    };

    return { sections: tier1, loadMore };
  }

}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dedup(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/** Returns a stateful iterator that pops tracks one at a time from an array,
 *  skipping IDs already in `seen` and recording each popped ID into `seen`.
 *  `.remaining()` returns all not-yet-popped items. */
function exploitIfFresh(tracks: Track[], seen: Set<string>) {
  let idx = 0;
  const pop = () => {
    while (idx < tracks.length) {
      const t = tracks[idx++];
      if (!seen.has(t.id)) {
        seen.add(t.id);
        return t;
      }
    }
    return null;
  };
  pop.remaining = () => tracks.slice(idx).filter((t) => !seen.has(t.id));
  return pop;
}
