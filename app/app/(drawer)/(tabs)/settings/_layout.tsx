import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="playback" />
      <Stack.Screen name="audio-quality" />
      <Stack.Screen name="others" />
      <Stack.Screen name="backup" />
      <Stack.Screen name="developer" />
      <Stack.Screen name="app-icon" />
    </Stack>
  );
}
