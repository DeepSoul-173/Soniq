import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { useSettingsStore } from '@/src/store/settingsStore';
import { usePlayerStore } from '@/src/store/playerStore';
import { Track } from '@/src/models/types';
import { FONTS, getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';
import { hasCustomBackground, screenBackground } from '@/src/theme/backgrounds';
import {
  ArtistRecommendation,
  HomeRecommendationSection,
  RecommendationEngine,
} from '@/src/services/recommendations/RecommendationEngine';
import { SearchService } from '@/src/services/search/SearchService';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

const safeJoin = (values: unknown, separator = ', ') =>
  Array.isArray(values)
    ? values.filter((item) => typeof item === 'string' && item.trim().length > 0).join(separator)
    : '';

export default function HomeScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { settings } = useSettingsStore();
  const { setQueue, addToQueue } = usePlayerStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();
  const { railCardWidth } = useResponsiveLayout();
  const [sections, setSections] = useState<HomeRecommendationSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchingArtistId, setSearchingArtistId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      setLoading(true);
      RecommendationEngine.getHomeRecommendations()
        .then(({ sections: tier1, loadMore }) => {
          if (cancelled) return;
          setSections(tier1);
          setLoading(false); // Tier 1 rendered — spinner off immediately
          loadMore()
            .then((tier2) => {
              if (!cancelled && tier2.length > 0) {
                setSections((prev) => [...prev, ...tier2]);
              }
            })
            .catch(() => {}); // Tier 2 failures are silent
        })
        .catch((err) => {
          console.error('Home recommendations failed', err);
          if (!cancelled) setLoading(false);
        });
    };

    load();
    // Refresh taste-based sections every 30 minutes while screen is mounted
    const interval = setInterval(load, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [settings.musicLanguage, settings.preferredLanguages]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const playTracks = (tracks: Track[] = [], startIndex = 0) => {
    if (tracks.length === 0) return;
    setQueue(tracks, startIndex);
  };

  const renderTrackCard = (track: Track, tracks: Track[], index: number) => (
    <TouchableOpacity
      key={`${track.id}-${index}`}
      style={[styles.songCard, { width: railCardWidth, backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => playTracks(tracks, index)}
    >
      <Image source={{ uri: track.artwork || track.artworkUrl || 'https://via.placeholder.com/180' }} style={styles.cardArt} />
      <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
        {track.title}
      </Text>
      <Text style={[styles.cardSubtitle, { color: theme.secondaryText }]} numberOfLines={1} ellipsizeMode="tail">
        {track.artist || track.artistName}
      </Text>
      <TouchableOpacity style={styles.cardIcon} onPress={() => addToQueue(track)}>
        <Ionicons name="add-circle-outline" size={22} color={theme.accent} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const handleArtistPress = async (artist: ArtistRecommendation) => {
    if (searchingArtistId) return;
    setSearchingArtistId(artist.id);
    try {
      const query = artist.searchQuery ?? `${artist.name} best songs`;
      const results = await SearchService.searchAll(query);
      if (results.length > 0) setQueue(results, 0);
    } catch { /* ignore */ }
    setSearchingArtistId(null);
  };

  const renderArtistCard = (artist: ArtistRecommendation) => {
    const isSearching = searchingArtistId === artist.id;
    const initials = artist.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return (
      <TouchableOpacity
        key={artist.id}
        style={[styles.artistCard, { width: railCardWidth, backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => handleArtistPress(artist)}
        activeOpacity={0.75}
      >
        <View style={[styles.artistAvatarWrap, { backgroundColor: theme.elevated }]}>
          {isSearching
            ? <ActivityIndicator color={theme.accent} />
            : artist.image
              ? <Image source={{ uri: artist.image }} style={StyleSheet.absoluteFill as any} />
              : <Text style={[styles.artistInitials, { color: theme.accent }]}>{initials}</Text>
          }
        </View>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
          {artist.name}
        </Text>
        <Text style={[styles.cardSubtitle, { color: theme.secondaryText }]} numberOfLines={1} ellipsizeMode="tail">
          {artist.reason}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderAlbumCard = (album: NonNullable<HomeRecommendationSection['albums']>[number]) => (
    <TouchableOpacity
      key={album.id}
      style={[styles.albumCard, { width: railCardWidth, backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => playTracks(album.tracks)}
    >
      <Image source={{ uri: album.artwork || 'https://via.placeholder.com/180' }} style={styles.cardArt} />
      <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
        {album.title}
      </Text>
      <Text style={[styles.cardSubtitle, { color: theme.secondaryText }]} numberOfLines={1} ellipsizeMode="tail">
        {album.artist}
      </Text>
    </TouchableOpacity>
  );

  const renderSection = (section: HomeRecommendationSection) => {
    const tracks = section.tracks || [];
    const hasItems = tracks.length || section.artists?.length || section.albums?.length;
    if (!hasItems) return null;

    return (
      <View key={section.id} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.secondaryText }]} numberOfLines={1}>{section.subtitle}</Text>
          </View>
          {tracks.length > 0 && (
            <TouchableOpacity onPress={() => playTracks(tracks)}>
              <Ionicons name="play-circle" size={30} color={theme.accent} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {section.kind === 'artists'
            ? section.artists?.map(renderArtistCard)
            : section.kind === 'albums'
              ? section.albums?.map(renderAlbumCard)
              : tracks.map((track, index) => renderTrackCard(track, tracks, index))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: screenBackground(settings, theme.background) }]}>
      {/* Skip the home's own gradient when a custom app background is active. */}
      {!hasCustomBackground(settings) && (
        <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />
      )}

      <SafeAreaView edges={['top']} style={[styles.stickyHeader, { backgroundColor: theme.overlay, borderBottomColor: theme.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.roundButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
            <Ionicons name="menu" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.greetingCopy}>
            <Text style={[styles.greeting, { color: theme.text }]}>{greeting}</Text>
            <Text style={[styles.subGreeting, { color: theme.secondaryText }]} numberOfLines={1}>
              {safeJoin(settings.preferredListeningMoods, ' / ') || 'Made from your local profile'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile' as any)}>
            <Image source={{ uri: settings.profileImageUri }} style={styles.avatar} />
            <View style={[styles.editDot, { backgroundColor: theme.accent }]}>
              <Ionicons name="pencil" size={10} color="#08090B" />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.85} style={[styles.searchBar, { backgroundColor: theme.elevated }]} onPress={() => router.push('/(drawer)/(tabs)/search')}>
          <Ionicons name="search" size={20} color={theme.secondaryText} />
          <TextInput
            editable={false}
            pointerEvents="none"
            placeholder="Search songs, singers, moods"
            placeholderTextColor={theme.secondaryText}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </TouchableOpacity>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: getPlayerDockHeight(insets.bottom) + 12,
            paddingTop: insets.top + 142,
          },
        ]}
      >
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.secondaryText }]}>Building local-first recommendations</Text>
          </View>
        )}
        {sections.map(renderSection)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stickyHeader: {
    borderBottomWidth: 1,
    left: 0,
    paddingBottom: 14,
    paddingHorizontal: 20,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: 14,
    paddingTop: 8,
  },
  roundButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  greetingCopy: { flex: 1, paddingHorizontal: 12 },
  greeting: { fontSize: 27, fontWeight: '700', fontFamily: FONTS.serif },
  subGreeting: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  avatar: { borderRadius: 20, height: 40, width: 40 },
  editDot: {
    alignItems: 'center',
    borderRadius: 9,
    bottom: -1,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    width: 18,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    height: 46,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 14, marginLeft: 10 },
  scrollContent: { flexGrow: 1 },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  loadingText: { fontSize: 12, fontWeight: '700', marginLeft: 10 },
  section: { marginBottom: 30 },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionCopy: { flex: 1, paddingRight: 12 },
  sectionTitle: { fontSize: 21, fontWeight: '900' },
  sectionSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  rail: { paddingHorizontal: 16 },
  // Width is injected dynamically via railCardWidth — do NOT set width here
  songCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 10,
    padding: 10,
  },
  // Shared square art — fills the card minus padding
  cardArt: { aspectRatio: 1, backgroundColor: '#333', borderRadius: 7, width: '100%' },
  albumCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 10,
    padding: 10,
  },
  artistCard: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 10,
    padding: 12,
  },
  artistAvatarWrap: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 999,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '60%',
  },
  artistInitials: { fontSize: 22, fontWeight: '900' },
  cardTitle: { fontSize: 14, fontWeight: '900', marginTop: 10 },
  cardSubtitle: { fontSize: 12, fontWeight: '600', lineHeight: 16, marginTop: 3 },
  cardIcon: { alignSelf: 'flex-end', marginTop: 8 },
});
