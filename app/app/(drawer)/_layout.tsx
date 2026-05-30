import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/store/settingsStore';
import { CustomDrawerContent } from '@/src/components/ui/CustomDrawerContent';
import { getTheme } from '@/src/theme/musicTheme';

export default function DrawerLayout() {
  const { settings } = useSettingsStore();
  const theme = getTheme(settings);

  return (
    <Drawer 
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{ 
        headerShown: false,
        drawerStyle: {
          backgroundColor: theme.background,
          width: 280,
        },
        drawerActiveTintColor: theme.accent,
        drawerInactiveTintColor: theme.secondaryText,
      }}
    >
      <Drawer.Screen 
        name="(tabs)" 
        options={{
          drawerLabel: 'Home',
          drawerIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
        }} 
      />
      <Drawer.Screen
        name="profile"
        options={{
          drawerLabel: 'Profile',
          drawerIcon: ({ color }) => <Ionicons name="person-circle-outline" size={22} color={color} />,
        }}
      />
    </Drawer>
  );
}
