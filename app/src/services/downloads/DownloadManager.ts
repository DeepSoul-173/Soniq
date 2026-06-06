import * as FileSystem from 'expo-file-system/legacy';
import { Track } from '@/src/models/types';
import { normalizeTrack } from '@/src/services/search/trackNormalizer';
import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';

export type DownloadState = 'idle' | 'downloading' | 'completed' | 'failed';

export type DownloadRecord = {
  track: Track;
  localUri?: string;
  progress: number;
  state: DownloadState;
  error?: string;
  updatedAt: number;
};

const DOWNLOADS_KEY = 'soniq-download-records';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory || ''}soniq-downloads/`;

export class DownloadManager {
  static getDownloads() {
    return getLocalJSON<Record<string, DownloadRecord>>(DOWNLOADS_KEY, {});
  }

  static async getDownloadedTrack(trackId: string): Promise<DownloadRecord | null> {
    const record = this.getDownloads()[trackId];
    if (!record?.localUri || record.state !== 'completed') return null;

    const info = await FileSystem.getInfoAsync(record.localUri);
    return info.exists ? record : null;
  }

  static canDownload(track: Track) {
    return Boolean(track.downloadAvailable && track.sourceType !== 'piped' && track.sourceType !== 'proxy');
  }

  static async downloadTrack(
    track: Track,
    onProgress?: (progress: number, state: DownloadState) => void
  ): Promise<DownloadRecord> {
    const records = this.getDownloads();
    const existing = await this.getDownloadedTrack(track.id);
    if (existing) return existing;

    if (!this.canDownload(track)) {
      const failed = this.saveRecord(track, undefined, 0, 'failed', 'This source does not allow downloads.');
      onProgress?.(0, 'failed');
      return failed;
    }

    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true }).catch(() => undefined);

    if (!track.streamUrl) {
      const failed = this.saveRecord(track, undefined, 0, 'failed', 'No downloadable stream URL is available yet.');
      onProgress?.(0, 'failed');
      return failed;
    }

    const extension = this.getExtension(track.streamUrl);
    const fileUri = `${DOWNLOAD_DIR}${encodeURIComponent(track.id)}.${extension}`;

    records[track.id] = this.saveRecord(track, undefined, 0, 'downloading');
    onProgress?.(0, 'downloading');

    try {
      const result = await FileSystem.downloadAsync(track.streamUrl, fileUri);
      const completedTrack = normalizeTrack({
        ...track,
        artist: track.artist || track.artistName,
        artwork: track.artwork || track.artworkUrl,
        album: track.album || track.albumName,
        streamUrl: result.uri,
        sourceType: 'downloaded',
        sourceLabel: 'Downloaded',
        localUri: result.uri,
        downloadAvailable: true,
      });
      const completed = this.saveRecord(completedTrack, result.uri, 1, 'completed');
      onProgress?.(1, 'completed');
      return completed;
    } catch (error) {
      const failed = this.saveRecord(track, undefined, 0, 'failed', error instanceof Error ? error.message : String(error));
      onProgress?.(0, 'failed');
      return failed;
    }
  }

  static saveRecord(track: Track, localUri: string | undefined, progress: number, state: DownloadState, error?: string) {
    const records = this.getDownloads();
    const record: DownloadRecord = {
      track: localUri ? { ...track, localUri, streamUrl: localUri, sourceType: 'downloaded', sourceLabel: 'Downloaded' } : track,
      localUri,
      progress,
      state,
      error,
      updatedAt: Date.now(),
    };
    records[track.id] = record;
    setLocalJSON(DOWNLOADS_KEY, records);
    return record;
  }

  private static getExtension(url: string) {
    const clean = url.split('?')[0].toLowerCase();
    if (clean.endsWith('.webm')) return 'webm';
    if (clean.endsWith('.m4a')) return 'm4a';
    if (clean.endsWith('.ogg')) return 'ogg';
    return 'mp3';
  }
}
