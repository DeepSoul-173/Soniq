import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';

// Generalises the old Cobalt-only "blocked until X" pattern into a shared,
// MMKV-backed health tracker that any stream resolver can report into.
// SourceResolver uses this to skip cooling-down resolvers and to re-order
// its retry chain toward whichever sources have actually been working.

const HEALTH_KEY = 'soniq-resolver-health';
const CONSECUTIVE_FAILURE_LIMIT = 3;
const AUTO_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes after repeated failures

type HealthEntry = {
  successes: number;
  failures: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  blockedUntil: number;
  updatedAt: number;
};

export type ResolverStatus = {
  name: string;
  successRate: number; // 0..1, defaults to 0.5 (unknown) when never attempted
  avgLatencyMs: number;
  blocked: boolean;
  blockedUntil: number;
};

const EMPTY_ENTRY: HealthEntry = {
  successes: 0,
  failures: 0,
  consecutiveFailures: 0,
  avgLatencyMs: 0,
  blockedUntil: 0,
  updatedAt: 0,
};

function readAll(): Record<string, HealthEntry> {
  return getLocalJSON<Record<string, HealthEntry>>(HEALTH_KEY, {});
}

function writeAll(map: Record<string, HealthEntry>) {
  setLocalJSON(HEALTH_KEY, map);
}

export class ResolverHealth {
  /** True while `name` is in its cooldown window — the resolver should be skipped. */
  static isBlocked(name: string): boolean {
    const entry = readAll()[name];
    return Boolean(entry && Date.now() < entry.blockedUntil);
  }

  /** Record a working stream — clears any cooldown and improves the resolver's ranking. */
  static recordSuccess(name: string, latencyMs: number): void {
    const map = readAll();
    const prev = map[name] ?? EMPTY_ENTRY;
    map[name] = {
      ...prev,
      successes: prev.successes + 1,
      consecutiveFailures: 0,
      avgLatencyMs: prev.avgLatencyMs > 0 ? Math.round((prev.avgLatencyMs + latencyMs) / 2) : latencyMs,
      blockedUntil: 0,
      updatedAt: Date.now(),
    };
    writeAll(map);
  }

  /**
   * Record a failed attempt.
   * @param explicitCooldownMs  Pass this when the source itself signalled a hard
   *   stop (e.g. HTTP 429) so it gets blocked immediately for that long. Without
   *   it, the resolver only cools down after `CONSECUTIVE_FAILURE_LIMIT` misses in
   *   a row, so a single transient error doesn't sink an otherwise-healthy source.
   */
  static recordFailure(name: string, explicitCooldownMs?: number): void {
    const map = readAll();
    const prev = map[name] ?? EMPTY_ENTRY;
    const consecutiveFailures = prev.consecutiveFailures + 1;
    const blockedUntil = explicitCooldownMs
      ? Date.now() + explicitCooldownMs
      : consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT
        ? Date.now() + AUTO_COOLDOWN_MS
        : prev.blockedUntil;

    map[name] = {
      ...prev,
      failures: prev.failures + 1,
      consecutiveFailures,
      blockedUntil,
      updatedAt: Date.now(),
    };
    writeAll(map);
  }

  /**
   * Returns `names` reordered so that healthier, currently-unblocked resolvers
   * are tried first. Resolvers with no history yet (score 0.5) keep their
   * original relative order — new sources get a fair first try rather than
   * being pushed to the back. Blocked resolvers always sink to the bottom.
   */
  static getOrderedNames(names: string[]): string[] {
    const map = readAll();
    const now = Date.now();

    const score = (name: string) => {
      const entry = map[name];
      if (!entry) return 0.5;
      const total = entry.successes + entry.failures;
      return total === 0 ? 0.5 : entry.successes / total;
    };
    const blocked = (name: string) => {
      const entry = map[name];
      return Boolean(entry && now < entry.blockedUntil);
    };

    return [...names].sort((a, b) => {
      const blockedA = blocked(a);
      const blockedB = blocked(b);
      if (blockedA !== blockedB) return blockedA ? 1 : -1;
      return score(b) - score(a); // stable sort — ties keep declared priority order
    });
  }

  /** Snapshot for surfacing "source status" in the UI (e.g. a debug/about screen). */
  static getStatus(name: string): ResolverStatus {
    const entry = readAll()[name];
    if (!entry) {
      return { name, successRate: 0.5, avgLatencyMs: 0, blocked: false, blockedUntil: 0 };
    }
    const total = entry.successes + entry.failures;
    return {
      name,
      successRate: total === 0 ? 0.5 : entry.successes / total,
      avgLatencyMs: entry.avgLatencyMs,
      blocked: Date.now() < entry.blockedUntil,
      blockedUntil: entry.blockedUntil,
    };
  }

  static getAllStatuses(names: string[]): ResolverStatus[] {
    return names.map((n) => this.getStatus(n));
  }
}
