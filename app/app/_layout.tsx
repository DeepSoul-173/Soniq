import React, { Component, useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { UnifiedPlayer } from '@/src/components/player/UnifiedPlayer';
import { MiniPlayer } from '@/src/components/player/MiniPlayer';
import { FloatingPipPlayer } from '@/src/components/player/FloatingPipPlayer';
import { useSettingsStore } from '@/src/store/settingsStore';
import { AppIconService } from '@/src/services/AppIconService';

// ── Global Error Boundary ─────────────────────────────────────────────────────
// Catches fatal JS errors anywhere in the tree and renders a readable screen
// instead of silently force-closing the app.
interface EBState {
  error: Error | null;
}

class RootErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RootErrorBoundary] Unhandled error:', error.message);
    console.error(info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        // Use React Native's built-in SafeAreaView — no context dependency here.
        <SafeAreaView style={eb.root}>
          <ScrollView contentContainerStyle={eb.scroll}>
            <Text style={eb.heading}>Something went wrong</Text>
            <Text style={eb.message}>{error.message}</Text>
            {__DEV__ && (
              <Text style={eb.stack}>{error.stack}</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#08090B' },
  scroll:  { padding: 24, paddingTop: 40 },
  heading: { color: '#FF4444', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  message: { color: '#E0E0E0', fontSize: 13, fontFamily: 'monospace', lineHeight: 20 },
  stack:   { color: '#666', fontSize: 10, marginTop: 16, lineHeight: 16 },
});

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  const { settings } = useSettingsStore();
  const pathname = usePathname();

  const isPlayerModalActive = pathname === '/playerModal';

  // Recover streak milestone on every cold launch (no-op if already earned).
  useEffect(() => {
    AppIconService.checkStreakMilestone().catch(() => undefined);
  }, []);

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaProvider style={styles.container}>
          <StatusBar style={settings.theme === 'light' ? 'dark' : 'light'} />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="(drawer)" />
            <Stack.Screen
              name="playerModal"
              options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
            />
          </Stack>
          <UnifiedPlayer />
          {/* MiniPlayer: absolute overlay on top of everything including the drawer */}
          {!isPlayerModalActive && (
            <View style={styles.miniPlayerLayer} pointerEvents="box-none">
              <MiniPlayer />
            </View>
          )}
          {/* Floating PiP: draggable overlay when user minimises the full player */}
          {!isPlayerModalActive && (
            <View style={styles.pipLayer} pointerEvents="box-none">
              <FloatingPipPlayer />
            </View>
          )}
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  // Rendered after Stack so it sits above the drawer on both platforms.
  miniPlayerLayer: {
    bottom: 0,
    elevation: 999,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 999,
  },
  pipLayer: {
    bottom: 0,
    elevation: 1000,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
});
