import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Track } from '@/src/models/types';
import { usePlayerStore } from '@/src/store/playerStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getTheme } from '@/src/theme/musicTheme';

interface Props {
  track: Track;
  onPress?: () => void;
  onAddToQueue?: () => void;
  showArtwork?: boolean;
}

const SOURCE_LABELS: Record<Track['sourceType'], string> = {
  piped: 'Piped',
  jamendo: 'Jamendo',
  internet_archive: 'Archive',
};

export function TrackItem({ track, onPress, onAddToQueue, showArtwork = true }: Props) {
  const { queue, currentIndex, setQueue, isPlaying, setIsPlaying, addToQueue } = usePlayerStore();
  const { settings } = useSettingsStore();
  const theme = getTheme(settings);

  const isCurrentlyPlaying = queue[currentIndex]?.id === track.id;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (isCurrentlyPlaying) {
      setIsPlaying(!isPlaying);
    } else {
      setQueue([track]);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      style={[styles.container, settings.useDenseLists && styles.denseContainer]}
      onPress={handlePress}
    >
      {showArtwork && (
        <Image
          source={{ uri: track.artworkUrl || 'https://via.placeholder.com/150' }}
          style={[styles.artwork, settings.useDenseLists && styles.denseArtwork]}
        />
      )}
      <View style={[styles.textContainer, !showArtwork && styles.noArtworkText]}>
        <Text style={[styles.title, { color: isCurrentlyPlaying ? theme.accent : theme.text }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[styles.artist, { color: theme.secondaryText }]} numberOfLines={1}>
          {SOURCE_LABELS[track.sourceType]} - {track.artistName}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Add ${track.title} to queue`}
        style={styles.moreButton}
        onPress={() => {
          if (onAddToQueue) {
            onAddToQueue();
          } else {
            addToQueue(track);
          }
        }}
      >
        <Ionicons name="add-circle-outline" size={22} color={theme.secondaryText} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 7,
  },
  denseContainer: {
    minHeight: 54,
    paddingVertical: 5,
  },
  artwork: {
    backgroundColor: '#333',
    borderRadius: 6,
    height: 50,
    width: 50,
  },
  denseArtwork: {
    height: 42,
    width: 42,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 12,
  },
  noArtworkText: {
    marginLeft: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  artist: {
    fontSize: 12,
    marginTop: 4,
  },
  moreButton: {
    padding: 8,
  },
});
