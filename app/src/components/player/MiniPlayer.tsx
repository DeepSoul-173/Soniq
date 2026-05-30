import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '@/src/store/playerStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { MINI_PLAYER_HEIGHT, getMiniPlayerBottomOffset, getTheme } from '@/src/theme/musicTheme';

export function MiniPlayer() {
  const {
    queue,
    currentIndex,
    isPlaying,
    playbackPosition,
    duration,
    setIsPlaying,
    nextTrack,
  } = usePlayerStore();
  const { settings } = useSettingsStore();
  const theme = getTheme(settings);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const currentTrack = queue[currentIndex];
  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(100, Math.max(0, (playbackPosition / duration) * 100)) : 0;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          bottom: getMiniPlayerBottomOffset(insets.bottom),
        },
      ]}
      activeOpacity={0.92}
      onPress={() => router.push('/playerModal')}
    >
      <View style={styles.content}>
        <Image source={{ uri: currentTrack.artworkUrl || 'https://via.placeholder.com/150' }} style={styles.artwork} />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={[styles.artist, { color: theme.secondaryText }]} numberOfLines={1}>
            {currentTrack.artistName}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          style={styles.controlBtn}
          onPress={() => setIsPlaying(!isPlaying)}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next track" style={styles.controlBtn} onPress={nextTrack}>
          <Ionicons name="play-skip-forward" size={23} color={theme.text} />
        </TouchableOpacity>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.muted }]}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.accent }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 14,
    height: MINI_PLAYER_HEIGHT,
    left: 10,
    overflow: 'hidden',
    position: 'absolute',
    right: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 8,
    paddingRight: 10,
    paddingVertical: 8,
  },
  artwork: {
    backgroundColor: '#333',
    borderRadius: 6,
    height: 48,
    width: 48,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
  },
  artist: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  controlBtn: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    marginLeft: 2,
    width: 42,
  },
  progressTrack: {
    bottom: 0,
    height: 3,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  progressFill: {
    height: 3,
  },
});
