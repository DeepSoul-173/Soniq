import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { useLibraryStore } from '@/src/store/libraryStore';
import { TrackItem } from '@/src/components/ui/TrackItem';
import { Track } from '@/src/models/types';
import { SearchService } from '@/src/services/SearchService';
import { getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';

const safeJoin = (values: unknown, separator = ', ') =>
  Array.isArray(values)
    ? values.filter((item) => typeof item === 'string' && item.trim().length > 0).join(separator)
    : '';

export default function HomeScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { settings } = useSettingsStore();
  const { recentlyPlayed, likedTracks } = useLibraryStore();
  const { setQueue, addToQueue } = usePlayerStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    SearchService.searchAll('popular songs')
      .then((results) => {
        if (!cancelled) setTracks(results);
      })
      .catch((error) => console.error('Home Piped load failed', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const replacePreparedTrack = (track: Track) => {
    setTracks((current) => current.map((item) => item.id === track.id ? track : item));
  };

  const prepareTrack = async (track: Track) => {
    if (track.streamUrl) return track;
    const playableTrack = await SearchService.prepareTrackForPlayback(track);
    replacePreparedTrack(playableTrack);
    return playableTrack;
  };

  const playCollection = async (collection: Track[], startIndex = 0) => {
    const selectedTrack = collection[startIndex];
    if (!selectedTrack) return;

    try {
      const playableTrack = await prepareTrack(selectedTrack);
      const queue = collection.map((track, index) => index === startIndex ? playableTrack : track);
      setQueue(queue, startIndex);
    } catch (error) {
      console.error('Home Piped stream lookup failed', error);
    }
  };

  const queueTrack = async (track: Track) => {
    try {
      addToQueue(await prepareTrack(track));
    } catch (error) {
      console.error('Home Piped stream lookup failed', error);
    }
  };

  const renderTrackList = (items: Track[]) => (
    <View style={[styles.listSurface, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {items.map((track, index) => (
        <TrackItem
          key={track.id}
          track={track}
          onPress={() => playCollection(items, index)}
          onAddToQueue={() => queueTrack(track)}
        />
      ))}
    </View>
  );

  const topTracks = tracks.slice(0, 6);
  const libraryTracks = recentlyPlayed.length ? recentlyPlayed : likedTracks;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />

      <SafeAreaView
        edges={['top']}
        style={[styles.stickyHeader, { backgroundColor: theme.overlay, borderBottomColor: theme.border }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.roundButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
            <Ionicons name="menu" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.greetingCopy}>
            <Text style={[styles.greeting, { color: theme.text }]}>{greeting}</Text>
            <Text style={[styles.subGreeting, { color: theme.secondaryText }]} numberOfLines={1}>
              {safeJoin(settings?.preferredListeningMoods, ' / ') || 'Real songs from Piped'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile' as any)}>
            <Image source={{ uri: settings.profileImageUri }} style={styles.avatar} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.searchBar, { backgroundColor: theme.elevated }]}
          onPress={() => router.push('/(drawer)/(tabs)/search')}
        >
          <Ionicons name="search" size={20} color={theme.secondaryText} />
          <TextInput
            editable={false}
            pointerEvents="none"
            placeholder="Search songs and artists on Piped"
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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Piped Picks</Text>
            <TouchableOpacity onPress={() => playCollection(topTracks)}>
              <Text style={[styles.textButton, { color: theme.accent }]}>Play all</Text>
            </TouchableOpacity>
          </View>

          {topTracks.length ? (
            <View style={styles.quickGrid}>
              {topTracks.slice(0, 4).map((track, index) => (
                <TouchableOpacity
                  key={track.id}
                  style={[styles.quickTile, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => playCollection(topTracks, index)}
                >
                  <Image source={{ uri: track.artworkUrl || 'https://via.placeholder.com/150' }} style={styles.quickArt} />
                  <Text style={[styles.quickTitle, { color: theme.text }]} numberOfLines={2}>
                    {track.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name={loading ? 'sync' : 'search'} size={28} color={theme.accent} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {loading ? 'Loading Piped songs' : 'Search for any song'}
              </Text>
              <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
                The home feed no longer uses bundled demo tracks.
              </Text>
            </View>
          )}
        </View>

        {topTracks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Real Results</Text>
            {renderTrackList(topTracks)}
          </View>
        )}

        {libraryTracks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>From Your Library</Text>
            {renderTrackList(libraryTracks.slice(0, 8))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  roundButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  greetingCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  greeting: {
    fontSize: 25,
    fontWeight: '900',
  },
  subGreeting: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  avatar: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    height: 46,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 10,
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  textButton: {
    fontSize: 13,
    fontWeight: '800',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
  },
  quickTile: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    height: 64,
    margin: 6,
    overflow: 'hidden',
    width: '46.8%',
  },
  quickArt: {
    backgroundColor: '#333',
    height: 64,
    width: 64,
  },
  quickTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
  },
  listSurface: {
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  emptyPanel: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 20,
    padding: 22,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});
