import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/store/settingsStore';
import { usePlayerStore } from '@/src/store/playerStore';
import { useLibraryStore } from '@/src/store/libraryStore';
import { appStorage } from '@/src/store/mmkvStorage';
import { getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';

export default function DeveloperSettingsScreen() {
  const router = useRouter();
  const { settings, updateSetting, resetSettings } = useSettingsStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();

  const handleResetApp = async () => {
    Alert.alert('Reset App', 'Are you sure you want to clear all data and settings?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => {
        resetSettings();
        usePlayerStore.getState().clearQueue();
        useLibraryStore.getState().clearRecentlyPlayed();
        appStorage.clearAll();
        Alert.alert('Success', 'App data cleared');
      }}
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Developer Options</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}>
        <View style={[styles.settingItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, { color: theme.text }]}>Enable Debug Logs</Text>
            <Text style={[styles.settingDesc, { color: theme.secondaryText }]}>Outputs verbose logging to console.</Text>
          </View>
          <Switch 
            value={settings.debugLogs} 
            onValueChange={(val) => updateSetting('debugLogs', val)}
            trackColor={{ false: theme.muted, true: theme.accent }}
          />
        </View>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={handleResetApp}>
          <Text style={styles.actionButtonText}>Clear All App Data</Text>
        </TouchableOpacity>
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
  actionButton: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  actionButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
