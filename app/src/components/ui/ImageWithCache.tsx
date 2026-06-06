/**
 * ImageWithCache — drop-in replacement for react-native Image that uses
 * expo-image when available for aggressive disk caching and smoother scrolling.
 *
 * Install expo-image to activate the upgrade:
 *   npx expo install expo-image
 *
 * Until installed it falls back to react-native's built-in Image transparently.
 */
import React from 'react';
import { Image as RNImage, ImageStyle, StyleProp } from 'react-native';

type Props = {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  accessibilityLabel?: string;
};

// Try to load expo-image at runtime. Falls back gracefully if not installed.
let ExpoImage: React.ComponentType<{
  source: { uri: string };
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  accessibilityLabel?: string;
  cachePolicy?: 'disk' | 'memory' | 'memory-disk' | 'none';
}> | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ExpoImage = require('expo-image').Image;
} catch {
  // expo-image not installed — use RNImage fallback below
}

const PLACEHOLDER = 'https://via.placeholder.com/300';

export function ImageWithCache({ uri, style, resizeMode = 'cover', accessibilityLabel }: Props) {
  const src = uri || PLACEHOLDER;

  if (ExpoImage) {
    return (
      <ExpoImage
        source={{ uri: src }}
        style={style}
        contentFit={resizeMode === 'stretch' ? 'fill' : resizeMode === 'center' ? 'none' : resizeMode}
        accessibilityLabel={accessibilityLabel}
        cachePolicy="disk"
      />
    );
  }

  return (
    <RNImage
      source={{ uri: src }}
      style={style}
      resizeMode={resizeMode}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
