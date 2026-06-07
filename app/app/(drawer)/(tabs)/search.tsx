import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/src/store/settingsStore';
import { usePlayerStore } from '@/src/store/playerStore';
import { TrackItem } from '@/src/components/ui/TrackItem';
import { Track } from '@/src/models/types';
import { SearchService } from '@/src/services/search/SearchService';
import { GENRE_OPTIONS, FONTS, getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';
import { screenBackground } from '@/src/theme/backgrounds';

export default function SearchScreen() {
  const { settings } = useSettingsStore();
  const { setQueue, addToQueue } = usePlayerStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingTrackId, setResolvingTrackId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // When "Live search" is off, don't search on every keystroke — wait for the
    // user to submit (handled by the input's onSubmitEditing). Still clear stale
    // results when the box is emptied.
    if (!settings.liveSearch) {
      if (query.trim().length <= 2) setResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      const trimmed = query.trim();
      if (trimmed.length > 2) {
        performSearch(trimmed);
      } else {
        setResults([]);
      }
    }, 450);

    return () => clearTimeout(timeout);
  }, [query, settings.liveSearch]);

  const performSearch = async (term: string) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const tracks = await SearchService.searchAll(term);
      setResults(tracks);
    } catch (error) {
      console.error('Piped search failed', error);
      setResults([]);
      setErrorMessage('Piped search is unavailable right now. Try another song or search again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const submitGenre = (genre: string) => {
    setQuery(genre);
    performSearch(genre);
  };

  const resolveResultForPlayback = async (track: Track) => {
    if (track.sourceType !== 'piped' || track.streamUrl) return track;
    setResolvingTrackId(track.id);
    try {
      return await SearchService.prepareTrackForPlayback(track);
    } finally {
      setResolvingTrackId(null);
    }
  };

  const playResult = async (track: Track, index: number) => {
    try {
      setErrorMessage('');
      const playableTrack = await resolveResultForPlayback(track);
      const playableResults = results.map((item, itemIndex) => itemIndex === index ? playableTrack : item);
      setResults(playableResults);
      setQueue(playableResults, index);
    } catch (error) {
      console.error('Piped stream lookup failed', error);
      setErrorMessage('This Piped result could not provide a playable audio stream. Try another result.');
    }
  };

  const queueResult = async (track: Track) => {
    try {
      setErrorMessage('');
      const playableTrack = await resolveResultForPlayback(track);
      setResults((current) => current.map((item) => item.id === playableTrack.id ? playableTrack : item));
      addToQueue(playableTrack);
    } catch (error) {
      console.error('Piped stream lookup failed', error);
      setErrorMessage('This Piped result could not provide a playable audio stream. Try another result.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: screenBackground(settings, theme.background) }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Search</Text>
        <View style={[styles.searchBar, { backgroundColor: theme.elevated }]}>
          <Ionicons name="search" size={20} color={theme.secondaryText} />
          <TextInput
            autoCapitalize="none"
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search songs and artists on Piped"
            placeholderTextColor={theme.secondaryText}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => query.trim().length > 1 && performSearch(query.trim())}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {query.length <= 2 && (
        <View style={styles.browse}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Browse</Text>
          <View style={styles.chipWrap}>
            {GENRE_OPTIONS.map((genre) => (
              <TouchableOpacity
                key={genre}
                style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => submitGenre(genre)}
              >
                <Text style={[styles.chipText, { color: theme.text }]}>{genre}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.sourceNote, { color: theme.secondaryText }]}>
            Search is powered by Piped and plays real audio streams without accounts.
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={theme.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <TrackItem
              track={item}
              onPress={() => playResult(item, index)}
              onAddToQueue={() => queueResult(item)}
            />
          )}
          contentContainerStyle={[styles.results, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}
          ListHeaderComponent={
            resolvingTrackId ? (
              <Text style={[styles.resolvingText, { color: theme.secondaryText }]}>Preparing audio stream...</Text>
            ) : null
          }
          ListEmptyComponent={
            query.length > 2 ? (
              <View style={styles.empty}>
                <Ionicons name={errorMessage ? 'cloud-offline-outline' : 'radio-outline'} size={44} color={theme.secondaryText} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  {errorMessage ? 'Piped search failed' : 'No tracks found'}
                </Text>
                <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
                  {errorMessage || 'Try another song, artist, or mood.'}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    fontFamily: FONTS.serif,
    marginBottom: 16,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    height: 48,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    marginLeft: 10,
  },
  browse: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    marginRight: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  sourceNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  loader: {
    marginTop: 40,
  },
  results: {
    paddingTop: 8,
  },
  resolvingText: {
    fontSize: 12,
    fontWeight: '700',
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 70,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});
