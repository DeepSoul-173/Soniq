import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getTheme } from '@/src/theme/musicTheme';
import { gradientColorsFor, livePresetFor } from '@/src/theme/backgrounds';

// App-wide custom backdrop (WhatsApp-wallpaper style). Rendered behind all screen
// content; screens go transparent (see screenBackground) so this shows through.
// Always touch-transparent.

function GradientBackground({ colors }: { colors: readonly [string, string, string] }) {
  return <LinearGradient colors={colors} style={StyleSheet.absoluteFill} pointerEvents="none" />;
}

function LiveBackground({
  from,
  to,
}: {
  from: readonly [string, string, string];
  to: readonly [string, string, string];
}) {
  // Slow cross-fade between two palettes — a calm, premium "breathing" backdrop.
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [t]);
  const topStyle = useAnimatedStyle(() => ({ opacity: t.value }));

  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={from} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, topStyle]}>
        <LinearGradient colors={to} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
}

function ImageBackground({ uri, isLight }: { uri: string; isLight: boolean }) {
  // A scrim keeps text readable over any photo — light wash on light skins, dark on dark.
  const scrim: readonly [string, string, string] = isLight
    ? ['rgba(244,241,234,0.45)', 'rgba(244,241,234,0.62)', 'rgba(244,241,234,0.78)']
    : ['rgba(8,8,10,0.55)', 'rgba(8,8,10,0.68)', 'rgba(8,8,10,0.82)'];
  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={{ uri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={scrim} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

export function AppBackground() {
  const { settings } = useSettingsStore();
  const theme = getTheme(settings);
  const type = settings.backgroundType ?? 'theme';

  if (type === 'gradient') return <GradientBackground colors={gradientColorsFor(settings.backgroundValue)} />;
  if (type === 'live') {
    const preset = livePresetFor(settings.backgroundValue);
    return <LiveBackground from={preset.from} to={preset.to} />;
  }
  if (type === 'image' && settings.backgroundValue) {
    return <ImageBackground uri={settings.backgroundValue} isLight={theme.isLight} />;
  }
  return null; // 'theme' — screens keep their own solid skin backdrop
}
