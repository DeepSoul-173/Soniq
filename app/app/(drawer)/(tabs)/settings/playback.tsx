import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';

export default function PlaybackSettingsScreen() {
  const router = useRouter();
  const { settings, updateSetting } = useSettingsStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Playback</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}>
        <View style={[styles.settingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Play in Background</Text>
            <Text style={[styles.settingDesc, { color: theme.secondaryText }]}>Keep audio playing when the app is minimized or the screen is off.</Text>
          </View>
          <Switch
            value={settings.playInBackground}
            onValueChange={(val) => updateSetting('playInBackground', val)}
            trackColor={{ false: theme.muted, true: theme.accent }}
          />
        </View>

        <View style={[styles.settingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Autoplay</Text>
            <Text style={[styles.settingDesc, { color: theme.secondaryText }]}>Keep listening to similar tracks when your music ends.</Text>
          </View>
          <Switch 
            value={settings.autoplay} 
            onValueChange={(val) => updateSetting('autoplay', val)}
            trackColor={{ false: theme.muted, true: theme.accent }}
          />
        </View>

        <View style={[styles.settingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Gapless Playback</Text>
            <Text style={[styles.settingDesc, { color: theme.secondaryText }]}>Allows gapless playback if supported by engine.</Text>
          </View>
          <Switch 
            value={settings.gaplessPlayback} 
            onValueChange={(val) => updateSetting('gaplessPlayback', val)}
            trackColor={{ false: theme.muted, true: theme.accent }}
          />
        </View>

        <View style={[styles.settingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Normalize Volume</Text>
            <Text style={[styles.settingDesc, { color: theme.secondaryText }]}>Set the same volume level for all tracks.</Text>
          </View>
          <Switch 
            value={settings.normalizeVolume} 
            onValueChange={(val) => updateSetting('normalizeVolume', val)}
            trackColor={{ false: theme.muted, true: theme.accent }}
          />
        </View>

        <View style={[styles.settingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Allow Explicit Content</Text>
            <Text style={[styles.settingDesc, { color: theme.secondaryText }]}>Turn on to play explicit content.</Text>
          </View>
          <Switch 
            value={settings.allowExplicitContent} 
            onValueChange={(val) => updateSetting('allowExplicitContent', val)}
            trackColor={{ false: theme.muted, true: theme.accent }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: { marginRight: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  content: { padding: 16 },
  settingItem: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 14,
  },
  settingTextContainer: { flex: 1, paddingRight: 16 },
  settingTitle: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  settingDesc: { fontSize: 13 },
});
