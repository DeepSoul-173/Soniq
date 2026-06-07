// SDK 54 replaced the old path/Async-based API with File/Directory classes —
// `expo-file-system/legacy` keeps the familiar cacheDirectory/getInfoAsync surface.
import * as FileSystem from 'expo-file-system/legacy';
import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';

const CACHE_DIR = (FileSystem.cacheDirectory ?? 'file://') + 'audio/';
const MAX_CACHED = 25;
const META_KEY = 'soniq-stream-cache';

type CacheEntry = { trackId: string; path: string; cachedAt: number };

export class StreamCache {
  static getPath(trackId: string): string {
    const safe = trackId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${CACHE_DIR}${safe}.audio`;
  }

  static async isCached(trackId: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(this.getPath(trackId));
      return info.exists;
    } catch {
      return false;
    }
  }

  static async cacheStream(trackId: string, url: string): Promise<string | null> {
    try {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      await this.evictIfNeeded();
      const path = this.getPath(trackId);
      const result = await FileSystem.downloadAsync(url, path);
      if (result.status === 200) {
        const meta = getLocalJSON<CacheEntry[]>(META_KEY, []);
        const filtered = meta.filter((e) => e.trackId !== trackId);
        filtered.push({ trackId, path, cachedAt: Date.now() });
        setLocalJSON(META_KEY, filtered);
        return path;
      }
    } catch { /* best-effort */ }
    return null;
  }

  static backgroundCache(trackId: string, url: string): void {
    this.cacheStream(trackId, url).catch(() => undefined);
  }

  static async evictIfNeeded(): Promise<void> {
    const meta = getLocalJSON<CacheEntry[]>(META_KEY, []);
    if (meta.length < MAX_CACHED) return;
    const sorted = [...meta].sort((a, b) => a.cachedAt - b.cachedAt);
    const toRemove = sorted.slice(0, meta.length - MAX_CACHED + 1);
    await Promise.all(
      toRemove.map((e) => FileSystem.deleteAsync(e.path, { idempotent: true }).catch(() => undefined))
    );
    const keep = meta.filter((e) => !toRemove.some((r) => r.trackId === e.trackId));
    setLocalJSON(META_KEY, keep);
  }
}
