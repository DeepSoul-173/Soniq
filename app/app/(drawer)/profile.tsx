import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
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
import {
  ACCENT_OPTIONS,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
  SUGGESTED_ARTISTS,
  getPlayerDockHeight,
  getTheme,
} from '@/src/theme/musicTheme';
import { ProfileService } from '@/src/services/profile/ProfileService';

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

export default function ProfileScreen() {
  const router = useRouter();
  const { settings, updateSetting, toggleListeningMood, toggleLanguage, toggleFavoriteArtist } = useSettingsStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();

  const [artistQuery, setArtistQuery] = useState('');

  const favoriteArtists = normalizeStringArray(settings.favoriteArtists);
  const preferredLanguages = normalizeStringArray(settings.preferredLanguages);
  const preferredMoods = normalizeStringArray(settings.preferredListeningMoods);

  const pickImage = async () => {
    await ProfileService.pickProfileImage();
  };

  // Filtered suggestions: predefined artists not yet selected, filtered by query
  const artistSuggestions = SUGGESTED_ARTISTS.filter(
    (a) =>
      !favoriteArtists.includes(a) &&
      (artistQuery.length === 0 || a.toLowerCase().includes(artistQuery.toLowerCase()))
  );

  const handleAddCustomArtist = () => {
    const trimmed = artistQuery.trim();
    if (trimmed && !favoriteArtists.includes(trimmed)) {
      toggleFavoriteArtist(trimmed);
      setArtistQuery('');
    }
  };

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

        {/* ── Identity ─────────────────────────────────────────────────── */}
        <View style={styles.identity}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickImage}>
            <Image source={{ uri: settings.profileImageUri }} style={styles.avatar} />
            <View style={[styles.avatarEdit, { backgroundColor: theme.accent }]}>
              <Ionicons name="pencil" size={16} color="#08090B" />
            </View>
          </TouchableOpacity>
          <View style={styles.identityText}>
            <Text style={[styles.name, { color: theme.text }]}>{settings.displayName}</Text>
            <Text style={[styles.caption, { color: theme.secondaryText }]}>
              Tap the avatar to choose an image from your phone.
            </Text>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Identity</Text>
          <TextInput
            value={settings.displayName}
            onChangeText={(value) => ProfileService.updateDisplayName(value)}
            placeholder="Display name"
            placeholderTextColor={theme.faintText}
            style={[styles.input, { color: theme.text, backgroundColor: theme.elevated }]}
          />
          <TouchableOpacity style={[styles.imageButton, { backgroundColor: theme.elevated }]} onPress={pickImage}>
            <Ionicons name="image-outline" size={20} color={theme.accent} />
            <Text style={[styles.imageButtonText, { color: theme.text }]}>Choose profile image</Text>
          </TouchableOpacity>
        </View>

        {/* ── Accent ───────────────────────────────────────────────────── */}
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

        {/* ── Languages ────────────────────────────────────────────────── */}
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Preferred Languages</Text>
          <Text style={[styles.sectionHint, { color: theme.secondaryText }]}>
            Tune recommendations toward music in your languages.
          </Text>
          <View style={styles.chipWrap}>
            {LANGUAGE_OPTIONS.map((lang) => {
              const selected = preferredLanguages.includes(lang);
              return (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.accent : theme.elevated,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                  ]}
                  onPress={() => toggleLanguage(lang)}
                >
                  <Text style={[styles.chipText, { color: selected ? '#08090B' : theme.text }]}>{lang}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Genres / Moods ───────────────────────────────────────────── */}
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Genres & Moods</Text>
          <Text style={[styles.sectionHint, { color: theme.secondaryText }]}>
            Select everything that matches your vibe.
          </Text>
          <View style={styles.chipWrap}>
            {GENRE_OPTIONS.map((genre) => {
              const selected = preferredMoods.includes(genre);
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

        {/* ── Favorite Artists ─────────────────────────────────────────── */}
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Favorite Artists</Text>
          <Text style={[styles.sectionHint, { color: theme.secondaryText }]}>
            Pick artists you love — Soniq Radio will play their music.
          </Text>

          {/* Selected artists */}
          {favoriteArtists.length > 0 && (
            <View style={styles.selectedArtists}>
              {favoriteArtists.map((artist) => (
                <TouchableOpacity
                  key={artist}
                  style={[styles.artistChip, { backgroundColor: theme.accent }]}
                  onPress={() => toggleFavoriteArtist(artist)}
                >
                  <Text style={styles.artistChipText}>{artist}</Text>
                  <Ionicons name="close-circle" size={16} color="#08090B" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Search / add custom artist */}
          <View style={[styles.artistSearchRow, { backgroundColor: theme.elevated }]}>
            <Ionicons name="search" size={17} color={theme.secondaryText} style={{ marginRight: 8 }} />
            <TextInput
              value={artistQuery}
              onChangeText={setArtistQuery}
              onSubmitEditing={handleAddCustomArtist}
              placeholder="Search or add an artist"
              placeholderTextColor={theme.faintText}
              style={[styles.artistSearchInput, { color: theme.text }]}
              returnKeyType="done"
            />
            {artistQuery.trim().length > 0 && (
              <TouchableOpacity onPress={handleAddCustomArtist} style={styles.addArtistBtn}>
                <Ionicons name="add-circle" size={22} color={theme.accent} />
              </TouchableOpacity>
            )}
          </View>

          {/* Suggestions grid */}
          <View style={styles.chipWrap}>
            {artistSuggestions.map((artist) => (
              <TouchableOpacity
                key={artist}
                style={[styles.artistSuggestion, { backgroundColor: theme.elevated, borderColor: theme.border }]}
                onPress={() => { toggleFavoriteArtist(artist); setArtistQuery(''); }}
              >
                <View style={[styles.artistAvatar, { backgroundColor: theme.muted }]}>
                  <Ionicons name="musical-note" size={14} color={theme.accent} />
                </View>
                <Text style={[styles.artistSuggestionText, { color: theme.text }]} numberOfLines={1}>
                  {artist}
                </Text>
                <Ionicons name="add" size={16} color={theme.secondaryText} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Appearance ───────────────────────────────────────────────── */}
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

        {/* ── Support the Developer ─────────────────────────────────────── */}
        <View style={[styles.panel, styles.donatePanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text, textAlign: 'center' }]}>Support the Developer</Text>
          <Text style={[styles.caption, { color: theme.secondaryText, textAlign: 'center', marginBottom: 14 }]}>
            Soniq is free and built by Abhijith.{'\n'}If you enjoy it, a coffee goes a long way.
          </Text>
          <TouchableOpacity
            style={[styles.donateButton, { backgroundColor: theme.accent }]}
            onPress={() =>
              Linking.openURL('https://buymeacoffee.com/abhijithpr173').catch(() =>
                Alert.alert('Cannot open link', 'Visit buymeacoffee.com/abhijithpr173 in your browser.')
              )
            }
          >
            <Ionicons name="cafe-outline" size={18} color="#08090B" />
            <Text style={styles.donateText}>Buy me a coffee</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 18,
    paddingTop: 8,
  },
  iconButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  headerTitle: { fontSize: 16, fontWeight: '800' },

  identity: { alignItems: 'center', flexDirection: 'row', marginBottom: 20 },
  avatar: { borderRadius: 42, height: 84, width: 84 },
  avatarWrap: { height: 84, width: 84 },
  avatarEdit: {
    alignItems: 'center',
    borderRadius: 16,
    bottom: 0,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 32,
  },
  identityText: { flex: 1, marginLeft: 16 },
  name: { fontSize: 26, fontWeight: '900' },
  caption: { fontSize: 13, lineHeight: 18, marginTop: 4 },

  panel: { borderRadius: 8, borderWidth: 1, marginBottom: 14, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  sectionHint: { fontSize: 12, fontWeight: '600', marginBottom: 12 },

  input: { borderRadius: 8, fontSize: 15, height: 46, marginBottom: 10, paddingHorizontal: 14 },
  imageButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', height: 46, paddingHorizontal: 14 },
  imageButtonText: { fontSize: 14, fontWeight: '800', marginLeft: 10 },

  swatchRow: { flexDirection: 'row' },
  swatch: { alignItems: 'center', borderRadius: 18, borderWidth: 2, height: 36, justifyContent: 'center', marginRight: 12, width: 36 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  chip: { borderRadius: 18, borderWidth: 1, marginBottom: 10, marginRight: 8, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '800' },

  // Artist section
  selectedArtists: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  artistChip: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  artistChipText: { color: '#08090B', fontSize: 13, fontWeight: '900' },
  artistSearchRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  artistSearchInput: { flex: 1, fontSize: 14, height: 44 },
  addArtistBtn: { padding: 4 },
  artistSuggestion: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  artistAvatar: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginRight: 8,
    width: 28,
  },
  artistSuggestionText: { flex: 1, fontSize: 13, fontWeight: '700' },

  segmented: { flexDirection: 'row', marginBottom: 16 },
  segment: { alignItems: 'center', borderRadius: 8, flex: 1, marginRight: 8, paddingVertical: 10 },
  segmentText: { fontSize: 13, fontWeight: '800' },
  switchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  switchCopy: { flex: 1, paddingRight: 16 },
  rowTitle: { fontSize: 15, fontWeight: '700' },

  donatePanel: { alignItems: 'center' },
  donateButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
  donateText: { color: '#08090B', fontSize: 15, fontWeight: '900' },
});
