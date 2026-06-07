import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SONIQ_LOGO = require('../../../assets/images/nemotron_logo.png');

interface Props {
  size: number;
  isPlaying: boolean;
  artworkUri?: string | null;
  borderRadius?: number;
}

export function AnimatedDiskArt({ size, artworkUri, borderRadius }: Props) {
  const r = borderRadius ?? size / 2;

  if (artworkUri) {
    return (
      <Image
        source={{ uri: artworkUri }}
        style={{ width: size, height: size, borderRadius: r, backgroundColor: '#1a1d23' }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: r }]}>
      <Image
        source={SONIQ_LOGO}
        style={{ width: size * 0.55, height: size * 0.55, borderRadius: size * 0.275 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    backgroundColor: '#111',
    justifyContent: 'center',
  },
});
