import { Track } from '@/src/models/types';
import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';

export type LyricsLine = {
  timeSeconds: number;
  text: string;
};

export type LyricsResult = {
  status: 'available' | 'unavailable';
  text: string;
  synced: boolean;
  lines: LyricsLine[]; // populated when synced === true
};

const LYRICS_KEY = 'soniq-lyrics-cache';

export class LyricsService {
  static async getLyrics(track: Track): Promise<LyricsResult> {
    const cache = getLocalJSON<Record<string, LyricsResult>>(LYRICS_KEY, {});
    if (cache[track.id]) return cache[track.id];

    const result = await this.fetchLyrics(track).catch(() => ({
      status: 'unavailable' as const,
      text: 'Lyrics unavailable',
      synced: false,
      lines: [],
    }));

    cache[track.id] = result;
    setLocalJSON(LYRICS_KEY, cache);
    return result;
  }

  /** Return the index of the line that should be highlighted at `positionSeconds`. */
  static currentLineIndex(lines: LyricsLine[], positionSeconds: number): number {
    if (!lines.length) return -1;
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timeSeconds <= positionSeconds) idx = i;
      else break;
    }
    return idx;
  }

  // ── Private ────────────────────────────────────────────────────────────

  private static async fetchLyrics(track: Track): Promise<LyricsResult> {
    const params = new URLSearchParams({
      track_name: track.title,
      artist_name: track.artist || track.artistName,
    });

    const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Lyrics lookup failed with HTTP ${response.status}`);
    }

    const results = await response.json();
    const match = Array.isArray(results) ? results[0] : null;

    const syncedRaw: string | null = match?.syncedLyrics ?? null;
    const plainRaw: string | null = match?.plainLyrics ?? null;

    if (syncedRaw) {
      const lines = this.parseLrc(syncedRaw);
      const plainText = lines.map((l) => l.text).join('\n');
      return { status: 'available', text: plainText, synced: true, lines };
    }

    if (plainRaw) {
      return { status: 'available', text: plainRaw, synced: false, lines: [] };
    }

    return { status: 'unavailable', text: 'Lyrics unavailable', synced: false, lines: [] };
  }

  /** Parse an LRC string into timestamped lines.
   *  Supports both `[MM:SS.xx]` and `[MM:SS.xxx]` formats.
   */
  private static parseLrc(lrc: string): LyricsLine[] {
    const lines: LyricsLine[] = [];
    const lineRegex = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/;

    for (const raw of lrc.split('\n')) {
      const match = raw.match(lineRegex);
      if (!match) continue;

      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centisRaw = match[3];
      // Normalise to centiseconds regardless of 2 or 3 decimal digits
      const centis = centisRaw.length === 3
        ? Math.round(parseInt(centisRaw, 10) / 10)
        : parseInt(centisRaw, 10);
      const timeSeconds = minutes * 60 + seconds + centis / 100;
      const text = match[4].trim();

      if (text) lines.push({ timeSeconds, text });
    }

    return lines.sort((a, b) => a.timeSeconds - b.timeSeconds);
  }
}
