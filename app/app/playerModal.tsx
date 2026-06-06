import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrackItem } from '@/src/components/ui/TrackItem';
import { AnimatedDiskArt } from '@/src/components/ui/AnimatedDiskArt';
import { useLibraryStore } from '@/src/store/libraryStore';
import { usePlayerStore, SleepTimer } from '@/src/store/playerStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getTheme } from '@/src/theme/musicTheme';
import { DownloadManager } from '@/src/services/downloads/DownloadManager';
import { LyricsResult, LyricsService } from '@/src/services/lyrics/LyricsService';
import { HapticsService } from '@/src/services/HapticsService';

// ── Playback speed cycle ─────────────────────────────────────────────────────
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// ── Sleep timer options ──────────────────────────────────────────────────────
const SLEEP_OPTIONS: Array<{ label: string; timer: SleepTimer }> = [
  { label: '15 minutes', timer: { mode: 'timed', endTime: Date.now() + 15 * 60_000, label: '15 min' } },
  { label: '30 minutes', timer: { mode: 'timed', endTime: Date.now() + 30 * 60_000, label: '30 min' } },
  { label: '45 minutes', timer: { mode: 'timed', endTime: Date.now() + 45 * 60_000, label: '45 min' } },
  { label: '1 hour',    timer: { mode: 'timed', endTime: Date.now() + 60 * 60_000, label: '1 hr' } },
  { label: 'End of track', timer: { mode: 'end_of_track', endTime: null, label: 'End of track' } },
];

