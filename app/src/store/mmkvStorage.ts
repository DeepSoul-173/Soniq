import { createMMKV } from 'react-native-mmkv';

// createMMKV is safe at module level in react-native-mmkv v4.
// The try/catch turns a cryptic native crash into a readable JS error that
// the RootErrorBoundary can display.
function initStorage(id: string) {
  try {
    return createMMKV({ id });
  } catch (e) {
    throw new Error(
      `[Soniq] MMKV storage "${id}" failed to initialize. ` +
        `Make sure you built a dev/production build — MMKV does not work in Expo Go. ` +
        `Original: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

export const appStorage = initStorage('soniq-local-storage');

export const mmkvZustandStorage = {
  getItem: (name: string) => appStorage.getString(name) ?? null,
  setItem: (name: string, value: string) => {
    appStorage.set(name, value);
  },
  removeItem: (name: string) => {
    appStorage.remove(name);
  },
};

export function getLocalJSON<T>(key: string, fallback: T): T {
  const raw = appStorage.getString(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setLocalJSON<T>(key: string, value: T) {
  appStorage.set(key, JSON.stringify(value));
}

export function removeLocalValue(key: string) {
  appStorage.remove(key);
}
