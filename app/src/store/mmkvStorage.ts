import { createMMKV } from 'react-native-mmkv';

export const appStorage = createMMKV({
  id: 'soniq-local-storage',
});

export const mmkvZustandStorage = {
  getItem: (name: string) => appStorage.getString(name) ?? null,
  setItem: (name: string, value: string) => {
    appStorage.set(name, value);
  },
  removeItem: (name: string) => {
    appStorage.remove(name);
  },
};
