import React from 'react';
import {
  Image,
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
import { ACCENT_OPTIONS, GENRE_OPTIONS, getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

export default function ProfileScreen() {
  const router = useRouter();
  const { settings, updateSetting, toggleListeningMood } = useSettingsStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.identity}>
          <Image source={{ uri: settings.profileImageUri }} style={styles.avatar} />
          <View style={styles.identityText}>
            <Text style={[styles.name, { color: theme.text }]}>{settings.displayName}</Text>
            <Text style={[styles.caption, { color: theme.secondaryText }]}>
              Personalize the way Soniq looks and recommends music.
            </Text>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Identity</Text>
          <TextInput
            value={settings.displayName}
            onChangeText={(value) => updateSetting('displayName', value)}
            placeholder="Display name"
            placeholderTextColor={theme.faintText}
            style={[styles.input, { color: theme.text, backgroundColor: theme.elevated }]}
          />
          <TextInput
            value={settings.profileImageUri}
            onChangeText={(value) => updateSetting('profileImageUri', value)}
            placeholder="Profile image URL"
            placeholderTextColor={theme.faintText}
            autoCapitalize="none"
            style={[styles.input, { color: theme.text, backgroundColor: theme.elevated }]}
          />
        </View>

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Accent</Text>
          <View style={styles.swatchRow}>
            {ACCENT_OPTIONS.map((option) => {
              const selected = option.value === settings.accentColor;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.swatch,
                    { backgroundColor: option.value, borderColor: selected ? theme.text : 'transparent' },
                  ]}
                  onPress={() => updateSetting('accentColor', option.value)}
                >
                  {selected && <Ionicons name="checkmark" size={18} color="#08090B" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Listening Preferences</Text>
          <View style={styles.chipWrap}>
            {GENRE_OPTIONS.map((genre) => {
              const selected = normalizeStringArray(settings.preferredListeningMoods).includes(genre);
              return (
                <TouchableOpacity
                  key={genre}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.accent : theme.elevated,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                  ]}
                  onPress={() => toggleListeningMood(genre)}
                >
                  <Text style={[styles.chipText, { color: selected ? '#08090B' : theme.text }]}>{genre}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>
          <View style={styles.segmented}>
            {(['dark', 'light', 'system'] as const).map((mode) => {
              const selected = settings.theme === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.segment, { backgroundColor: selected ? theme.accent : theme.elevated }]}
                  onPress={() => updateSetting('theme', mode)}
                >
                  <Text style={[styles.segmentText, { color: selected ? '#08090B' : theme.text }]}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Dense library lists</Text>
              <Text style={[styles.caption, { color: theme.secondaryText }]}>Show more songs on smaller phones.</Text>
            </View>
            <Switch
              value={settings.useDenseLists}
              onValueChange={(value) => updateSetting('useDenseLists', value)}
              trackColor={{ false: theme.muted, true: theme.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 18,
    paddingTop: 8,
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  identity: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatar: {
    borderRadius: 42,
    height: 84,
    width: 84,
  },
  identityText: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 26,
    fontWeight: '900',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  input: {
    borderRadius: 8,
    fontSize: 15,
    height: 46,
    marginBottom: 10,
    paddingHorizontal: 14,
  },
  swatchRow: {
    flexDirection: 'row',
  },
  swatch: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    marginRight: 12,
    width: 36,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  segmented: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchCopy: {
    flex: 1,
    paddingRight: 16,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
});
