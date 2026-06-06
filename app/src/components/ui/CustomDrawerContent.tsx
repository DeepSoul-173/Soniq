import React from 'react';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useRouter } from 'expo-router';
import { getTheme } from '@/src/theme/musicTheme';

const DONATION_URL = 'https://buymeacoffee.com/abhijithpr173';

async function openDonation() {
  try {
    const canOpen = await Linking.canOpenURL(DONATION_URL);
    if (canOpen) {
      await Linking.openURL(DONATION_URL);
    } else {
      Alert.alert('Cannot open link', 'Please visit buymeacoffee.com/abhijithpr173 in your browser.');
    }
  } catch {
    Alert.alert('Cannot open link', 'Please visit buymeacoffee.com/abhijithpr173 in your browser.');
  }
}

export function CustomDrawerContent(props: any) {
  const { settings } = useSettingsStore();
  const router = useRouter();
  const theme = getTheme(settings);

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Profile */}
      <TouchableOpacity style={styles.profileSection} onPress={() => router.push('/profile' as any)}>
        <Image source={{ uri: settings.profileImageUri }} style={styles.avatar} />
        <View>
          <Text style={[styles.name, { color: theme.text }]}>{settings.displayName}</Text>
          <Text style={[styles.handle, { color: theme.secondaryText }]}>Profile and appearance</Text>
        </View>
      </TouchableOpacity>

      {/* Menu items — flex: 1 ensures these push the donate section down */}
      <View style={styles.menuItems}>
        <DrawerItem
          label="Home"
          labelStyle={{ color: theme.text, fontSize: 16 }}
          icon={({ size }) => <Ionicons name="home-outline" size={size} color={theme.text} />}
          onPress={() => props.navigation.navigate('(tabs)')}
        />
        <DrawerItem
          label="Your Library"
          labelStyle={{ color: theme.text, fontSize: 16 }}
          icon={({ size }) => <Ionicons name="library-outline" size={size} color={theme.text} />}
          onPress={() => router.push('/(drawer)/(tabs)/library')}
        />
        <DrawerItem
          label="Profile"
          labelStyle={{ color: theme.text, fontSize: 16 }}
          icon={({ size }) => <Ionicons name="person-circle-outline" size={size} color={theme.text} />}
          onPress={() => router.push('/profile' as any)}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <DrawerItem
          label="Settings"
          labelStyle={{ color: theme.text, fontSize: 16 }}
          icon={({ size }) => <Ionicons name="settings-outline" size={size} color={theme.text} />}
          onPress={() => router.push('/(drawer)/(tabs)/settings')}
        />
      </View>

      {/* Donate — always visible at the bottom */}
      <View style={[styles.donateSection, { borderTopColor: theme.border }]}>
        <Text style={[styles.donateBy, { color: theme.secondaryText }]}>Made with ♥ by Abhijith</Text>
        <TouchableOpacity
          style={[styles.donateButton, { backgroundColor: theme.accent }]}
          activeOpacity={0.82}
          onPress={openDonation}
        >
          <Ionicons name="cafe-outline" size={18} color="#08090B" />
          <Text style={styles.donateText}>Buy me a coffee</Text>
        </TouchableOpacity>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  profileSection: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  avatar: {
    borderRadius: 30,
    height: 58,
    marginRight: 16,
    width: 58,
  },
  name: { fontSize: 17, fontWeight: '800' },
  handle: { fontSize: 13, marginTop: 2 },
  menuItems: { paddingHorizontal: 10 },
  divider: { height: 1, marginHorizontal: 15, marginVertical: 14 },
  donateSection: {
    borderTopWidth: 1,
    marginTop: 32,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  donateBy: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  donateButton: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  donateText: {
    color: '#08090B',
    fontSize: 14,
    fontWeight: '900',
  },
});
