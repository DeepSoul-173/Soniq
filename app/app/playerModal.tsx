import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Share,
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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
import { SearchService } from '@/src/services/search/SearchService';
import { RecommendationEngine } from '@/src/services/recommendations/RecommendationEngine';

// ── Playback speed cycle ─────────────────────────────────────────────────────
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const AMBIENT_FALLBACK = '#0d0820';

// Track credit strings often bundle several names — e.g. "Sublahshini & Krishna Kanth"
// or "Anirudh Ravichandran, Sublahshini, Krishna Kanth". Split them so each credited
// artist gets their own "View Artist (Name)" entry in the song-options sheet.
const ARTIST_SEPARATOR_RE = /\s*(?:,|&|\/|\bx\b| feat\.?| ft\.?| featuring | vs\.?\s| and )\s*/gi;

function splitArtistNames(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of raw.split(ARTIST_SEPARATOR_RE)) {
    const name = part.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      names.push(name);
    }
  }
  return names;
}

function darkenColor(hex: string, factor = 0.35): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return AMBIENT_FALLBACK;
  const r = Math.round(parseInt(c.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(c.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(c.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

async function extractAmbientColor(imageUrl: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ImageColors = require('react-native-image-colors').default;
    const result = await ImageColors.getColors(imageUrl, {
      fallback: AMBIENT_FALLBACK, cache: true, key: imageUrl,
    });
    const raw: string =
      result?.vibrant ?? result?.dominant ?? result?.primary ?? result?.background ?? AMBIENT_FALLBACK;
    return darkenColor(raw, 0.35);
  } catch {
    return AMBIENT_FALLBACK;
  }
}

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
    playbackResolverState, playbackStatusMessage, playbackSourceLabel, playbackDiagnostics, sleepTimer,
    setIsPlaying, nextTrack, previousTrack, playTrack, requestSeek,
    removeFromQueue, setSleepTimer, setQueue, playbackRate, setPlaybackRate,
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
  const [showTrackActions, setShowTrackActions] = useState(false);
  const [showSleepPicker, setShowSleepPicker] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [speedIdx, setSpeedIdx]         = useState(() => {
    const i = SPEEDS.indexOf(playbackRate);
    return i >= 0 ? i : SPEEDS.indexOf(1.0);
  });
  const [bgColorA, setBgColorA]         = useState(AMBIENT_FALLBACK);
  const [bgColorB, setBgColorB]         = useState(AMBIENT_FALLBACK);
  const ambientFade                     = useSharedValue(0);

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

  const ambientStyleB = useAnimatedStyle(() => ({ opacity: ambientFade.value }));

  // Extract album-art color and cross-fade to new gradient on track change
  useEffect(() => {
    const art = currentTrack?.artwork || currentTrack?.artworkUrl;
    if (!art) return;
    let cancelled = false;
    extractAmbientColor(art).then((color) => {
      if (cancelled) return;
      setBgColorB(color);
      ambientFade.value = 0;
      ambientFade.value = withTiming(1, { duration: 1200 }, (finished) => {
        if (finished) {
          runOnJS(setBgColorA)(color);
          ambientFade.value = 0;
        }
      });
    });
    return () => { cancelled = true; };
  }, [currentTrack?.id]);

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

  // ── Slider reset ─────────────────────────────────────────────────────────
  // Snap straight to 0 the instant the active track ID changes — covers manual
  // next/previous, autoplay, and queue taps alike — instead of waiting for
  // (possibly stale) playbackPosition to catch up.
  useEffect(() => {
    setSliderValue(0);
    setIsSliding(false);
  }, [currentTrack?.id]);

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

  // Fixed medium square — never scales to full screen width, so the disk art
  // never stretches or dominates smaller layouts (cover-fit is applied inside AnimatedDiskArt).
  const artworkSize = useMemo(() => Math.min(width - 120, 280), [width]);

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
  const isPreviewOnly = playbackDiagnostics?.streamType === 'preview_only';

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
    // Routed through the store so UnifiedPlayer can apply it to the actual native
    // AudioPlayer (which lives there, not in this modal).
    setPlaybackRate(SPEEDS[next]);
  };

  const handleSleepSelect = (opt: typeof SLEEP_OPTIONS[0]) => {
    setSleepTimer({
      ...opt.timer,
      endTime: opt.timer.mode === 'timed' ? Date.now() + (opt.timer.endTime! - Date.now()) : null,
    });
    setShowSleepPicker(false);
  };

  // ── Song title / artist actions ──────────────────────────────────────────
  const trackArtist = currentTrack.artist || currentTrack.artistName || '';
  const trackAlbum = currentTrack.album || currentTrack.albumName || '';

  const handleViewAlbum = async () => {
    setShowTrackActions(false);
    if (!trackAlbum) return;
    const results = await SearchService.searchAll(`${trackAlbum} ${trackArtist}`).catch(() => []);
    if (results.length > 0) setQueue(results, 0);
  };

  const handleViewArtist = async (name?: string) => {
    setShowTrackActions(false);
    const target = name || trackArtist;
    if (!target) return;
    const results = await SearchService.searchAll(`${target} best songs`).catch(() => []);
    if (results.length > 0) setQueue(results, 0);
  };

  const handleStartRadio = async () => {
    setShowTrackActions(false);
    const radio = await RecommendationEngine.getRadioQueue(currentTrack, 20).catch(() => []);
    if (radio.length > 0) setQueue([currentTrack, ...radio], 0);
  };

  const handleAddToPlaylist = () => {
    setShowTrackActions(false);
    Alert.alert('Coming soon', 'Adding songs to playlists will be available in a future update.');
  };

  const handleShare = () => {
    setShowTrackActions(false);
    const message = trackArtist ? `${currentTrack.title} — ${trackArtist}` : currentTrack.title;
    Share.share({ message }).catch(() => undefined);
  };

  // One "View Artist (Name)" entry per credited artist when the track lists several
  // (e.g. singer + composer + featured artist) — falls back to a single generic
  // "View Artist" entry when there's just one name or none at all.
  const artistNames = splitArtistNames(trackArtist);
  const artistActions = artistNames.length > 1
    ? artistNames.map((name) => ({
        icon: 'person-outline' as const,
        label: `View Artist (${name})`,
        onPress: () => handleViewArtist(name),
        disabled: false,
      }))
    : [{ icon: 'person-outline' as const, label: 'View Artist', onPress: () => handleViewArtist(), disabled: !trackArtist }];

  const TRACK_ACTIONS = [
    { icon: 'disc-outline' as const, label: 'View Album', onPress: handleViewAlbum, disabled: !trackAlbum },
    ...artistActions,
    { icon: 'radio-outline' as const, label: 'Start Radio', onPress: handleStartRadio, disabled: false },
    { icon: 'list-outline' as const, label: 'Add to Playlist', onPress: handleAddToPlaylist, disabled: false },
    { icon: 'share-social-outline' as const, label: 'Share', onPress: handleShare, disabled: false },
  ];

  const upcoming = queue.slice(currentIndex + 1);

  return (
    <View style={styles.root}>
      {/* Ambient gradient — layer A (base) */}
      <LinearGradient
        colors={[bgColorA, '#000']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        pointerEvents="none"
      />
      {/* Ambient gradient — layer B (fades in over A on track change) */}
      <Animated.View style={[StyleSheet.absoluteFill, ambientStyleB]} pointerEvents="none">
        <LinearGradient
          colors={[bgColorB, '#000']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.55 }}
        />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
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
                renderItem={({ item, index }) => {
                  const dist = Math.abs(index - activeLyricIdx);
                  const opacity = index === activeLyricIdx ? 1
                    : dist === 1 ? 0.6
                    : dist === 2 ? 0.38
                    : 0.2;
                  const scale = index === activeLyricIdx ? 1.08 : 1;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.65}
                      onPress={() => requestSeek(item.timeSeconds)}
                      style={{ transform: [{ scale }] }}
                    >
                      <Text
                        style={[
                          styles.lyricLine,
                          { opacity },
                          index === activeLyricIdx && styles.lyricLineActive,
                        ]}
                      >
                        {item.text}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : (
              <ScrollView style={{ flex: 1 }}>
                <Text style={styles.lyricsPlain}>{lyrics.text || 'No lyrics found'}</Text>
              </ScrollView>
            )}
          </Animated.View>
        </View>

        {/* ── Track info — tap for album/artist/radio/share actions ─── */}
        <TouchableOpacity
          style={styles.infoBlock}
          activeOpacity={0.7}
          onPress={() => setShowTrackActions(true)}
          accessibilityRole="button"
          accessibilityLabel="Song options"
        >
          {/* Scrolling title */}
          <View style={styles.titleClip}>
            <Animated.Text style={[styles.title, marqueeStyle]} numberOfLines={1}>
              {currentTrack.title}
            </Animated.Text>
          </View>
          <Text style={styles.artist} numberOfLines={1}>
            {trackArtist}
          </Text>
        </TouchableOpacity>

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

          {/* Source indicator — tap to reveal temporary playback diagnostics */}
          <TouchableOpacity
            style={styles.sourceChip}
            activeOpacity={0.7}
            onPress={() => setShowDiagnostics((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Playback source diagnostics"
          >
            {(isBuffering || playbackResolverState === 'retrying') ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
            ) : (
              <Ionicons
                name={playbackResolverState === 'failed' ? 'alert-circle-outline' : isPreviewOnly ? 'time-outline' : 'radio-outline'}
                size={14}
                color={isPreviewOnly ? '#FFB020' : 'rgba(255,255,255,0.4)'}
              />
            )}
            <Text style={[styles.sourceText, isPreviewOnly && styles.sourceTextWarning]} numberOfLines={1}>
              {playbackStatusMessage || sourceBadge}
            </Text>
            <Ionicons
              name={showDiagnostics ? 'chevron-up' : 'chevron-down'}
              size={12}
              color="rgba(255,255,255,0.3)"
            />
          </TouchableOpacity>
        </View>

        {/* ── Playback diagnostics — temporary debug surface ───────── */}
        {showDiagnostics && (
          <View style={styles.diagnosticsPanel}>
            {isPreviewOnly && (
              <Text style={[styles.diagnosticsRow, styles.diagnosticsWarning]}>
                ⚠ Playing a 30-second preview — no full stream was available from any source.
              </Text>
            )}
            <Text style={styles.diagnosticsRow}>
              <Text style={styles.diagnosticsLabel}>Source: </Text>
              {playbackDiagnostics?.resolverName ?? '—'}
            </Text>
            <Text style={styles.diagnosticsRow}>
              <Text style={styles.diagnosticsLabel}>Type: </Text>
              {playbackDiagnostics?.streamType ?? '—'}
            </Text>
            <Text style={styles.diagnosticsRow}>
              <Text style={styles.diagnosticsLabel}>Domain: </Text>
              {playbackDiagnostics?.urlDomain ?? '—'}
            </Text>
            {playbackDiagnostics?.failureReason && (
              <Text style={[styles.diagnosticsRow, styles.diagnosticsWarning]}>
                <Text style={styles.diagnosticsLabel}>Failure: </Text>
                {playbackDiagnostics.failureReason}
              </Text>
            )}
            {!!playbackDiagnostics?.attemptedSources.length && (
              <Text style={styles.diagnosticsRow}>
                <Text style={styles.diagnosticsLabel}>Tried: </Text>
                {playbackDiagnostics.attemptedSources.join('  →  ')}
              </Text>
            )}
          </View>
        )}

        {/* ── Up Next — collapsible disclosure, never a half-visible sliver ─ */}
        <TouchableOpacity
          style={styles.upNextHandle}
          activeOpacity={0.7}
          onPress={() => setShowQueue((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showQueue ? 'Hide queue' : 'Show queue'}
        >
          <View style={styles.pill} />
          <View style={styles.upNextRow}>
            <Text style={styles.upNextLabel}>Up Next</Text>
            {upcoming.length > 0 && (
              <View style={styles.upNextCount}>
                <Text style={styles.upNextCountText}>{upcoming.length}</Text>
              </View>
            )}
            <Ionicons
              name={showQueue ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="rgba(255,255,255,0.4)"
            />
          </View>
        </TouchableOpacity>

        {/* ── Queue — only mounted while expanded, so it's always either fully
             visible or fully hidden, never an accidental partial peek ──── */}
        {showQueue && (
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
        )}
      </ScrollView>

      {/* ── Three-dot menu ──────────────────────────────────────── */}
      <Modal transparent animationType="fade" visible={showMenu} onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menuSheet}>
            {[
              {
                icon: 'moon-outline',
                label: sleepTimer ? `Sleep: ${sleepTimer.label}` : 'Sleep Timer',
                onPress: () => { setShowMenu(false); sleepTimer ? setSleepTimer(null) : setShowSleepPicker(true); },
                disabled: false,
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
                disabled: !currentTrack.pipedVideoId,
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={item.onPress}
                disabled={item.disabled}
              >
                <Ionicons name={item.icon as any} size={20} color={item.disabled ? 'rgba(255,255,255,0.25)' : '#fff'} />
                <Text style={[styles.menuLabel, item.disabled && styles.menuLabelDisabled]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Song title tap → album / artist / radio / playlist / share ──── */}
      <Modal transparent animationType="fade" visible={showTrackActions} onRequestClose={() => setShowTrackActions(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setShowTrackActions(false)}>
          <View style={styles.menuSheet}>
            {TRACK_ACTIONS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={item.onPress}
                disabled={item.disabled}
              >
                <Ionicons name={item.icon as any} size={20} color={item.disabled ? 'rgba(255,255,255,0.25)' : '#fff'} />
                <Text style={[styles.menuLabel, item.disabled && styles.menuLabelDisabled]}>{item.label}</Text>
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
  root: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { flexGrow: 1 },

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
  sourceChip: { alignItems: 'center', flexDirection: 'row', gap: 5, maxWidth: 220 },
  sourceText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  sourceTextWarning: { color: '#FFB020' },

  // Playback diagnostics (temporary debug surface — toggled from the source chip)
  diagnosticsPanel: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    gap: 4,
    marginHorizontal: 28,
    marginTop: -12,
    marginBottom: 20,
    padding: 14,
  },
  diagnosticsRow: { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 18 },
  diagnosticsLabel: { color: 'rgba(255,255,255,0.35)', fontWeight: '800' },
  diagnosticsWarning: { color: '#FFB020', fontWeight: '700' },

  // Up Next handle
  upNextHandle: { alignItems: 'center', paddingBottom: 10, paddingTop: 4 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    height: 4,
    marginBottom: 14,
    width: 40,
  },
  upNextRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  upNextLabel: { color: '#fff', fontSize: 17, fontWeight: '900' },
  upNextCount: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  upNextCountText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', textAlign: 'center' },

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
  menuLabelDisabled: { color: 'rgba(255,255,255,0.3)' },

  // Empty screen
  emptyScreen: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  closeBtn: { backgroundColor: '#fff', borderRadius: 8, marginTop: 18, paddingHorizontal: 20, paddingVertical: 12 },
  closeBtnText: { color: '#000', fontSize: 15, fontWeight: '900' },
});
