import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getPlayerDockHeight, getTheme } from '@/src/theme/musicTheme';
import {
  APP_ICONS,
  AppIconId,
  AppIconMeta,
  AppIconService,
} from '@/src/services/AppIconService';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

export default function AppIconScreen() {
  const router = useRouter();
  const { settings } = useSettingsStore();
  const theme = getTheme(settings);
  const insets = useSafeAreaInsets();
  const { gridColumns, gridCellWidth, screenWidth } = useResponsiveLayout();

  const [selected, setSelected] = useState<AppIconId>(AppIconService.currentIconId);
  const [playCount, setPlayCount] = useState(AppIconService.totalPlayCount);
  const [loading, setLoading] = useState<AppIconId | null>(null);

  // Refresh play count on focus
  useEffect(() => {
    setPlayCount(AppIconService.totalPlayCount);
    setSelected(AppIconService.currentIconId);
  }, []);

  const handleSelect = async (icon: AppIconMeta) => {
    if (!AppIconService.isIconUnlocked(icon)) {
      const remaining = icon.playsRequired - playCount;
      Alert.alert(
        'Icon locked',
        `Listen to ${remaining} more song${remaining !== 1 ? 's' : ''} to unlock "${icon.label}".`
      );
      return;
    }

    setLoading(icon.id);
    const result = await AppIconService.setIcon(icon.id);
    setLoading(null);

    if (result.success) {
      setSelected(icon.id);
    } else if (result.message) {
      // On Expo Go / Android dev builds show an info alert (not an error)
      setSelected(icon.id); // persist preference even if native call fails
      Alert.alert('App Icon', result.message);
    }
  };

  const renderIcon = ({ item: icon }: { item: AppIconMeta }) => {
    const isSelected = selected === icon.id;
    const unlocked = AppIconService.isIconUnlocked(icon);
    const isLoading = loading === icon.id;
    const cellSize = gridCellWidth;

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        style={[
          styles.iconTile,
          {
            width: cellSize,
            backgroundColor: theme.surface,
            borderColor: isSelected ? theme.accent : theme.border,
            borderWidth: isSelected ? 2 : 1,
            opacity: unlocked ? 1 : 0.55,
          },
        ]}
        onPress={() => handleSelect(icon)}
      >
        {/* Preview square */}
        <View
          style={[
            styles.previewBox,
            { backgroundColor: icon.previewBg, width: cellSize - 24, height: cellSize - 24 },
          ]}
        >
          {isLoading ? (
            <Ionicons name="reload-circle" size={40} color={icon.previewAccent} />
          ) : (
            <Ionicons name="musical-notes" size={40} color={icon.previewAccent} />
          )}
          {!unlocked && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={22} color="#fff" />
            </View>
          )}
          {isSelected && (
            <View style={[styles.selectedBadge, { backgroundColor: theme.accent }]}>
              <Ionicons name="checkmark" size={13} color="#08090B" />
            </View>
          )}
        </View>

        {/* Label row */}
        <Text
          style={[styles.iconLabel, { color: theme.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {icon.label}
        </Text>
        <Text
          style={[styles.iconDesc, { color: theme.secondaryText }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {icon.description}
        </Text>

        {!unlocked && (
          <Text style={[styles.lockHint, { color: theme.accent }]} numberOfLines={1}>
            {icon.playsRequired - playCount} plays to unlock
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const platformNote =
    Platform.OS === 'android'
      ? 'Android icon changes require a custom dev build — your preference is saved.'
      : Platform.OS === 'ios'
        ? 'Changes take effect instantly on development and production builds.'
        : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>App Icon</Text>
          <Text style={[styles.headerSub, { color: theme.secondaryText }]} numberOfLines={1}>
            Choose how Soniq looks on your home screen
          </Text>
        </View>
      </View>

      {/* Play count progress bar */}
      <View style={[styles.streakCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.streakRow}>
          <Ionicons name="flame" size={18} color={theme.accent} />
          <Text style={[styles.streakLabel, { color: theme.text }]}>
            {playCount} / 100 songs played
          </Text>
          {playCount >= 100 && (
            <View style={[styles.goldBadge, { backgroundColor: '#FFD700' }]}>
              <Text style={styles.goldBadgeText}>Gold unlocked!</Text>
            </View>
          )}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.elevated }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: playCount >= 100 ? '#FFD700' : theme.accent,
                width: `${Math.min((playCount / 100) * 100, 100)}%`,
              },
            ]}
          />
        </View>
      </View>

      {platformNote && (
        <View style={[styles.noteBar, { backgroundColor: theme.elevated }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.secondaryText} />
          <Text style={[styles.noteText, { color: theme.secondaryText }]} numberOfLines={2}>
            {platformNote}
          </Text>
        </View>
      )}

      {/* Icon grid */}
      <FlatList
        data={APP_ICONS}
        keyExtractor={(item) => item.id}
        numColumns={gridColumns}
        key={gridColumns}
        renderItem={renderIcon}
        contentContainerStyle={[
          styles.grid,
          { paddingBottom: getPlayerDockHeight(insets.bottom) + 16 },
        ]}
        columnWrapperStyle={gridColumns > 1 ? styles.row : undefined}
      />
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
    paddingTop: 16,
  },
  backBtn: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
    width: 40,
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  headerSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  streakCard: {
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 14,
  },
  streakRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  streakLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  goldBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  goldBadgeText: {
    color: '#08090B',
    fontSize: 11,
    fontWeight: '800',
  },
  progressTrack: {
    borderRadius: 4,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    borderRadius: 4,
    height: '100%',
  },
  noteBar: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginLeft: 7,
  },
  grid: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  row: {
    gap: 12,
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  iconTile: {
    borderRadius: 12,
    marginBottom: 0,
    overflow: 'hidden',
    padding: 12,
  },
  previewBox: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
  },
  selectedBadge: {
    alignItems: 'center',
    borderRadius: 12,
    bottom: 8,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    width: 24,
  },
  iconLabel: {
    fontSize: 14,
    fontWeight: '900',
  },
  iconDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  lockHint: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
});
