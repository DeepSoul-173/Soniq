import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useLibraryStore } from '@/src/store/libraryStore';
import { usePlayerStore } from '@/src/store/playerStore';
import { TrackItem } from '@/src/components/ui/TrackItem';
import { Playlist, Track } from '@/src/models/types';
import { getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';
import { PlaylistImporter } from '@/src/services/playlist/PlaylistImporter';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

type LibraryTab = 'playlists' | 'liked' | 'recent';

export default function LibraryScreen() {
  const { settings } = useSettingsStore();
  const router = useRouter();
  const { likedTracks, recentlyPlayed, savedPlaylists, savePlaylist } = useLibraryStore();
  const { setQueue } = usePlayerStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();
  const { gridColumns, gridCellWidth } = useResponsiveLayout();
  const [activeTab, setActiveTab] = useState<LibraryTab>('playlists');
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importProgress, setImportProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    setImportProgress(null);
    try {
      const result = await PlaylistImporter.import(url, (loaded, total) =>
        setImportProgress({ loaded, total })
      );
      savePlaylist(result.playlist);
      setImportModalVisible(false);
      setImportUrl('');
      Alert.alert(
        'Import complete',
        `${result.trackCount} track${result.trackCount !== 1 ? 's' : ''} imported` +
          (result.skipped ? `, ${result.skipped} skipped.` : '.')
      );
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.elevated }]}
            onPress={() => setImportModalVisible(true)}
          >
            <Ionicons name="cloud-download-outline" size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.elevated, marginLeft: 8 }]}
            onPress={() => router.push('/(drawer)/(tabs)/search')}
          >
            <Ionicons name="search" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
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
          // Re-mount when column count changes (e.g. orientation flip)
          key={gridColumns}
          numColumns={gridColumns}
          columnWrapperStyle={gridColumns > 1 ? styles.gridRow : undefined}
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
              style={[
                styles.playlistCell,
                {
                  width: gridCellWidth,
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setQueue(item.tracks)}
            >
              <Image
                source={{ uri: item.artworkUrl || item.tracks[0]?.artworkUrl || 'https://via.placeholder.com/150' }}
                style={[styles.playlistCellArt, { width: gridCellWidth - 24 }]}
              />
              <Text style={[styles.playlistTitle, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
                {item.title}
              </Text>
              <Text style={[styles.playlistMeta, { color: theme.secondaryText }]} numberOfLines={1} ellipsizeMode="tail">
                {item.tracks.length} tracks · {item.creatorName || 'Soniq'}
              </Text>
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
      {/* ── Import playlist modal ──────────────────────────────────── */}
      <Modal
        visible={importModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !importing && setImportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Import Playlist</Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText }]}>
              Paste a YouTube or Spotify playlist URL
            </Text>

            <TextInput
              style={[styles.urlInput, { backgroundColor: theme.elevated, color: theme.text, borderColor: theme.border }]}
              placeholder="https://youtube.com/playlist?list=..."
              placeholderTextColor={theme.secondaryText}
              value={importUrl}
              onChangeText={setImportUrl}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!importing}
            />

            {importProgress && (
              <Text style={[styles.progressText, { color: theme.secondaryText }]}>
                Resolving {importProgress.loaded} / {importProgress.total} tracks…
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.elevated }]}
                onPress={() => { setImportModalVisible(false); setImportUrl(''); }}
                disabled={importing}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.accent }]}
                onPress={handleImport}
                disabled={importing || !importUrl.trim()}
              >
                {importing ? (
                  <ActivityIndicator color="#08090B" size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#08090B' }]}>Import</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  // Adaptive playlist grid
  gridRow: {
    gap: 12,
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  playlistCell: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 0,
    overflow: 'hidden',
    padding: 12,
  },
  playlistCellArt: {
    aspectRatio: 1,
    backgroundColor: '#333',
    borderRadius: 8,
    marginBottom: 10,
  },
  playlistTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  playlistMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
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
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 20,
  },
  urlInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
