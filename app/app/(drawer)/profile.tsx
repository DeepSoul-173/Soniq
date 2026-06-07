import React, { useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/src/store/settingsStore';
import {
  ACCENT_OPTIONS,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
  SKIN_OPTIONS,
  SUGGESTED_ARTISTS,
  FONTS,
  getPlayerDockHeight,
  getTheme,
} from '@/src/theme/musicTheme';
import { ProfileService } from '@/src/services/profile/ProfileService';
import {
  GRADIENT_BACKGROUNDS,
  LIVE_BACKGROUNDS,
  GLOBAL_IMAGES,
  screenBackground,
} from '@/src/theme/backgrounds';
import {
  dbGetTotalListeningTime,
  dbGetTopArtists,
  dbGetTopTracks,
} from '@/src/services/database/LibraryDatabase';
import { runInnertubeSelfTest, InnertubeSelfTest } from '@/src/services/adapters/InnertubeAdapter';

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

export default function ProfileScreen() {
  const router = useRouter();
  const { settings, updateSetting, toggleListeningMood, toggleLanguage, toggleFavoriteArtist } = useSettingsStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();

  const [artistQuery, setArtistQuery] = useState('');

  type StatsData = {
    totalSeconds: number;
    topArtists: Array<{ artist: string; totalSeconds: number; count: number }>;
    topTracks: Array<{ trackId: string; title: string; artist: string; totalSeconds: number; count: number }>;
  };
  const [stats, setStats] = useState<StatsData | null>(null);

  const [ytTest, setYtTest] = useState<InnertubeSelfTest | null>(null);
  const [ytTesting, setYtTesting] = useState(false);

  const runYtTest = async () => {
    setYtTesting(true);
    setYtTest(null);
    try {
      const result = await runInnertubeSelfTest();
      setYtTest(result);
    } catch {
      setYtTest({ ok: false, videoId: '—', clients: [], winningClient: null, durationMs: 0 });
    } finally {
      setYtTesting(false);
    }
  };

  useEffect(() => {
    Promise.all([dbGetTotalListeningTime(), dbGetTopArtists(5), dbGetTopTracks(5)])
      .then(([totalSeconds, topArtists, topTracks]) =>
        setStats({ totalSeconds, topArtists, topTracks })
      )
      .catch(() => undefined);
  }, []);

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
    <SafeAreaView style={[styles.container, { backgroundColor: screenBackground(settings, theme.background) }]}>
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

        {/* ── Aesthetic ────────────────────────────────────────────────── */}
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Aesthetic</Text>
          <Text style={[styles.sectionHint, { color: theme.secondaryText }]}>
            Choose the mood of the whole app.
          </Text>
          {SKIN_OPTIONS.map((skin) => {
            const selected = (settings.appearanceSkin ?? 'luxe') === skin.value;
            return (
              <TouchableOpacity
                key={skin.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.skinRow,
                  {
                    backgroundColor: theme.elevated,
                    borderColor: selected ? theme.accent : 'transparent',
                  },
                ]}
                onPress={() => updateSetting('appearanceSkin', skin.value)}
              >
                <View style={[styles.skinSwatch, { backgroundColor: skin.previewBg }]}>
                  <View style={[styles.skinDot, { backgroundColor: skin.previewAccent }]} />
                </View>
                <View style={styles.skinCopy}>
                  <Text style={[styles.skinName, { color: theme.text, fontFamily: FONTS.serif }]}>
                    {skin.label}
                  </Text>
                  <Text style={[styles.skinBlurb, { color: theme.secondaryText }]} numberOfLines={1}>
                    {skin.blurb}
                  </Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Background ───────────────────────────────────────────────── */}
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Background</Text>
          <Text style={[styles.sectionHint, { color: theme.secondaryText }]}>
            Set a wallpaper for the app — a gradient, a live animation, or your own photo.
          </Text>
          <View style={styles.bgWrap}>
            {/* Default — clears any custom background */}
            <TouchableOpacity
              style={[styles.bgSwatch, {
                backgroundColor: theme.elevated,
                borderColor: (settings.backgroundType ?? 'theme') === 'theme' ? theme.accent : theme.border,
              }]}
              onPress={() => { updateSetting('backgroundType', 'theme'); updateSetting('backgroundValue', ''); }}
            >
              <Ionicons name="ban-outline" size={18} color={theme.secondaryText} />
            </TouchableOpacity>

            {GRADIENT_BACKGROUNDS.map((g) => {
              const sel = settings.backgroundType === 'gradient' && settings.backgroundValue === g.key;
              return (
                <TouchableOpacity
                  key={g.key}
                  style={[styles.bgSwatch, { borderColor: sel ? theme.accent : 'transparent' }]}
                  onPress={() => { updateSetting('backgroundType', 'gradient'); updateSetting('backgroundValue', g.key); }}
                >
                  <LinearGradient colors={g.colors} style={styles.bgSwatchFill} />
                  {sel && <Ionicons name="checkmark-circle" size={18} color={theme.accent} style={styles.bgCheck} />}
                </TouchableOpacity>
              );
            })}

            {LIVE_BACKGROUNDS.map((l) => {
              const sel = settings.backgroundType === 'live' && settings.backgroundValue === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.bgSwatch, { borderColor: sel ? theme.accent : 'transparent' }]}
                  onPress={() => { updateSetting('backgroundType', 'live'); updateSetting('backgroundValue', l.key); }}
                >
                  <LinearGradient colors={l.from} style={styles.bgSwatchFill} />
                  <View style={styles.liveTag}><Text style={styles.liveTagText}>LIVE</Text></View>
                  {sel && <Ionicons name="checkmark-circle" size={18} color={theme.accent} style={styles.bgCheck} />}
                </TouchableOpacity>
              );
            })}

            {GLOBAL_IMAGES.map((img) => {
              const sel = settings.backgroundType === 'image' && settings.backgroundValue === img.uri;
              return (
                <TouchableOpacity
                  key={img.key}
                  style={[styles.bgSwatch, { borderColor: sel ? theme.accent : 'transparent' }]}
                  onPress={() => { updateSetting('backgroundType', 'image'); updateSetting('backgroundValue', img.uri); }}
                >
                  <Image source={{ uri: img.uri }} style={styles.bgSwatchFill} />
                  {sel && <Ionicons name="checkmark-circle" size={18} color={theme.accent} style={styles.bgCheck} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.imageButton, { backgroundColor: theme.elevated }]}
            onPress={() => ProfileService.pickBackgroundImage()}
          >
            <Ionicons name="image-outline" size={20} color={theme.accent} />
            <Text style={[styles.imageButtonText, { color: theme.text }]}>Choose from your photos</Text>
          </TouchableOpacity>
        </View>

        {/* ── Accent (only meaningful for the Classic skin) ─────────────── */}
        {(settings.appearanceSkin ?? 'luxe') === 'classic' && (
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
        )}

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

          {/* Selected artists — wraps naturally; height tracks the saved count */}
          {favoriteArtists.length > 0 ? (
            <View style={styles.selectedArtists}>
              {favoriteArtists.map((artist) => (
                <TouchableOpacity
                  key={artist}
                  style={[styles.artistChip, { backgroundColor: theme.accent }]}
                  onPress={() => toggleFavoriteArtist(artist)}
                >
                  <Text style={styles.artistChipText} numberOfLines={1}>{artist}</Text>
                  <Ionicons name="close-circle" size={16} color="#08090B" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={[styles.sectionHint, { color: theme.faintText, marginBottom: 4 }]}>
              No favorite artists yet — search or tap a suggestion below to add one.
            </Text>
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

          {/* Suggestions — compact pills that size to the artist name */}
          <View style={styles.chipWrap}>
            {artistSuggestions.map((artist) => (
              <TouchableOpacity
                key={artist}
                style={[styles.artistSuggestion, { backgroundColor: theme.elevated, borderColor: theme.border }]}
                onPress={() => { toggleFavoriteArtist(artist); setArtistQuery(''); }}
              >
                <Ionicons name="musical-note" size={13} color={theme.accent} />
                <Text style={[styles.artistSuggestionText, { color: theme.text }]} numberOfLines={1}>
                  {artist}
                </Text>
                <Ionicons name="add" size={15} color={theme.secondaryText} />
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

        {/* ── Your Insights ────────────────────────────────────────────── */}
        {stats && (stats.totalSeconds > 0 || stats.topArtists.length > 0) && (() => {
          const hrs = Math.floor(stats.totalSeconds / 3600);
          const mins = Math.floor((stats.totalSeconds % 3600) / 60);
          const timeLabel = hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
          const maxArtistSecs = stats.topArtists[0]?.totalSeconds ?? 1;
          const maxTrackSecs = stats.topTracks[0]?.totalSeconds ?? 1;
          return (
            <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Insights</Text>

              {/* Total time */}
              <View style={styles.insightRow}>
                <Ionicons name="time-outline" size={18} color={theme.accent} />
                <Text style={[styles.insightLabel, { color: theme.secondaryText }]}>Total listening time</Text>
                <Text style={[styles.insightValue, { color: theme.text }]}>{timeLabel}</Text>
              </View>

              {/* Top artists */}
              {stats.topArtists.length > 0 && (
                <View style={styles.insightSection}>
                  <Text style={[styles.insightSubtitle, { color: theme.secondaryText }]}>Top Artists</Text>
                  {stats.topArtists.map((a, i) => (
                    <View key={a.artist} style={styles.barRow}>
                      <Text style={[styles.barLabel, { color: theme.text }]} numberOfLines={1}>
                        {i + 1}. {a.artist}
                      </Text>
                      <View style={[styles.barTrack, { backgroundColor: theme.elevated }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              backgroundColor: theme.accent,
                              width: `${Math.round((a.totalSeconds / maxArtistSecs) * 100)}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barCount, { color: theme.secondaryText }]}>
                        {Math.round(a.totalSeconds / 60)} min
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Top tracks */}
              {stats.topTracks.length > 0 && (
                <View style={styles.insightSection}>
                  <Text style={[styles.insightSubtitle, { color: theme.secondaryText }]}>Top Tracks</Text>
                  {stats.topTracks.map((t, i) => (
                    <View key={t.trackId} style={styles.barRow}>
                      <Text style={[styles.barLabel, { color: theme.text }]} numberOfLines={1}>
                        {i + 1}. {t.title}
                      </Text>
                      <View style={[styles.barTrack, { backgroundColor: theme.elevated }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              backgroundColor: theme.accent,
                              width: `${Math.round((t.totalSeconds / maxTrackSecs) * 100)}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barCount, { color: theme.secondaryText }]}>
                        {t.count}×
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })()}

        {/* ── Developer / Playback Diagnostics ─────────────────────────── */}
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Playback Engine</Text>
          <Text style={[styles.sectionHint, { color: theme.secondaryText }]}>
            Tests direct YouTube (InnerTube) extraction — the primary source for streaming.
          </Text>
          <TouchableOpacity
            style={[styles.imageButton, { backgroundColor: theme.elevated }]}
            onPress={runYtTest}
            disabled={ytTesting}
          >
            <Ionicons name={ytTesting ? 'hourglass-outline' : 'pulse-outline'} size={20} color={theme.accent} />
            <Text style={[styles.imageButtonText, { color: theme.text }]}>
              {ytTesting ? 'Testing YouTube source…' : 'Run YouTube source test'}
            </Text>
          </TouchableOpacity>

          {ytTest && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.insightRow}>
                <Ionicons
                  name={ytTest.ok ? 'checkmark-circle' : 'close-circle'}
                  size={18}
                  color={ytTest.ok ? '#3FB950' : '#F85149'}
                />
                <Text style={[styles.insightLabel, { color: theme.text }]}>
                  {ytTest.ok
                    ? `Working — via ${ytTest.winningClient}`
                    : 'Failed — no client returned audio'}
                </Text>
                <Text style={[styles.insightValue, { color: theme.secondaryText }]}>{ytTest.durationMs}ms</Text>
              </View>
              {ytTest.clients.map((c) => (
                <View key={c.name} style={styles.ytRow}>
                  <Ionicons
                    name={c.ok ? 'checkmark' : 'close'}
                    size={14}
                    color={c.ok ? '#3FB950' : theme.faintText}
                  />
                  <Text style={[styles.ytClient, { color: theme.text }]}>{c.name}</Text>
                  <Text style={[styles.ytDetail, { color: theme.secondaryText }]} numberOfLines={1}>
                    {c.urlDomain || c.detail}
                  </Text>
                </View>
              ))}
            </View>
          )}
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
  name: { fontSize: 28, fontWeight: '700', fontFamily: FONTS.serif },
  caption: { fontSize: 13, lineHeight: 18, marginTop: 4 },

  panel: { borderRadius: 8, borderWidth: 1, marginBottom: 14, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  sectionHint: { fontSize: 12, fontWeight: '600', marginBottom: 12 },

  input: { borderRadius: 8, fontSize: 15, height: 46, marginBottom: 10, paddingHorizontal: 14 },
  imageButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', height: 46, paddingHorizontal: 14 },
  imageButtonText: { fontSize: 14, fontWeight: '800', marginLeft: 10 },

  swatchRow: { flexDirection: 'row' },
  swatch: { alignItems: 'center', borderRadius: 18, borderWidth: 2, height: 36, justifyContent: 'center', marginRight: 12, width: 36 },

  // Aesthetic skin picker
  skinRow: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    marginTop: 10,
    padding: 10,
  },
  skinSwatch: {
    alignItems: 'center',
    borderRadius: 10,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  skinDot: { borderRadius: 7, height: 14, width: 14 },
  skinCopy: { flex: 1, paddingHorizontal: 12 },
  skinName: { fontSize: 17, fontWeight: '700' },
  skinBlurb: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Background picker
  bgWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12, marginTop: 2 },
  bgSwatch: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  bgSwatchFill: { ...StyleSheet.absoluteFillObject },
  bgCheck: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 9 },
  liveTag: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 4, bottom: 3, paddingHorizontal: 3, position: 'absolute', right: 3 },
  liveTagText: { color: '#fff', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },

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
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  artistChipText: { color: '#08090B', flexShrink: 1, fontSize: 13, fontWeight: '900' },
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
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  artistSuggestionText: { fontSize: 13, fontWeight: '700' },

  segmented: { flexDirection: 'row', marginBottom: 16 },
  segment: { alignItems: 'center', borderRadius: 8, flex: 1, marginRight: 8, paddingVertical: 10 },
  segmentText: { fontSize: 13, fontWeight: '800' },
  switchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  switchCopy: { flex: 1, paddingRight: 16 },
  rowTitle: { fontSize: 15, fontWeight: '700' },

  // Insights
  insightRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 14 },
  insightLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  insightValue: { fontSize: 14, fontWeight: '800' },
  insightSection: { marginTop: 12 },
  insightSubtitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  barRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 8 },
  barLabel: { fontSize: 12, fontWeight: '700', width: 110 },
  barTrack: { borderRadius: 4, flex: 1, height: 6, overflow: 'hidden' },
  barFill: { borderRadius: 4, height: '100%' },
  barCount: { fontSize: 11, fontWeight: '700', minWidth: 40, textAlign: 'right' },

  // YouTube source test
  ytRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 6 },
  ytClient: { fontSize: 12, fontWeight: '800', width: 120 },
  ytDetail: { flex: 1, fontSize: 12, fontWeight: '600' },

  donatePanel: { alignItems: 'center' },
  donateButton: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
  donateText: { color: '#08090B', fontSize: 15, fontWeight: '900' },
});
