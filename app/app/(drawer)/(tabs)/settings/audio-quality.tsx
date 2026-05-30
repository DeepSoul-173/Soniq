import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';

export default function AudioQualitySettingsScreen() {
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
        <Text style={[styles.title, { color: theme.text }]}>Audio Quality</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}>
        <View style={[styles.settingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Auto Adjust Quality</Text>
            <Text style={[styles.settingDesc, { color: theme.secondaryText }]}>Automatically adjust streaming quality based on your connection.</Text>
          </View>
          <Switch 
            value={settings.autoAdjustQuality} 
            onValueChange={(val) => updateSetting('autoAdjustQuality', val)}
            trackColor={{ false: theme.muted, true: theme.accent }}
          />
        </View>

        <View style={[styles.settingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>High Quality over Wi-Fi Only</Text>
            <Text style={[styles.settingDesc, { color: theme.secondaryText }]}>Restricts very high quality streaming to Wi-Fi connections.</Text>
          </View>
          <Switch 
            value={settings.highQualityOnlyOnWifi} 
            onValueChange={(val) => updateSetting('highQualityOnlyOnWifi', val)}
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
