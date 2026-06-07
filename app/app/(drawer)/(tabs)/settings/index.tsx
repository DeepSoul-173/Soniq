import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/src/store/settingsStore';
import { FONTS, getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';
import { screenBackground } from '@/src/theme/backgrounds';

const safeJoin = (value: unknown, separator = ', ') =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim().length > 0).join(separator)
    : '';

interface SettingRowProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { settings } = useSettingsStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();

  const rows: SettingRowProps[] = [
    {
      title: 'Profile and appearance',
      description: 'Name, avatar, accent color, theme, and preferences.',
      icon: 'person-circle-outline',
      onPress: () => router.push('/profile' as any),
    },
    {
      title: 'Music & Playback',
      description: 'Language, region, session, autoplay, and caching.',
      icon: 'play-circle-outline',
      onPress: () => router.push('/settings/playback' as any),
    },
    {
      title: 'Audio Quality',
      description: 'Download quality and data-saving options.',
      icon: 'musical-note-outline',
      onPress: () => router.push('/settings/audio-quality' as any),
    },
    {
      title: 'Others',
      description: 'Local files, search, and proxy.',
      icon: 'options-outline',
      onPress: () => router.push('/settings/others' as any),
    },
    {
      title: 'Backup & Restore',
      description: 'Save and restore your settings snapshot locally.',
      icon: 'cloud-outline',
      onPress: () => router.push('/settings/backup' as any),
    },
    {
      title: 'App Icon',
      description: 'Personalise the icon on your home screen. Earn Gold after 100 plays.',
      icon: 'apps-outline',
      onPress: () => router.push('/settings/app-icon' as any),
    },
    {
      title: 'Developer options',
      description: 'Debug logs and local data reset tools.',
      icon: 'code-slash-outline',
      onPress: () => router.push('/settings/developer' as any),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: screenBackground(settings, theme.background) }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Clean controls for a focused music app.</Text>
        </View>

        <TouchableOpacity
          style={[styles.profilePanel, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push('/profile' as any)}
        >
          <Image source={{ uri: settings.profileImageUri }} style={styles.avatar} />
          <View style={styles.profileCopy}>
            <Text style={[styles.profileName, { color: theme.text }]}>{settings.displayName}</Text>
            <Text style={[styles.profileMeta, { color: theme.secondaryText }]} numberOfLines={1}>
              {safeJoin(settings?.preferredListeningMoods) || 'Personalized listening'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
        </TouchableOpacity>

        <View style={styles.rows}>
          {rows.map((row) => (
            <TouchableOpacity
              key={row.title}
              style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={row.onPress}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.elevated }]}>
                <Ionicons name={row.icon} size={22} color={theme.accent} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{row.title}</Text>
                <Text style={[styles.rowDesc, { color: theme.secondaryText }]} numberOfLines={2}>
                  {row.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.secondaryText} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.versionText, { color: theme.faintText }]}>Soniq v1.0.0 - Expo SDK 54</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    paddingBottom: 18,
    paddingTop: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    fontFamily: FONTS.serif,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  profilePanel: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 14,
    padding: 12,
  },
  avatar: {
    borderRadius: 28,
    height: 56,
    width: 56,
  },
  profileCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '900',
  },
  profileMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  rows: {
    marginTop: 2,
  },
  row: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 12,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  rowCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  rowDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 24,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
