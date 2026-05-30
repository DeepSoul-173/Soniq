import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { UnifiedPlayer } from '@/src/components/player/UnifiedPlayer';
import { MiniPlayer } from '@/src/components/player/MiniPlayer';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useEffect } from 'react';

export default function RootLayout() {
  const { settings } = useSettingsStore();
  const pathname = usePathname();

  // Determine if we should show the MiniPlayer
  const isPlayerModalActive = pathname === '/playerModal';

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider style={styles.container}>
        <StatusBar style={settings.theme === 'light' ? 'dark' : 'light'} />
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="(drawer)" />
          <Stack.Screen name="playerModal" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        </Stack>
        <UnifiedPlayer />
        {!isPlayerModalActive && <MiniPlayer />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a', // Deeper premium background
  },
});
