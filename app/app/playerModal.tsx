import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackItem } from '@/src/components/ui/TrackItem';
import { useLibraryStore } from '@/src/store/libraryStore';
import { usePlayerStore } from '@/src/store/playerStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getTheme } from '@/src/theme/musicTheme';

export default function PlayerModal() {
  const {
    queue,
    currentIndex,
    isPlaying,
    playbackPosition,
    duration,
    isBuffering,
    setIsPlaying,
    nextTrack,
    previousTrack,
    playTrack,
    requestSeek,
    removeFromQueue,
  } = usePlayerStore();
  const { isLiked, toggleLikeTrack } = useLibraryStore();
  const { settings, updateSetting } = useSettingsStore();
  const theme = getTheme(settings);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const currentTrack = queue[currentIndex];
  const [isSliding, setIsSliding] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);

  useEffect(() => {
    if (!isSliding) setSliderValue(playbackPosition);
  }, [playbackPosition, isSliding]);

  const artworkSize = useMemo(() => {
    const availableHeight = height - insets.top - insets.bottom - 360;
    return Math.max(220, Math.min(width - 56, availableHeight > 0 ? availableHeight : width - 56, 420));
  }, [height, insets.bottom, insets.top, width]);

  if (!currentTrack) {
    return (
      <SafeAreaView style={[styles.emptyScreen, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyText, { color: theme.text }]}>No track playing</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.closeButton, { backgroundColor: theme.accent }]}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const effectiveDuration = duration || currentTrack.duration || 0;
  const liked = isLiked(currentTrack.id);

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSlidingComplete = (value: number) => {
    requestSeek(value);
    setIsSliding(false);
  };

  const cycleRepeatMode = () => {
    const nextMode = settings.defaultRepeatMode === 'off' ? 'queue' : settings.defaultRepeatMode === 'queue' ? 'track' : 'off';
    updateSetting('defaultRepeatMode', nextMode);
  };

  const upcoming = queue.slice(currentIndex + 1);

  return (
    <LinearGradient colors={theme.gradient} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={[styles.playerPane, { minHeight: height }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <Ionicons name="chevron-down" size={30} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={[styles.headerEyebrow, { color: theme.secondaryText }]}>Now Playing</Text>
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
                Soniq queue
              </Text>
            </View>
            <View style={styles.iconButton} />
          </View>

          <View style={styles.artworkContainer}>
            <Image
              source={{ uri: currentTrack.artworkUrl || 'https://via.placeholder.com/500' }}
              style={[styles.artwork, { height: artworkSize, width: artworkSize }]}
            />
          </View>

          <View style={styles.infoContainer}>
            <View style={styles.titleRow}>
              <View style={styles.titleInfo}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                  {currentTrack.title}
                </Text>
                <Text style={[styles.artist, { color: theme.secondaryText }]} numberOfLines={1}>
                  {currentTrack.artistName}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={liked ? 'Unlike track' : 'Like track'}
                style={styles.likeButton}
                onPress={() => toggleLikeTrack(currentTrack)}
              >
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={29} color={liked ? theme.accent : theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.progressContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={Math.max(effectiveDuration, 1)}
                value={Math.min(sliderValue, Math.max(effectiveDuration, 1))}
                minimumTrackTintColor={theme.accent}
                maximumTrackTintColor={theme.muted}
                thumbTintColor={theme.accent}
                onSlidingStart={() => setIsSliding(true)}
                onValueChange={setSliderValue}
                onSlidingComplete={handleSlidingComplete}
              />
              <View style={styles.timeRow}>
                <Text style={[styles.timeText, { color: theme.secondaryText }]}>{formatTime(sliderValue)}</Text>
                <Text style={[styles.timeText, { color: theme.secondaryText }]}>
                  -{formatTime(Math.max(0, effectiveDuration - sliderValue))}
                </Text>
              </View>
            </View>

            <View style={styles.controlsContainer}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Toggle shuffle"
                style={styles.smallControl}
                onPress={() => updateSetting('defaultShuffle', !settings.defaultShuffle)}
              >
                <Ionicons name="shuffle" size={25} color={settings.defaultShuffle ? theme.accent : theme.secondaryText} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.largeControl} onPress={previousTrack}>
                <Ionicons name="play-skip-back" size={37} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: theme.text }]}
                onPress={() => setIsPlaying(!isPlaying)}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={34} color={theme.background} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.largeControl} onPress={nextTrack}>
                <Ionicons name="play-skip-forward" size={37} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Change repeat mode"
                style={styles.smallControl}
                onPress={cycleRepeatMode}
              >
                <Ionicons
                  name={settings.defaultRepeatMode === 'track' ? 'repeat-outline' : 'repeat'}
                  size={25}
                  color={settings.defaultRepeatMode !== 'off' ? theme.accent : theme.secondaryText}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.statusRow}>
              <View style={[styles.sourcePill, { backgroundColor: theme.elevated }]}>
                <Ionicons name={isBuffering ? 'cloud-download-outline' : 'checkmark-circle-outline'} size={16} color={theme.accent} />
                <Text style={[styles.sourceText, { color: theme.secondaryText }]}>
                  {isBuffering ? 'Buffering' : currentTrack.sourceType.replace('_', ' ')}
                </Text>
              </View>
              <View style={[styles.queuePill, { backgroundColor: theme.elevated }]}>
                <Ionicons name="list" size={18} color={theme.accent} />
                <Text style={[styles.sourceText, { color: theme.secondaryText }]}>{queue.length} in queue</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>

        <View style={[styles.queueSection, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <View style={styles.queueHeader}>
            <View>
              <Text style={[styles.queueTitle, { color: theme.text }]}>Up Next</Text>
              <Text style={[styles.queueSubtitle, { color: theme.secondaryText }]}>
                Tap a track to jump without rebuilding the queue.
              </Text>
            </View>
          </View>

          {upcoming.length > 0 ? (
            upcoming.map((track, index) => {
              const absoluteIndex = currentIndex + 1 + index;
              return (
                <View key={`${track.id}-${absoluteIndex}`} style={styles.queueRow}>
                  <View style={styles.queueTrack}>
                    <TrackItem track={track} onPress={() => playTrack(absoluteIndex)} />
                  </View>
                  <TouchableOpacity style={styles.removeButton} onPress={() => removeFromQueue(absoluteIndex)}>
                    <Ionicons name="close" size={20} color={theme.secondaryText} />
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={[styles.emptyQueue, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="sparkles-outline" size={26} color={theme.accent} />
              <Text style={[styles.emptyQueueTitle, { color: theme.text }]}>Queue is clear</Text>
              <Text style={[styles.emptyQueueText, { color: theme.secondaryText }]}>
                Autoplay recommendations can extend this queue when enabled.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  playerPane: {
    justifyContent: 'space-between',
    paddingBottom: 26,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  iconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  artworkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 18,
  },
  artwork: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
  },
  infoContainer: {
    paddingHorizontal: 28,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 18,
  },
  titleInfo: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
  },
  artist: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 5,
  },
  likeButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  progressContainer: {
    marginBottom: 18,
  },
  slider: {
    height: 36,
    width: '100%',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  controlsContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  smallControl: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  largeControl: {
    alignItems: 'center',
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  playButton: {
    alignItems: 'center',
    borderRadius: 34,
    elevation: 6,
    height: 68,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    width: 68,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sourcePill: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  queuePill: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  queueSection: {
    borderTopWidth: 1,
    minHeight: 360,
    paddingBottom: 42,
    paddingTop: 26,
  },
  queueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  queueTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  queueSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  queueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingRight: 12,
  },
  queueTrack: {
    flex: 1,
  },
  removeButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  emptyQueue: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 24,
    marginTop: 12,
    padding: 22,
  },
  emptyQueueTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyQueueText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    borderRadius: 8,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#08090B',
    fontSize: 15,
    fontWeight: '900',
  },
});