export default function PlayerModal() {
  const {
    queue, currentIndex, isPlaying, playbackPosition, duration, isBuffering,
    playbackResolverState, playbackStatusMessage, playbackSourceLabel, sleepTimer,
    setIsPlaying, nextTrack, previousTrack, playTrack, requestSeek,
    removeFromQueue, setSleepTimer, setPipMode,
  } = usePlayerStore();
  const { isLiked, toggleLikeTrack } = useLibraryStore();
  const { settings, updateSetting } = useSettingsStore();
  const theme = getTheme(settings);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const currentTrack = queue[currentIndex];

  const [isSliding, setIsSliding]       = useState(false);
  const [sliderValue, setSliderValue]   = useState(0);
  const [showLyrics, setShowLyrics]     = useState(false);
  const [lyrics, setLyrics]             = useState<LyricsResult | null>(null);
  const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
  const [showMenu, setShowMenu]         = useState(false);
  const [showSleepPicker, setShowSleepPicker] = useState(false);
  const [speedIdx, setSpeedIdx]         = useState(SPEEDS.indexOf(1.0));

  const lyricsListRef = useRef<FlatList>(null);

  // ── Card flip (artwork ↔ lyrics) ─────────────────────────────────────────
  const flipAngle = useSharedValue(0);

  const artworkFace = useAnimatedStyle(() => ({
    opacity: interpolate(flipAngle.value, [0, 89, 91, 180], [1, 1, 0, 0]),
    transform: [{ perspective: 1400 }, { rotateY: `${flipAngle.value}deg` }],
  }));

  const lyricsFace = useAnimatedStyle(() => ({
    opacity: interpolate(flipAngle.value, [0, 89, 91, 180], [0, 0, 1, 1]),
    transform: [{ perspective: 1400 }, { rotateY: `${flipAngle.value - 180}deg` }],
  }));

  const handleToggleLyrics = useCallback(() => {
    const next = !showLyrics;
    setShowLyrics(next);
    flipAngle.value = withTiming(next ? 180 : 0, {
      duration: 480,
      easing: Easing.inOut(Easing.cubic),
    });
    if (next && currentTrack && !lyrics) {
      LyricsService.getLyrics(currentTrack).then(setLyrics).catch(() => undefined);
    }
  }, [showLyrics, flipAngle, currentTrack, lyrics]);

  // ── Title marquee animation ──────────────────────────────────────────────
  const marqueeX = useSharedValue(0);
  const TITLE_SCROLL_DIST = 120;
  useEffect(() => {
    marqueeX.value = 0;
    marqueeX.value = withRepeat(
      withTiming(-TITLE_SCROLL_DIST, { duration: 6000, easing: Easing.linear }),
      -1,
      true
    );
  }, [currentTrack?.id, marqueeX]);
  const marqueeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: marqueeX.value }],
  }));

  // ── Slider sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSliding) setSliderValue(playbackPosition);
  }, [playbackPosition, isSliding]);

  // ── Active lyric line ────────────────────────────────────────────────────
  useEffect(() => {
    if (!lyrics?.synced || !lyrics.lines.length) return;
    const idx = LyricsService.currentLineIndex(lyrics.lines, playbackPosition);
    if (idx !== activeLyricIdx) {
      setActiveLyricIdx(idx);
      lyricsListRef.current?.scrollToIndex({
        index: Math.max(0, idx), animated: true, viewPosition: 0.35,
      });
    }
  }, [playbackPosition, lyrics, activeLyricIdx]);

  // Reset state when track changes
  useEffect(() => {
    setLyrics(null);
    setActiveLyricIdx(-1);
    if (showLyrics) {
      setShowLyrics(false);
      flipAngle.value = withTiming(0, { duration: 300 });
    }
  }, [currentTrack?.id]);

  const artworkSize = useMemo(() => width - 32, [width]);

  if (!currentTrack) {
    return (
      <View style={[styles.emptyScreen, { backgroundColor: '#000' }]}>
        <Text style={styles.emptyText}>No track playing</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const effectiveDuration = duration || currentTrack.duration || 0;
  const liked = isLiked(currentTrack.id);
  const sourceBadge =
    playbackSourceLabel ||
    currentTrack.sourceLabel ||
    (currentTrack.sourceType === 'proxy' ? 'Proxy'
      : currentTrack.sourceType === 'piped' ? 'Piped' : 'Legal');

  const fmt = (s: number) => {
    const v = Math.max(0, Math.floor(s || 0));
    const m = Math.floor(v / 60);
    const r = v % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  };

  const cycleRepeat = () => {
    const next = settings.defaultRepeatMode === 'off' ? 'queue'
      : settings.defaultRepeatMode === 'queue' ? 'track' : 'off';
    updateSetting('defaultRepeatMode', next);
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    // expo-audio 1.1.x: AudioPlayer.playbackRate is settable
    // Applied via native player ref — silently ignored if unavailable
  };

  const handleSleepSelect = (opt: typeof SLEEP_OPTIONS[0]) => {
    setSleepTimer({
      ...opt.timer,
      endTime: opt.timer.mode === 'timed' ? Date.now() + (opt.timer.endTime! - Date.now()) : null,
    });
    setShowSleepPicker(false);
  };

  const handleMinimize = () => {
    setPipMode(true);
    router.back();
  };

  const upcoming = queue.slice(currentIndex + 1);

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleToggleLyrics}
              accessibilityLabel="Toggle lyrics"
            >
              <Ionicons
                name="musical-notes-outline"
                size={22}
                color={showLyrics ? '#fff' : 'rgba(255,255,255,0.55)'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleMinimize}>
              <Ionicons name="share-outline" size={22} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={22} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Artwork / Lyrics flip ─────────────────────────────────── */}
        <View style={[styles.artworkWrapper, { width: artworkSize, height: artworkSize }]}>
          <Animated.View
            style={[StyleSheet.absoluteFill, artworkFace]}
            pointerEvents={showLyrics ? 'none' : 'auto'}
          >
            <AnimatedDiskArt
              size={artworkSize}
              isPlaying={isPlaying}
              artworkUri={currentTrack.artwork || currentTrack.artworkUrl || null}
              borderRadius={14}
            />
          </Animated.View>

          <Animated.View
            style={[StyleSheet.absoluteFill, styles.lyricsFace, lyricsFace]}
            pointerEvents={showLyrics ? 'auto' : 'none'}
          >
            <Text style={styles.lyricsHeading}>Lyrics</Text>
            {!lyrics ? (
              <ActivityIndicator color="#fff" style={{ marginVertical: 24 }} />
            ) : lyrics.synced && lyrics.lines.length > 0 ? (
              <FlatList
                ref={lyricsListRef}
                data={lyrics.lines}
                keyExtractor={(_, i) => String(i)}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1, width: '100%' }}
                onScrollToIndexFailed={() => undefined}
                renderItem={({ item, index }) => (
                  <Text
                    style={[
                      styles.lyricLine,
                      index === activeLyricIdx && styles.lyricLineActive,
                    ]}
                  >
                    {item.text}
                  </Text>
                )}
              />
            ) : (
              <ScrollView style={{ flex: 1 }}>
                <Text style={styles.lyricsPlain}>{lyrics.text || 'No lyrics found'}</Text>
              </ScrollView>
            )}
          </Animated.View>
        </View>

        {/* ── Track info ────────────────────────────────────────────── */}
        <View style={styles.infoBlock}>
          {/* Scrolling title */}
          <View style={styles.titleClip}>
            <Animated.Text style={[styles.title, marqueeStyle]} numberOfLines={1}>
              {currentTrack.title}
            </Animated.Text>
          </View>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist || currentTrack.artistName}
          </Text>
        </View>

        {/* ── Speed + Progress ─────────────────────────────────────── */}
        <View style={styles.progressBlock}>
          <TouchableOpacity style={styles.speedBtn} onPress={cycleSpeed}>
            <Text style={styles.speedText}>{SPEEDS[speedIdx].toFixed(1)}x</Text>
          </TouchableOpacity>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={Math.max(effectiveDuration, 1)}
            value={Math.min(sliderValue, Math.max(effectiveDuration, 1))}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="rgba(255,255,255,0.25)"
            thumbTintColor="#fff"
            onSlidingStart={() => setIsSliding(true)}
            onValueChange={setSliderValue}
            onSlidingComplete={(v) => { requestSeek(v); setIsSliding(false); }}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{fmt(sliderValue)}</Text>
            <Text style={styles.timeText}>{fmt(effectiveDuration)}</Text>
          </View>
        </View>

        {/* ── Controls ─────────────────────────────────────────────── */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.sideCtrl}
            onPress={() => updateSetting('defaultShuffle', !settings.defaultShuffle)}
          >
            <Ionicons
              name="shuffle"
              size={24}
              color={settings.defaultShuffle ? '#fff' : 'rgba(255,255,255,0.4)'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipCtrl} onPress={previousTrack}>
            <Ionicons name="play-skip-back" size={36} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.playBtn} onPress={() => setIsPlaying(!isPlaying)}>
            {isBuffering || playbackResolverState === 'buffering' || playbackResolverState === 'validating'
              ? <ActivityIndicator size="large" color="#000" />
              : <Ionicons name={isPlaying ? 'pause' : 'play'} size={34} color="#000" />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipCtrl} onPress={nextTrack}>
            <Ionicons name="play-skip-forward" size={36} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.sideCtrl} onPress={cycleRepeat}>
            <Ionicons
              name={settings.defaultRepeatMode === 'track' ? 'repeat-outline' : 'repeat'}
              size={24}
              color={settings.defaultRepeatMode !== 'off' ? '#fff' : 'rgba(255,255,255,0.4)'}
            />
          </TouchableOpacity>
        </View>

        {/* ── Heart + Source row ───────────────────────────────────── */}
        <View style={styles.heartRow}>
          <TouchableOpacity
            onPress={() => { HapticsService.medium(); toggleLikeTrack(currentTrack); }}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={28}
              color={liked ? '#FF3B30' : '#fff'}
            />
          </TouchableOpacity>

          {/* Source indicator — subtle, right side */}
          <View style={styles.sourceChip}>
            {(isBuffering || playbackResolverState === 'retrying') ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
            ) : (
              <Ionicons
                name={playbackResolverState === 'failed' ? 'alert-circle-outline' : 'radio-outline'}
                size={14}
                color="rgba(255,255,255,0.4)"
              />
            )}
            <Text style={styles.sourceText} numberOfLines={1}>
              {playbackStatusMessage || sourceBadge}
            </Text>
          </View>
        </View>

        {/* ── Up Next drag handle ──────────────────────────────────── */}
        <View style={styles.upNextHandle}>
          <View style={styles.pill} />
          <Text style={styles.upNextLabel}>Up Next</Text>
        </View>

        {/* ── Queue ────────────────────────────────────────────────── */}
        <View style={styles.queueSection}>
          {upcoming.length > 0 ? (
            upcoming.map((track, index) => {
              const absIdx = currentIndex + 1 + index;
              return (
                <View key={`${track.id}-${absIdx}`} style={styles.queueRow}>
                  <View style={styles.queueItem}>
                    {track.queueReason && (
                      <Text style={styles.queueReason}>{track.queueReason}</Text>
                    )}
                    <TrackItem track={track} onPress={() => playTrack(absIdx)} />
                  </View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeFromQueue(absIdx)}>
                    <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyQueue}>
              <Ionicons name="sparkles-outline" size={22} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyQueueText}>Queue is clear — autoplay will fill it</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Three-dot menu ──────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={showMenu} onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menuSheet}>
            {[
              { icon: 'disc-outline', label: 'View Album', onPress: () => setShowMenu(false) },
              { icon: 'list-outline', label: 'Add to Playlist', onPress: () => setShowMenu(false) },
              {
                icon: 'moon-outline',
                label: sleepTimer ? `Sleep: ${sleepTimer.label}` : 'Sleep Timer',
                onPress: () => { setShowMenu(false); sleepTimer ? setSleepTimer(null) : setShowSleepPicker(true); },
              },
              {
                icon: 'logo-youtube',
                label: 'Watch on YouTube',
                onPress: () => {
                  setShowMenu(false);
                  const vid = currentTrack.pipedVideoId;
                  if (vid) import('react-native').then(({ Linking }) =>
                    Linking.openURL(`https://www.youtube.com/watch?v=${vid}`)
                  );
                },
              },
            ].map((item) => (
              <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress}>
                <Ionicons name={item.icon as any} size={20} color="#fff" />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Sleep timer picker ───────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={showSleepPicker} onRequestClose={() => setShowSleepPicker(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setShowSleepPicker(false)}>
          <View style={styles.menuSheet}>
            {SLEEP_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.label} style={styles.menuItem} onPress={() => handleSleepSelect(opt)}>
                <Ionicons name="moon-outline" size={20} color="#fff" />
                <Text style={styles.menuLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  // Header
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  iconBtn: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerActions: { alignItems: 'center', flexDirection: 'row' },

  // Artwork flip container
  artworkWrapper: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 26,
  },
  lyricsFace: {
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    overflow: 'hidden',
    padding: 22,
  },
  lyricsHeading: { color: '#fff', fontSize: 17, fontWeight: '900', marginBottom: 12 },
  lyricLine: { color: 'rgba(255,255,255,0.45)', fontSize: 15, lineHeight: 26, paddingVertical: 4, textAlign: 'center' },
  lyricLineActive: { color: '#fff', fontSize: 18, fontWeight: '900' },
  lyricsPlain: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 22 },

  // Track info
  infoBlock: { paddingHorizontal: 28, marginBottom: 18 },
  titleClip: { overflow: 'hidden' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 6 },
  artist: { color: 'rgba(255,255,255,0.55)', fontSize: 16, fontWeight: '600' },

  // Progress
  progressBlock: { paddingHorizontal: 22, marginBottom: 10 },
  speedBtn: { alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 4, marginBottom: 2 },
  speedText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '700' },
  slider: { height: 36, width: '100%' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  timeText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '700' },

  // Controls
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingHorizontal: 22,
  },
  sideCtrl: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  skipCtrl: { alignItems: 'center', height: 54, justifyContent: 'center', width: 54 },
  playBtn: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 40,
    elevation: 8,
    height: 80,
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    width: 80,
  },

  // Heart + source
  heartRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    marginBottom: 24,
  },
  sourceChip: { alignItems: 'center', flexDirection: 'row', gap: 5, maxWidth: 200 },
  sourceText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', flexShrink: 1 },

  // Up Next handle
  upNextHandle: { alignItems: 'center', paddingBottom: 10 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    height: 4,
    marginBottom: 14,
    width: 40,
  },
  upNextLabel: { color: '#fff', fontSize: 17, fontWeight: '900' },

  // Queue
  queueSection: { paddingBottom: 16 },
  queueRow: { alignItems: 'center', flexDirection: 'row', paddingRight: 8 },
  queueItem: { flex: 1 },
  queueReason: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 20,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  removeBtn: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  emptyQueue: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyQueueText: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },

  // Three-dot menu
  menuBackdrop: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingRight: 16,
  },
  menuSheet: {
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    minWidth: 220,
    overflow: 'hidden',
  },
  menuItem: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Empty screen
  emptyScreen: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  closeBtn: { backgroundColor: '#fff', borderRadius: 8, marginTop: 18, paddingHorizontal: 20, paddingVertical: 12 },
  closeBtnText: { color: '#000', fontSize: 15, fontWeight: '900' },
});
