import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { usePlayerStore } from '@/src/store/playerStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { MINI_PLAYER_HEIGHT, getMiniPlayerBottomOffset, getTheme } from '@/src/theme/musicTheme';
import { AnimatedDiskArt } from '@/src/components/ui/AnimatedDiskArt';

const SWIPE_THRESHOLD = 60;

export function MiniPlayer() {
  const {
    queue,
    currentIndex,
    isPlaying,
    isBuffering,
    playbackPosition,
    duration,
    playbackResolverState,
    setIsPlaying,
    nextTrack,
    previousTrack,
  } = usePlayerStore();
  const { settings } = useSettingsStore();
  const theme = getTheme(settings);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const currentTrack = queue[currentIndex];
  const translateX = useSharedValue(0);

  const handleNext = useCallback(() => nextTrack(), [nextTrack]);
  const handlePrev = useCallback(() => previousTrack(), [previousTrack]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      // Dampen the drag so it feels resistance-y
      translateX.value = e.translationX * 0.35;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        runOnJS(handleNext)();
      } else if (e.translationX > SWIPE_THRESHOLD) {
        runOnJS(handlePrev)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(100, Math.max(0, (playbackPosition / duration) * 100)) : 0;

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            bottom: getMiniPlayerBottomOffset(insets.bottom),
          },
          animStyle,
        ]}
      >
        <TouchableOpacity
          style={styles.tapArea}
          activeOpacity={0.92}
          onPress={() => router.push('/playerModal')}
        >
          <View style={styles.content}>
            <AnimatedDiskArt
              size={48}
              isPlaying={isPlaying}
              artworkUri={currentTrack.artwork || currentTrack.artworkUrl || null}
              borderRadius={6}
            />
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {currentTrack.title}
              </Text>
              <Text style={[styles.artist, { color: theme.secondaryText }]} numberOfLines={1}>
                {playbackResolverState === 'retrying'
                  ? 'Retrying alternate source'
                  : currentTrack.artist || currentTrack.artistName}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              style={styles.controlBtn}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              <Ionicons
                name={isBuffering ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Next track"
              style={styles.controlBtn}
              onPress={handleNext}
            >
              <Ionicons name="play-skip-forward" size={23} color={theme.text} />
            </TouchableOpacity>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.muted }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.accent }]} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
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
  tapArea: { flex: 1 },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 8,
    paddingRight: 10,
    paddingVertical: 8,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 12,
  },
  title: { fontSize: 14, fontWeight: '900' },
  artist: { fontSize: 12, fontWeight: '600', marginTop: 2 },
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
  progressFill: { height: 3 },
});
