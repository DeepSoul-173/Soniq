import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getTheme } from '@/src/theme/musicTheme';

// A fine tileable noise texture. Repeated across the whole app at very low opacity
// it adds subtle film grain — the single biggest thing that stops flat dark UIs
// from looking like a cheap AI gradient. Touch-transparent, so it never affects
// interaction.
const GRAIN = require('../../../assets/images/grain.png');

export function GrainOverlay() {
  const { settings } = useSettingsStore();
  const theme = getTheme(settings);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={GRAIN}
        resizeMode="repeat"
        style={[
          StyleSheet.absoluteFill,
          {
            // Black grain reads better on light skins; white on dark.
            tintColor: theme.isLight ? '#000000' : '#FFFFFF',
            opacity: theme.isLight ? 0.035 : 0.05,
          },
        ]}
      />
    </View>
  );
}
