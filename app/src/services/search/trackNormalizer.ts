import { PlaybackSourceType, Track } from '@/src/models/types';

type NormalizeInput = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  duration?: number;
  streamUrl?: string;
  sourceType: PlaybackSourceType;
  lyricsAvailable?: boolean;
  downloadAvailable?: boolean;
  genres?: string[];
  moodTags?: string[];
  artistId?: string;
  albumId?: string;
  pipedVideoId?: string;
  sourceLabel?: Track['sourceLabel'];
  localUri?: string;
  sourceValidatedAt?: number;
};

export function normalizeTrack(input: NormalizeInput): Track {
  const genres = input.genres || [];
  const moodTags = input.moodTags || [];
  const artwork = input.artwork;
  const album = input.album;

  return {
    id: input.id,
    title: input.title || 'Unknown Title',
    artist: input.artist || 'Unknown Artist',
    album,
    artwork,
    duration: input.duration || 0,
    streamUrl: input.streamUrl,
    sourceType: input.sourceType,
    lyricsAvailable: Boolean(input.lyricsAvailable),
    downloadAvailable: Boolean(input.downloadAvailable),
    genres,
    moodTags,
    artistId: input.artistId || `${input.sourceType}_${input.artist || 'unknown_artist'}`,
    artistName: input.artist || 'Unknown Artist',
    albumId: input.albumId,
    albumName: album,
    artworkUrl: artwork,
    pipedVideoId: input.pipedVideoId,
    tags: [...genres, ...moodTags],
    genre: genres[0],
    sourceLabel: input.sourceLabel,
    localUri: input.localUri,
    sourceValidatedAt: input.sourceValidatedAt,
  };
}

export function normalizeTracks(tracks: Track[]) {
  return tracks.map((track) =>
    normalizeTrack({
      ...track,
      artist: track.artist || track.artistName,
      album: track.album || track.albumName,
      artwork: track.artwork || track.artworkUrl,
      genres: track.genres || (track.genre ? [track.genre] : []),
      moodTags: track.moodTags || track.tags || [],
    })
  );
}
