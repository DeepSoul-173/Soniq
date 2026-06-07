import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';

const REGISTRY_URL = 'https://piped-instances.pages.dev/data/public-instances.json';
const CACHE_KEY = 'soniq-piped-instances';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type CachedInstances = { urls: string[]; fetchedAt: number };

type InstanceEntry = {
  apiUrl?: string;
  api_url?: string;
  cdn?: boolean;
  uptime_7d?: number;
  uptime_24h?: number;
  [key: string]: unknown;
};

export class PipedInstanceService {
  /** Returns the last successfully cached list, or [] if the cache is empty. */
  static getInstances(): string[] {
    const cached = getLocalJSON<CachedInstances | null>(CACHE_KEY, null);
    return cached?.urls ?? [];
  }

  /**
   * Fetches the live Piped instance registry.
   * Returns the cached list immediately if it is less than 6 hours old.
   * On success, persists the new list and returns it.
   * On network failure, returns whatever is in the stale cache (may be []).
   */
  static async refresh(): Promise<string[]> {
    const cached = getLocalJSON<CachedInstances | null>(CACHE_KEY, null);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.urls.length >= 6) {
      return cached.urls;
    }

    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(REGISTRY_URL, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error('Unexpected registry format');

      const urls = (data as InstanceEntry[])
        .filter((entry) => {
          const url = entry.apiUrl ?? entry.api_url;
          if (typeof url !== 'string' || !url) return false;
          if (entry.cdn === true) return false;
          const uptime = entry.uptime_7d ?? entry.uptime_24h ?? 100;
          return (uptime as number) >= 50;
        })
        .map((entry) => (entry.apiUrl ?? entry.api_url) as string)
        .slice(0, 12);

      if (urls.length >= 3) {
        setLocalJSON<CachedInstances>(CACHE_KEY, { urls, fetchedAt: Date.now() });
        return urls;
      }
    } catch {
      // Network failure — return stale cache if available
      if (cached?.urls?.length) return cached.urls;
    }

    return [];
  }
}
