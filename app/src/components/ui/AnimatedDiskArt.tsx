import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// The Soniq logo — shown as the vinyl "label" when no artwork is available.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SONIQ_LOGO = require('../../../assets/images/icon.png');

interface Props {
  size: number;
  isPlaying: boolean;
  /** Pass the artwork URI if the track has one; omit/null to show vinyl disk. */
  artworkUri?: string | null;
  borderRadius?: number;
}

/**
 * Shows artwork as a rotating disk when playing.
 * Falls back to an animated vinyl-record graphic (with the Soniq logo as
 * the label) when the track has no artwork.
 */
export function AnimatedDiskArt({ size, isPlaying, artworkUri, borderRadius }: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 5000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(rotation);
      // Hold the current angle — smooth pause, no snap.
    }
  }, [isPlaying, rotation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const r = borderRadius ?? size / 2;

  // ── Artwork disk ──────────────────────────────────────────────────────────
  if (artworkUri) {
    return (
      <Animated.Image
        source={{ uri: artworkUri }}
        style={[
          { width: size, height: size, borderRadius: r, backgroundColor: '#1a1d23' },
          animStyle,
        ]}
      />
    );
  }

  // ── Vinyl disk (no artwork) ───────────────────────────────────────────────
  const labelSize   = size * 0.40;
  const grooveRings = [0.92, 0.78, 0.64, 0.52]; // relative diameters

  return (
    <Animated.View
      style={[styles.vinyl, { width: size, height: size, borderRadius: size / 2 }, animStyle]}
    >
      {/* Vinyl groove rings */}
      {grooveRings.map((ratio, i) => (
        <View
          key={i}
          style={[
            styles.groove,
            {
              width:        size * ratio,
              height:       size * ratio,
              borderRadius: (size * ratio) / 2,
            },
          ]}
        />
      ))}

      {/* Centre label — Soniq logo */}
      <View
        style={[
          styles.label,
          { width: labelSize, height: labelSize, borderRadius: labelSize / 2 },
        ]}
      >
        <Animated.Image
          source={SONIQ_LOGO}
          style={{ width: labelSize * 0.85, height: labelSize * 0.85, borderRadius: labelSize * 0.425 }}
          resizeMode="cover"
        />
      </View>

      {/* Spindle hole */}
      <View
        style={[
          styles.hole,
          {
            width:        size * 0.06,
            height:       size * 0.06,
            borderRadius: size * 0.03,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  vinyl: {
    alignItems:      'center',
    backgroundColor: '#0d0d0d',
    elevation:       8,
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.45,
    shadowRadius:    12,
  },
  groove: {
    borderColor:   'rgba(255,255,255,0.06)',
    borderWidth:   1,
    position:      'absolute',
  },
  label: {
    alignItems:      'center',
    backgroundColor: '#1a1d23',
    justifyContent:  'center',
    overflow:        'hidden',
    position:        'absolute',
  },
  hole: {
    backgroundColor: '#2a2a2a',
    position:        'absolute',
  },
});
