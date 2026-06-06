import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '@/src/store/playerStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getTheme } from '@/src/theme/musicTheme';
import { AnimatedDiskArt } from '@/src/components/ui/AnimatedDiskArt';

const PIP_W = 290;
const PIP_H = 70;

export function FloatingPipPlayer() {
  const { queue, currentIndex, isPlaying, isPipMode, setIsPlaying, setPipMode, nextTrack } =
    usePlayerStore();
  const { settings } = useSettingsStore();
  const theme = getTheme(settings);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentTrack = queue[currentIndex];

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const cx = useSharedValue(0);
  const cy = useSharedValue(0);

  const openFull = useCallback(() => {
    setPipMode(false);
    router.push('/playerModal');
  }, [router, setPipMode]);

  const dragGesture = Gesture.Pan()
    .onStart(() => {
      cx.value = tx.value;
      cy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = cx.value + e.translationX;
      ty.value = cy.value + e.translationY;
    })
    .onEnd(() => {
      tx.value = withSpring(tx.value, { damping: 18, stiffness: 200 });
      ty.value = withSpring(ty.value, { damping: 18, stiffness: 200 });
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(openFull)();
  });

  const composed = Gesture.Simultaneous(dragGesture, tapGesture);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  if (!isPipMode || !currentTrack) return null;

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          styles.pip,
          {
            backgroundColor: theme.surface,
            borderColor: theme.accent + '44',
            bottom: insets.bottom + 16,
            right: 12,
          },
          animStyle,
        ]}
      >
        {/* Progress shimmer bar at top */}
        <View style={[styles.progressBar, { backgroundColor: theme.accent }]} />

        <View style={styles.row}>
          <AnimatedDiskArt
            size={50}
            isPlaying={isPlaying}
            artworkUri={currentTrack.artwork || currentTrack.artworkUrl || null}
            borderRadius={8}
          />
          <View style={styles.info}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={[styles.artist, { color: theme.secondaryText }]} numberOfLines={1}>
              {currentTrack.artist || currentTrack.artistName}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.ctrlBtn}
            onPress={() => setIsPlaying(!isPlaying)}
            hitSlop={8}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={theme.accent}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctrlBtn}
            onPress={() => nextTrack()}
            hitSlop={8}
          >
            <Ionicons name="play-skip-forward" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctrlBtn}
            onPress={() => setPipMode(false)}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={theme.secondaryText} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pip: {
    borderRadius: 14,
    borderWidth: 1,
    elevation: 24,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    width: PIP_W,
    zIndex: 9999,
  },
  progressBar: {
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    height: PIP_H,
    paddingHorizontal: 10,
    paddingTop: 2,
  },
  info: { flex: 1, marginHorizontal: 10 },
  title: { fontSize: 13, fontWeight: '800' },
  artist: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  ctrlBtn: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 34,
  },
});
