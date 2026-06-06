import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { usePlayerStore } from '@/src/store/playerStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useLibraryStore } from '@/src/store/libraryStore';
import { Track } from '@/src/models/types';
import { RecommendationEngine } from '@/src/services/recommendations/RecommendationEngine';
import { SourceResolver } from '@/src/services/playback/SourceResolver';
import { SponsorBlock } from '@/src/services/playback/SponsorBlock';
import { AppIconService } from '@/src/services/AppIconService';
import { getLocalJSON, setLocalJSON } from '@/src/store/mmkvStorage';

const STREAM_CACHE_KEY = 'soniq-playback-source-cache';

const PREFETCH_THRESHOLD_SECONDS = 15;

export function UnifiedPlayer() {
  const {
    queue, currentIndex, isPlaying, setIsPlaying,
    setPlaybackState, nextTrack, setActiveEngine, setIsBuffering, seekRequest,
    updateQueueTrack, setPlaybackResolverState, sleepTimer, setSleepTimer,
  } = usePlayerStore();

  const { settings } = useSettingsStore();
  const { addRecentlyPlayed } = useLibraryStore();
  const currentTrack: Track | undefined = queue[currentIndex];
  const nextTrack_: Track | undefined = queue[currentIndex + 1];

  const isDirect = currentTrack && ['piped', 'proxy', 'legal', 'downloaded', 'jamendo', 'internet_archive'].includes(currentTrack.sourceType);
  const hasFreshSource = Boolean(
    currentTrack?.streamUrl &&
    (currentTrack.sourceType === 'downloaded' ||
      (currentTrack.sourceValidatedAt && Date.now() - currentTrack.sourceValidatedAt < 20 * 60 * 1000))
  );

  const source = (isDirect && hasFreshSource && currentTrack?.streamUrl) ? currentTrack.streamUrl : null;
  const nativePlayer = useAudioPlayer(source, { updateInterval: 500 });
  const nativeStatus = useAudioPlayerStatus(nativePlayer);

  const handledEndId = useRef<number | null>(null);
  const handledSeekId = useRef<number | null>(null);
  const lastTrackedId = useRef<string | null>(null);
  const resolvingTrackId = useRef<string | null>(null);
  // Tracks play intent so we can re-issue play() once the source is loaded.
  const pendingPlayRef = useRef(false);
  const prefetchedTrackId = useRef<string | null>(null);
  const sponsorSegmentsRef = useRef<Array<[number, number]>>([]);
  const handledSponsorRef = useRef<Set<number>>(new Set());

  // ── Audio mode (ducking + background) ───────────────────────────────────
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      // Always play in background so the system notification appears.
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    }).catch(() => undefined);
  }, []);

  // ── Notification / lockscreen metadata ───────────────────────────────────
  useEffect(() => {
    if (!currentTrack || !nativePlayer) return;
    try {
      const p = nativePlayer as any;
      if (typeof p.setNotificationOptions === 'function') {
        p.setNotificationOptions({
          title: currentTrack.title || 'Soniq',
          artist: currentTrack.artist || currentTrack.artistName || '',
          album: currentTrack.album || currentTrack.albumName || '',
          artworkUrl: currentTrack.artwork || currentTrack.artworkUrl || '',
        });
      }
    } catch { /* expo-audio notification API may vary */ }
  }, [currentTrack?.id, nativePlayer]);

  // ── Source resolution ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack || hasFreshSource) return;
    if (resolvingTrackId.current === currentTrack.id) return;

    let cancelled = false;
    resolvingTrackId.current = currentTrack.id;
    setIsBuffering(true);

    SourceResolver.resolve(currentTrack, {
      onState: (state, message) => {
        if (!cancelled) setPlaybackResolverState(state, message);
      },
    })
      .then((resolved) => {
        if (!cancelled) {
          updateQueueTrack(currentIndex, resolved.track);
          setPlaybackResolverState('ready', `Playing from ${resolved.sourceLabel}`, resolved.sourceLabel);
        }
      })
      .catch((error) => {
        console.error('Failed to prepare stream', error);
        if (!cancelled) {
          setPlaybackResolverState('failed', 'Playback failed. No alternate source worked.');
          setIsPlaying(false);
        }
      })
      .finally(() => {
        if (!cancelled) setIsBuffering(false);
        if (resolvingTrackId.current === currentTrack.id) resolvingTrackId.current = null;
      });

    return () => { cancelled = true; };
  }, [currentIndex, currentTrack, hasFreshSource, setIsBuffering, setIsPlaying, setPlaybackResolverState, updateQueueTrack]);

  // ── Play / pause control ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) {
      pendingPlayRef.current = false;
      nativePlayer?.pause();
      setActiveEngine(null);
      setPlaybackResolverState('idle', '', null);
      return;
    }

    if (isDirect) {
      setActiveEngine('native');
      if (isPlaying) {
        pendingPlayRef.current = true;
        nativePlayer?.play();
      } else {
        pendingPlayRef.current = false;
        nativePlayer?.pause();
      }
    }
  }, [currentTrack, isPlaying, isDirect, nativePlayer, setActiveEngine]);

  // Re-issue play() once expo-audio finishes loading the source (belt-and-suspenders
  // for the timing race between source assignment and the play() call above).
  useEffect(() => {
    if (!isDirect || !isPlaying || !hasFreshSource || !currentTrack) return;
    if (nativeStatus.isLoaded && pendingPlayRef.current) {
      nativePlayer?.play();
    }
  }, [currentTrack?.id, isDirect, isPlaying, hasFreshSource, nativeStatus.isLoaded, nativePlayer]);

  // ── Recently played tracking ─────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack || currentTrack.id === lastTrackedId.current) return;
    lastTrackedId.current = currentTrack.id;
    addRecentlyPlayed(currentTrack);
  }, [addRecentlyPlayed, currentTrack]);

  // ── Playback position + status sync ─────────────────────────────────────
  useEffect(() => {
    if (!isDirect || !nativeStatus) return;

    const fallbackDuration = currentTrack?.duration || 0;
    setPlaybackState(nativeStatus.currentTime || 0, nativeStatus.duration || fallbackDuration);
    setIsBuffering(Boolean(nativeStatus.isBuffering));
    if (nativeStatus.isBuffering) {
      setPlaybackResolverState('buffering', 'Buffering audio');
    } else if (nativeStatus.isLoaded && currentTrack?.streamUrl) {
      setPlaybackResolverState('ready', currentTrack.sourceLabel ? `via ${currentTrack.sourceLabel}` : 'Playing');
    }

    // If the player reports an error, bust the cached URL and force re-resolution.
    const playerError = (nativeStatus as any).error;
    if (playerError && currentTrack && resolvingTrackId.current !== currentTrack.id) {
      const cache = getLocalJSON<Record<string, unknown>>(STREAM_CACHE_KEY, {});
      if (cache[currentTrack.id]) {
        delete cache[currentTrack.id];
        setLocalJSON(STREAM_CACHE_KEY, cache);
      }
      updateQueueTrack(currentIndex, { ...currentTrack, streamUrl: undefined, sourceValidatedAt: undefined });
    }

    if (nativeStatus.didJustFinish && handledEndId.current !== nativeStatus.id) {
      handledEndId.current = nativeStatus.id;
      handleTrackEnd();
    }
  }, [currentTrack?.duration, currentTrack?.sourceLabel, currentTrack?.streamUrl, isDirect, nativeStatus, setIsBuffering, setPlaybackResolverState, setPlaybackState]);

  // ── Seek ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!seekRequest || handledSeekId.current === seekRequest.requestId) return;
    handledSeekId.current = seekRequest.requestId;
    if (isDirect) nativePlayer?.seekTo(seekRequest.position);
  }, [isDirect, nativePlayer, seekRequest]);

  // ── Sleep timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sleepTimer || !isPlaying) return;

    if (sleepTimer.mode === 'timed' && sleepTimer.endTime) {
      const remaining = sleepTimer.endTime - Date.now();
      if (remaining <= 0) {
        setIsPlaying(false);
        setSleepTimer(null);
        return;
      }
      const id = setTimeout(() => {
        setIsPlaying(false);
        setSleepTimer(null);
      }, remaining);
      return () => clearTimeout(id);
    }
    // 'end_of_track' is handled in handleTrackEnd()
  }, [sleepTimer, isPlaying, setIsPlaying, setSleepTimer]);

  // ── Next-track prefetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!nextTrack_) return;
    if (prefetchedTrackId.current === nextTrack_.id) return;
    if (!nativeStatus.duration || !nativeStatus.currentTime) return;

    const remaining = nativeStatus.duration - nativeStatus.currentTime;
    if (remaining <= PREFETCH_THRESHOLD_SECONDS && remaining > 0) {
      prefetchedTrackId.current = nextTrack_.id;
      // Silently resolve the source for the next track so it is warm in cache.
      const nextHasFresh = Boolean(
        nextTrack_.streamUrl &&
        (nextTrack_.sourceType === 'downloaded' ||
          (nextTrack_.sourceValidatedAt && Date.now() - nextTrack_.sourceValidatedAt < 20 * 60 * 1000))
      );
      if (!nextHasFresh) {
        SourceResolver.resolve(nextTrack_).then((resolved) => {
          const nextIdx = currentIndex + 1;
          if (usePlayerStore.getState().queue[nextIdx]?.id === resolved.track.id) {
            usePlayerStore.getState().updateQueueTrack(nextIdx, resolved.track);
          }
        }).catch(() => undefined);
      }
    }
  }, [nativeStatus.currentTime, nativeStatus.duration, nextTrack_, currentIndex]);

  // Reset prefetch ref when track changes so we prefetch for the new "next"
  useEffect(() => {
    prefetchedTrackId.current = null;
    sponsorSegmentsRef.current = [];
    handledSponsorRef.current = new Set();
  }, [currentIndex]);

  // ── SponsorBlock – load segments for current Piped track ─────────────────
  useEffect(() => {
    if (!currentTrack?.pipedVideoId) return;
    SponsorBlock.getSegments(currentTrack.pipedVideoId)
      .then((segments: Array<[number, number]>) => { sponsorSegmentsRef.current = segments; })
      .catch(() => undefined);
  }, [currentTrack?.pipedVideoId]);

  // ── SponsorBlock – auto-skip when entering a segment ────────────────────
  useEffect(() => {
    if (!isDirect || !nativeStatus.isLoaded) return;
    const pos = nativeStatus.currentTime || 0;

    for (const [start, end] of sponsorSegmentsRef.current) {
      if (pos >= start && pos < end && !handledSponsorRef.current.has(start)) {
        handledSponsorRef.current.add(start);
        nativePlayer?.seekTo(end);
        break;
      }
    }
  }, [nativeStatus.currentTime, isDirect, nativeStatus.isLoaded, nativePlayer]);

  // ── Track end ────────────────────────────────────────────────────────────
  const handleTrackEnd = async () => {
    // Increment streak counter; auto-switches to Gold icon at 100 plays.
    AppIconService.recordPlay().catch(() => undefined);

    // Sleep timer: end of track mode
    if (sleepTimer?.mode === 'end_of_track') {
      setIsPlaying(false);
      setSleepTimer(null);
      return;
    }

    if (settings.defaultRepeatMode === 'track') {
      if (isDirect) {
        nativePlayer?.seekTo(0);
        nativePlayer?.play();
      }
      return;
    }

    if (currentIndex === queue.length - 1 && settings.autoAddRecommendations) {
      // Fill queue with a full radio batch (5 tracks) rather than one at a time.
      const recs = await RecommendationEngine.getRadioQueue(currentTrack, 5).catch(() => []);
      for (const rec of recs) usePlayerStore.getState().addToQueue(rec);
    }

    nextTrack();
  };

  return <View style={styles.container} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  container: { position: 'absolute', width: 0, height: 0, opacity: 0 },
});
