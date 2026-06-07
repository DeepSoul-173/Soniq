/**
 * LibraryDatabase — expo-sqlite backend for liked tracks, playlists, and
 * play-history.  MMKV is kept for fast key-value settings; SQLite handles the
 * relational library data that can grow to thousands of rows.
 *
 * Install expo-sqlite to activate:
 *   npx expo install expo-sqlite
 *
 * Until installed every method gracefully returns empty results / no-ops so
 * the app continues to work with the Zustand MMKV fallback.
 */

import { Track, Playlist } from '@/src/models/types';

// Duck-typed DB interface — matches expo-sqlite's SQLiteDatabase API surface
// that we actually call. Using any here because the package may not be installed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SQLite: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SQLite = require('expo-sqlite');
} catch {
  // expo-sqlite not installed — all methods gracefully return empty results
}

// Promise-based singleton: concurrent getDb() calls share one init promise
// instead of racing to create multiple database instances.
let _dbPromise: Promise<DB | null> | null = null;

function getDb(): Promise<DB | null> {
  if (!SQLite) return Promise.resolve(null);
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db: DB = await SQLite.openDatabaseAsync('soniq_library.db');

      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS tracks (
          id             TEXT    PRIMARY KEY,
          data           TEXT    NOT NULL,
          liked          INTEGER NOT NULL DEFAULT 0,
          play_count     INTEGER NOT NULL DEFAULT 0,
          last_played_at INTEGER NOT NULL DEFAULT 0,
          added_at       INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS playlists (
          id   TEXT PRIMARY KEY,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS play_history (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          track_id  TEXT    NOT NULL,
          played_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_history_played_at ON play_history (played_at DESC);
        CREATE INDEX IF NOT EXISTS idx_tracks_liked      ON tracks (liked, last_played_at DESC);

        CREATE TABLE IF NOT EXISTS listening_history (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          track_id    TEXT    NOT NULL,
          title       TEXT    NOT NULL DEFAULT '',
          artist      TEXT    NOT NULL DEFAULT '',
          timestamp   INTEGER NOT NULL,
          duration_s  INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_lh_timestamp ON listening_history (timestamp DESC);
      `);

      return db;
    })().catch((e) => {
      console.warn('[LibraryDatabase] Initialization failed — falling back to MMKV:', e);
      _dbPromise = null; // allow a retry on the next operation
      return null;
    });
  }
  return _dbPromise;
}

// ── Tracks ───────────────────────────────────────────────────────────────────

export async function dbUpsertTrack(track: Track): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO tracks (id, data, added_at)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    [track.id, JSON.stringify(track), Date.now()]
  );
}

export async function dbSetLiked(trackId: string, liked: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('UPDATE tracks SET liked = ? WHERE id = ?', [liked ? 1 : 0, trackId]);
}

export async function dbGetLikedTracks(): Promise<Track[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.getAllAsync(
    'SELECT data FROM tracks WHERE liked = 1 ORDER BY last_played_at DESC'
  );
  return rows.map((r: { data: string }) => JSON.parse(r.data) as Track);
}

// ── Play history ─────────────────────────────────────────────────────────────

export async function dbRecordPlay(track: Track): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Upsert track row
  await dbUpsertTrack(track);

  // Update play stats
  await db.runAsync(
    'UPDATE tracks SET play_count = play_count + 1, last_played_at = ? WHERE id = ?',
    [Date.now(), track.id]
  );

  // Append to history (cap at 500 rows)
  await db.runAsync(
    'INSERT INTO play_history (track_id, played_at) VALUES (?, ?)',
    [track.id, Date.now()]
  );
  await db.runAsync(
    `DELETE FROM play_history WHERE id NOT IN (
       SELECT id FROM play_history ORDER BY played_at DESC LIMIT 500
     )`
  );
}

export async function dbGetRecentlyPlayed(limit = 50): Promise<Track[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.getAllAsync(
    `SELECT t.data FROM play_history h
     JOIN tracks t ON t.id = h.track_id
     GROUP BY h.track_id
     ORDER BY MAX(h.played_at) DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r: { data: string }) => JSON.parse(r.data) as Track);
}

/** Tracks played ≥ minCount times — used by "On Repeat" smart playlist. */
export async function dbGetOnRepeat(minCount = 3, limit = 30): Promise<Track[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.getAllAsync(
    'SELECT data FROM tracks WHERE play_count >= ? ORDER BY play_count DESC LIMIT ?',
    [minCount, limit]
  );
  return rows.map((r: { data: string }) => JSON.parse(r.data) as Track);
}

/** Tracks played only once and recently — "Recently Discovered". */
export async function dbGetRecentlyDiscovered(limit = 30): Promise<Track[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // last 7 days
  const rows = await db.getAllAsync(
    'SELECT data FROM tracks WHERE play_count = 1 AND last_played_at >= ? ORDER BY last_played_at DESC LIMIT ?',
    [cutoff, limit]
  );
  return rows.map((r: { data: string }) => JSON.parse(r.data) as Track);
}

// ── Listening history (duration-aware) ───────────────────────────────────────

export async function dbRecordListeningHistory(track: Track, durationSeconds: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    'INSERT INTO listening_history (track_id, title, artist, timestamp, duration_s) VALUES (?, ?, ?, ?, ?)',
    [
      track.id,
      track.title || '',
      track.artist || track.artistName || '',
      Date.now(),
      Math.round(durationSeconds),
    ]
  );
  // Cap at 2000 rows
  await db.runAsync(
    `DELETE FROM listening_history WHERE id NOT IN (
       SELECT id FROM listening_history ORDER BY timestamp DESC LIMIT 2000
     )`
  );
}

export async function dbGetTopArtists(
  limit = 5
): Promise<Array<{ artist: string; totalSeconds: number; count: number }>> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync(
    `SELECT artist,
            SUM(duration_s) AS totalSeconds,
            COUNT(*)        AS count
       FROM listening_history
      WHERE artist != ''
      GROUP BY artist
      ORDER BY totalSeconds DESC
      LIMIT ?`,
    [limit]
  );
}

export async function dbGetTopTracks(
  limit = 5
): Promise<Array<{ trackId: string; title: string; artist: string; totalSeconds: number; count: number }>> {
  const db = await getDb();
  if (!db) return [];
  return db.getAllAsync(
    `SELECT track_id AS trackId,
            title,
            artist,
            SUM(duration_s) AS totalSeconds,
            COUNT(*)        AS count
       FROM listening_history
      GROUP BY track_id
      ORDER BY totalSeconds DESC
      LIMIT ?`,
    [limit]
  );
}

export async function dbGetTotalListeningTime(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.getAllAsync('SELECT SUM(duration_s) AS total FROM listening_history');
  return (rows[0] as { total: number | null })?.total ?? 0;
}

// ── Playlists ─────────────────────────────────────────────────────────────────

export async function dbSavePlaylist(playlist: Playlist): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO playlists (id, data) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    [playlist.id, JSON.stringify(playlist)]
  );
}

export async function dbRemovePlaylist(playlistId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.runAsync('DELETE FROM playlists WHERE id = ?', [playlistId]);
}

export async function dbGetPlaylists(): Promise<Playlist[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.getAllAsync('SELECT data FROM playlists');
  return rows.map((r: { data: string }) => JSON.parse(r.data) as Playlist);
}
