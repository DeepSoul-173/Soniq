import React, { useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useLibraryStore } from '@/src/store/libraryStore';
import { usePlayerStore } from '@/src/store/playerStore';
import { TrackItem } from '@/src/components/ui/TrackItem';
import { Playlist, Track } from '@/src/models/types';
import { getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';

type LibraryTab = 'playlists' | 'liked' | 'recent';

export default function LibraryScreen() {
  const { settings } = useSettingsStore();
  const router = useRouter();
  const { likedTracks, recentlyPlayed, savedPlaylists } = useLibraryStore();
  const { setQueue } = usePlayerStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<LibraryTab>('playlists');

  const playlists = useMemo<Playlist[]>(() => {
    return savedPlaylists;
  }, [savedPlaylists]);

  const tracks = activeTab === 'liked' ? likedTracks : recentlyPlayed;

  const renderTrack = ({ item, index }: { item: Track; index: number }) => (
    <TrackItem track={item} onPress={() => setQueue(tracks, index)} />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Your Library</Text>
          <Text style={[styles.subtitle, { color: theme.secondaryText }]}>Saved mixes, likes, and listening history</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: theme.elevated }]}
          onPress={() => router.push('/(drawer)/(tabs)/search')}
        >
          <Ionicons name="search" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        {[
          ['playlists', 'Playlists'],
          ['liked', 'Liked'],
          ['recent', 'Recent'],
        ].map(([key, label]) => {
          const selected = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, { backgroundColor: selected ? theme.accent : theme.elevated }]}
              onPress={() => setActiveTab(key as LibraryTab)}
            >
              <Text style={[styles.tabText, { color: selected ? '#08090B' : theme.text }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'playlists' ? (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="albums-outline" size={54} color={theme.secondaryText} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No playlists saved</Text>
              <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
                Playlists you create or save will stay local on this device.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.playlistRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setQueue(item.tracks)}
            >
              <Image source={{ uri: item.artworkUrl || item.tracks[0]?.artworkUrl || 'https://via.placeholder.com/150' }} style={styles.playlistArt} />
              <View style={styles.playlistCopy}>
                <Text style={[styles.playlistTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.playlistMeta, { color: theme.secondaryText }]} numberOfLines={1}>
                  {item.tracks.length} tracks - {item.creatorName || 'Soniq'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.secondaryText} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderTrack}
          contentContainerStyle={[styles.listContent, { paddingBottom: getPlayerDockHeight(insets.bottom) }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={54} color={theme.secondaryText} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Nothing saved here yet</Text>
              <Text style={[styles.emptyText, { color: theme.secondaryText }]}>
                Play or like a track and it will appear in this shelf.
              </Text>
            </View>
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
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tab: {
    borderRadius: 18,
    marginRight: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  playlistRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 10,
  },
  playlistArt: {
    borderRadius: 7,
    height: 58,
    width: 58,
  },
  playlistCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  playlistTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  playlistMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});
