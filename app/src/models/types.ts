export type PlaybackSourceType = 'legal' | 'piped' | 'proxy' | 'jamendo' | 'internet_archive' | 'downloaded';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  duration: number; // in seconds
  streamUrl?: string;
  sourceType: PlaybackSourceType;
  lyricsAvailable: boolean;
  downloadAvailable: boolean;
  genres: string[];
  moodTags: string[];

  // Backward-compatible aliases used by older UI components during migration.
  artistId: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  artworkUrl?: string;

  pipedVideoId?: string; // Used to resolve Piped streams just before playback
  tags?: string[];
  genre?: string;
  // Provenance hint set by the adapter that produced a search result — distinct
  // from ResolvedPlaybackSource['sourceLabel'], which only ever names the
  // resolver that actually served the *playable* stream.
  sourceLabel?: 'Legal' | 'Piped' | 'Proxy' | 'Downloaded' | 'JioSaavn' | 'Deezer';
  localUri?: string;
  sourceValidatedAt?: number;
  // True only for sources that can never serve a full track (e.g. Deezer's 30s
  // preview clips). Such tracks must NOT be treated as a playable legal source —
  // SourceResolver tries to find a full YouTube stream first and only falls back
  // to the preview as an absolute last resort.
  isPreviewOnly?: boolean;
  queueReason?: string; // e.g. "Because you like Radiohead" — shown in the queue UI
}

export interface Artist {
  id: string;
  name: string;
  imageUrl?: string;
  followers?: number;
  genres?: string[];
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  artworkUrl?: string;
  releaseYear?: number;
  tracks?: Track[];
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  artworkUrl?: string;
  creatorName?: string;
  tracks: Track[];
  createdAt?: number;
  sourceType?: 'local' | 'youtube' | 'spotify';
}
