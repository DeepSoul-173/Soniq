import React from 'react';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useRouter } from 'expo-router';
import { getTheme } from '@/src/theme/musicTheme';

export function CustomDrawerContent(props: any) {
  const { settings } = useSettingsStore();
  const router = useRouter();
  const theme = getTheme(settings);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.profileSection} onPress={() => router.push('/profile' as any)}>
        <Image 
          source={{ uri: settings.profileImageUri }}
          style={styles.avatar} 
        />
        <View>
          <Text style={[styles.name, { color: theme.text }]}>{settings.displayName}</Text>
          <Text style={[styles.handle, { color: theme.secondaryText }]}>Profile and appearance</Text>
        </View>
      </TouchableOpacity>

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
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  handle: {
    fontSize: 14,
    marginTop: 2,
  },
  menuItems: {
    paddingHorizontal: 10,
  },
  divider: {
    height: 1,
    marginVertical: 15,
    marginHorizontal: 15,
  }
});
