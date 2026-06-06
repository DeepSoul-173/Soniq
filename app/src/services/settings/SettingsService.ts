import { AppSettings, useSettingsStore } from '@/src/store/settingsStore';
import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';

const BACKUP_KEY = 'soniq-settings-backups';

export class SettingsService {
  static update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    useSettingsStore.getState().updateSetting(key, value);
  }

  static createBackup() {
    const backups = getLocalJSON<Array<{ id: string; createdAt: number; settings: AppSettings }>>(BACKUP_KEY, []);
    const backup = {
      id: `backup_${Date.now()}`,
      createdAt: Date.now(),
      settings: useSettingsStore.getState().settings,
    };
    setLocalJSON(BACKUP_KEY, [backup, ...backups].slice(0, 5));
    return backup;
  }

  static restoreLatestBackup() {
    const [latest] = getLocalJSON<Array<{ id: string; createdAt: number; settings: AppSettings }>>(BACKUP_KEY, []);
    if (!latest) return false;

    Object.entries(latest.settings).forEach(([key, value]) => {
      useSettingsStore.getState().updateSetting(key as keyof AppSettings, value as never);
    });
    return true;
  }

  static resetBackupLocation() {
    useSettingsStore.getState().updateSetting('autoBackupLocation', '');
  }
}
