export type PlaybackSourceType = 'piped' | 'jamendo' | 'internet_archive';

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  artworkUrl?: string;
  duration: number; // in seconds
  sourceType: PlaybackSourceType;
  streamUrl?: string; // Used for direct native playback sources
  pipedVideoId?: string; // Used to resolve Piped streams just before playback
  tags?: string[];
  genre?: string;
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
}
