import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarHeight, getTheme } from '@/src/theme/musicTheme';

export default function TabLayout() {
  const { settings } = useSettingsStore();
  const insets = useSafeAreaInsets();
  const theme = getTheme(settings);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Transparent scene area so a custom app background can show behind screens.
        // Screens still paint their own solid colour when no wallpaper is set.
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.overlay,
          borderTopWidth: 0,
          elevation: 12,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          height: getTabBarHeight(insets.bottom),
          position: 'absolute',
          borderTopColor: 'transparent',
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.faintText,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarBackground: () => (
          <View style={{ backgroundColor: theme.overlay, flex: 1 }} />
        )
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-sharp" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Ionicons name="search-sharp" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <Ionicons name="library-sharp" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-sharp" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
