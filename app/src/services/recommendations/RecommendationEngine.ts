import { Track } from '@/src/models/types';
import { SearchService } from '@/src/services/search/SearchService';
import { PipedAdapter } from '@/src/services/adapters/PipedAdapter';
import { useLibraryStore } from '@/src/store/libraryStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import {
  dbGetOnRepeat,
  dbGetRecentlyDiscovered,
  dbGetRecentlyPlayed,
} from '@/src/services/database/LibraryDatabase';

export type ArtistRecommendation = {
  id: string;
  name: string;
  image?: string;
  reason: string;
};

export type AlbumRecommendation = {
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

const FALLBACK_INTERESTS = ['Electronic', 'Indie', 'Focus', 'Ambient', 'Rock', 'Acoustic'];
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

    // Secondary fallback: personalized seeds from user preferences
    if (related.length === 0) {
      const seeds = this.getPersonalizedSeeds();
      const query = seeds[0] ?? (artist || 'popular music');
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

  // ── Home screen recommendations (unchanged logic, compatible) ──────────────

  static async getHomeRecommendations(): Promise<HomeRecommendationSection[]> {
    const interests = this.getUserInterests();
    const { likedTracks, recentlyPlayed } = useLibraryStore.getState();
    const likedSeeds = likedTracks.slice(0, 4);
    const recentSeeds = recentlyPlayed.slice(0, 6);
    const primaryInterest = interests[0] || 'Music';

    const settings = useSettingsStore.getState().settings;
    const personalSeeds = this.getPersonalizedSeeds();
    const primarySeed = personalSeeds[0] ?? `${primaryInterest} songs`;

    // Language-aware trending: prefer user's top selected language
    const trendingLang = (settings.preferredLanguages ?? [])[0] ?? settings.musicLanguage;

    const [
      madeForYou, basedOnTypes, trending, moodMix,
      onRepeatDb, recentlyDiscoveredDb,
      globalHits, popularNow, newReleases,
    ] = await Promise.all([
      personalSeeds.length > 0
        ? SearchService.searchAll(primarySeed)
        : this.searchFromSeeds(likedSeeds, `${primaryInterest} songs`),
      SearchService.searchAll(`${interests.slice(0, 3).join(' ')} music`),
      SearchService.searchAll(`${trendingLang} trending songs 2025`),
      SearchService.searchAll(`${primaryInterest} ${settings.recommendationFreshness} mix`),
      dbGetOnRepeat(3, 30),
      dbGetRecentlyDiscovered(30),
      SearchService.searchAll('global top hits 2025'),
      SearchService.searchAll('most popular songs right now'),
      SearchService.searchAll('new music releases 2025'),
    ]);

    const continueListening = recentSeeds.length ? recentSeeds : madeForYou.slice(0, 6);
    const artistPool = [...likedSeeds, ...recentSeeds, ...basedOnTypes, ...madeForYou];
    const artists = this.buildArtistRecommendations(artistPool);
    const albums = this.buildAlbumRecommendations(artistPool);

    const onRepeat = onRepeatDb.length ? onRepeatDb : likedTracks.filter((t) => !!t.id).slice(0, 20);
    const recentlyDiscovered = recentlyDiscoveredDb.length
      ? recentlyDiscoveredDb
      : recentlyPlayed.slice(0, 20);

    const sections: HomeRecommendationSection[] = [
      {
        id: 'made_for_you',
        title: 'Made for You',
        subtitle: (settings.favoriteArtists ?? []).length > 0
          ? `Based on ${(settings.favoriteArtists ?? []).slice(0, 2).join(', ')}`
          : `Built from ${interests.slice(0, 3).join(', ') || 'your listening'}`,
        kind: 'tracks',
        tracks: madeForYou,
      },
    ];

    if (onRepeat.length) {
      sections.push({
        id: 'on_repeat',
        title: 'On Repeat',
        subtitle: 'Songs you keep coming back to',
        kind: 'tracks',
        tracks: onRepeat,
      });
    }

    sections.push(
      {
        id: 'based_on_types',
        title: 'Based on Your Types',
        subtitle: 'Liked genres and listening preferences',
        kind: 'tracks',
        tracks: basedOnTypes,
      },
      {
        id: 'artists',
        title: 'Artists You May Like',
        subtitle: 'Singers linked to your saved tracks',
        kind: 'artists',
        artists,
      },
      {
        id: 'albums',
        title: 'Albums Featuring Songs You Like',
        subtitle: 'Grouped from recent and liked music',
        kind: 'albums',
        albums,
      },
      {
        id: 'daily_mixes',
        title: 'Daily Mixes by Mood',
        subtitle: `${primaryInterest} and adjacent sounds`,
        kind: 'mixes',
        tracks: moodMix,
      },
      {
        id: 'continue',
        title: 'Continue Listening',
        subtitle: 'Recent tracks stored locally',
        kind: 'tracks',
        tracks: continueListening,
      },
    );

    if (recentlyDiscovered.length) {
      sections.push({
        id: 'recently_discovered',
        title: 'Recently Discovered',
        subtitle: 'New tracks from your last 7 days',
        kind: 'tracks',
        tracks: recentlyDiscovered,
      });
    }

    sections.push(
      {
        id: 'trending',
        title: 'Trending Now',
        subtitle: `${trendingLang} charts`,
        kind: 'tracks',
        tracks: trending,
      },
      {
        id: 'global_hits',
        title: 'Global Hits',
        subtitle: 'Top tracks worldwide',
        kind: 'tracks',
        tracks: globalHits,
      },
      {
        id: 'everyones_choice',
        title: "Everyone's Choice",
        subtitle: 'Most played right now',
        kind: 'tracks',
        tracks: popularNow,
      },
      {
        id: 'new_releases',
        title: 'New Releases',
        subtitle: 'Fresh drops this week',
        kind: 'tracks',
        tracks: newReleases,
      }
    );

    return sections;
  }

  private static getUserInterests() {
    const settings = useSettingsStore.getState().settings;
    const likedGenres = useLibraryStore.getState().likedTracks.flatMap((track) => track.genres || track.moodTags || []);
    const interests = [
      ...(settings.preferredListeningMoods ?? []),
      ...(settings.favoriteGenres ?? []),
      ...likedGenres,
    ].filter((item) => typeof item === 'string' && item.trim().length > 0);

    return Array.from(new Set(interests.length ? interests : FALLBACK_INTERESTS));
  }

  /** Returns search queries enriched with the user's favorite artists and languages. */
  private static getPersonalizedSeeds(): string[] {
    const settings = useSettingsStore.getState().settings;
    const artists = settings.favoriteArtists ?? [];
    const languages = settings.preferredLanguages ?? [];
    const genres = [...(settings.preferredListeningMoods ?? []), ...(settings.favoriteGenres ?? [])];

    const seeds: string[] = [];

    // Rotate artists into query seeds (top 3 to keep it focused)
    for (const artist of artists.slice(0, 3)) {
      const lang = languages[0];
      seeds.push(lang ? `${artist} ${lang} songs` : `${artist} best songs`);
    }

    // Language + genre combinations
    for (const lang of languages.slice(0, 2)) {
      const genre = genres[0];
      seeds.push(genre ? `${lang} ${genre} music` : `${lang} top songs`);
    }

    return seeds;
  }

  private static async searchFromSeeds(seeds: Track[], fallback: string) {
    if (seeds.length === 0) return SearchService.searchAll(fallback);

    const query = seeds
      .map((track) => track.artist || track.artistName || track.title)
      .filter(Boolean)
      .slice(0, 3)
      .join(' ');

    return SearchService.searchAll(query || fallback);
  }

  private static buildArtistRecommendations(tracks: Track[]): ArtistRecommendation[] {
    const artists = new Map<string, ArtistRecommendation>();

    tracks.forEach((track) => {
      const name = track.artist || track.artistName;
      if (!name || artists.has(name)) return;
      artists.set(name, {
        id: `artist_${name}`,
        name,
        image: track.artwork || track.artworkUrl,
        reason: track.genres?.[0] || track.moodTags?.[0] || 'Your listening history',
      });
    });

    return Array.from(artists.values()).slice(0, 10);
  }

  private static buildAlbumRecommendations(tracks: Track[]): AlbumRecommendation[] {
    const albums = new Map<string, AlbumRecommendation>();

    tracks.forEach((track) => {
      const title = track.album || track.albumName || `${track.artist || track.artistName} essentials`;
      if (albums.has(title)) {
        albums.get(title)?.tracks.push(track);
        return;
      }

      albums.set(title, {
        id: `album_${title}`,
        title,
        artist: track.artist || track.artistName,
        artwork: track.artwork || track.artworkUrl,
        tracks: [track],
      });
    });

    return Array.from(albums.values()).slice(0, 10);
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
