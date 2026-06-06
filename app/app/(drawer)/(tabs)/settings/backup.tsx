import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/src/store/settingsStore';
import { SettingsService } from '@/src/services/settings/SettingsService';
import { getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';

function SectionHeader({ title, theme }: { title: string; theme: ReturnType<typeof getTheme> }) {
  return (
    <Text style={[rowStyles.sectionHeader, { color: theme.accent }]}>{title.toUpperCase()}</Text>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
  theme,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <View style={[rowStyles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={rowStyles.rowText}>
        <Text style={[rowStyles.rowTitle, { color: theme.text }]}>{title}</Text>
        {description ? (
          <Text style={[rowStyles.rowDesc, { color: theme.secondaryText }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.muted, true: theme.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function ActionRow({
  title,
  description,
  icon,
  onPress,
  destructive,
  theme,
}: {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <TouchableOpacity
      style={[rowStyles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
    >
      <View style={[rowStyles.iconWrap, { backgroundColor: theme.elevated }]}>
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? '#FF4444' : theme.accent}
        />
      </View>
      <View style={rowStyles.rowText}>
        <Text style={[rowStyles.rowTitle, { color: destructive ? '#FF4444' : theme.text }]}>
          {title}
        </Text>
        {description ? (
          <Text style={[rowStyles.rowDesc, { color: theme.secondaryText }]}>{description}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
    </TouchableOpacity>
  );
}

export default function BackupSettingsScreen() {
  const router = useRouter();
  const { settings, updateSetting } = useSettingsStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  const handleCreateBackup = () => {
    const backup = SettingsService.createBackup();
    const date = new Date(backup.createdAt);
    setLastBackupTime(
      `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
    Alert.alert('Backup Created', 'Your settings have been saved locally. Up to 5 backups are kept.');
  };

  const handleRestoreBackup = () => {
    Alert.alert(
      'Restore Backup',
      'This will overwrite all current settings with the most recent backup. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'default',
          onPress: () => {
            const restored = SettingsService.restoreLatestBackup();
            if (restored) {
              Alert.alert('Restored', 'Settings have been restored from the latest backup.');
            } else {
              Alert.alert('No Backup Found', 'Create a backup first before restoring.');
            }
          },
        },
      ]
    );
  };

  const handleResetBackupLocation = () => {
    Alert.alert(
      'Reset Backup Location',
      'Clear the saved auto-backup path and revert to the default location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            SettingsService.resetBackupLocation();
            Alert.alert('Reset', 'Auto-backup location has been cleared.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Backup & Restore</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}
      >
        {/* ── Manual backup ── */}
        <SectionHeader title="Manual Backup" theme={theme} />

        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.secondaryText} />
          <Text style={[styles.infoText, { color: theme.secondaryText }]}>
            Backups save all settings and preferences locally on your device. The 5 most recent
            backups are kept. Your library and downloaded tracks are not included.
          </Text>
        </View>

        <ActionRow
          title="Create Backup"
          description={lastBackupTime ? `Last backup: ${lastBackupTime}` : 'Save a snapshot of your current settings.'}
          icon="cloud-upload-outline"
          onPress={handleCreateBackup}
          theme={theme}
        />
        <ActionRow
          title="Restore Backup"
          description="Overwrite current settings with your most recent backup."
          icon="cloud-download-outline"
          onPress={handleRestoreBackup}
          theme={theme}
        />

        {/* ── Auto backup ── */}
        <SectionHeader title="Auto Backup" theme={theme} />

        <ToggleRow
          title="Enable Auto Backup"
          description="Automatically save a backup whenever settings change."
          value={settings.autoBackup}
          onChange={(v) => updateSetting('autoBackup', v)}
          theme={theme}
        />

        {settings.autoBackup && (
          <View
            style={[
              rowStyles.row,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                flexDirection: 'column',
                alignItems: 'flex-start',
              },
            ]}
          >
            <Text style={[rowStyles.rowTitle, { color: theme.text, marginBottom: 8 }]}>
              Auto Backup Location
            </Text>
            <Text style={[rowStyles.rowDesc, { color: theme.secondaryText, marginBottom: 10 }]}>
              Custom path for auto-saved backups. Leave blank for the default app storage.
            </Text>
            <TextInput
              value={settings.autoBackupLocation}
              onChangeText={(text) => updateSetting('autoBackupLocation', text)}
              placeholder="e.g. /storage/backups/soniq"
              placeholderTextColor={theme.faintText}
              autoCapitalize="none"
              style={[styles.pathInput, { color: theme.text, backgroundColor: theme.elevated }]}
            />
          </View>
        )}

        <ActionRow
          title="Reset Backup Location"
          description="Clear the custom path and revert to default storage."
          icon="folder-outline"
          onPress={handleResetBackupLocation}
          destructive
          theme={theme}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  backButton: { marginRight: 10 },
  title: { fontSize: 20, fontWeight: '900' },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  infoCard: {
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 14,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  pathInput: {
    borderRadius: 8,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
});

const rowStyles = StyleSheet.create({
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 22,
    paddingHorizontal: 2,
  },
  row: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowText: { flex: 1, paddingHorizontal: 12 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowDesc: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
});
