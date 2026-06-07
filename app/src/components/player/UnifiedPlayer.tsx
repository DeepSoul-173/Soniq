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
import { dbRecordListeningHistory } from '@/src/services/database/LibraryDatabase';

const STREAM_CACHE_KEY = 'soniq-playback-source-cache';

const PREFETCH_THRESHOLD_SECONDS = 15;

/** Pulls the hostname out of a stream URL for diagnostics — avoids relying on the global `URL`. */
function urlDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^https?:\/\/([^/]+)/i);
  return match ? match[1] : null;
}

export function UnifiedPlayer() {
  const {
    queue, currentIndex, isPlaying, setIsPlaying,
    setPlaybackState, nextTrack, setActiveEngine, setIsBuffering, seekRequest,
    updateQueueTrack, setPlaybackResolverState, setPlaybackDiagnostics, sleepTimer, setSleepTimer,
    playbackRate,
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
  // While a seek is in flight, the native player briefly keeps reporting the OLD
  // currentTime (often ~0) before it jumps to the target — publishing that would
  // make the slider bounce back to zero. We hold the UI at the target until the
  // native position actually lands near it.
  const seekTargetRef = useRef<number | null>(null);
  const lastTrackedId = useRef<string | null>(null);
  const resolvingTrackId = useRef<string | null>(null);
  // Tracks play intent so we can re-issue play() once the source is loaded.
  const pendingPlayRef = useRef(false);
  const prefetchedTrackId = useRef<string | null>(null);
  const sponsorSegmentsRef = useRef<Array<[number, number]>>([]);
  const handledSponsorRef = useRef<Set<number>>(new Set());

  // ── Audio mode (ducking + background) ───────────────────────────────────
  // Honors the "Play in background" setting — when off, audio stops when the app
  // is backgrounded instead of continuing with a notification.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: settings.playInBackground,
      interruptionMode: 'duckOthers',
    }).catch(() => undefined);
  }, [settings.playInBackground]);

  // ── Notification / lock-screen media session ─────────────────────────────
  // expo-audio 1.1's real API is `setActiveForLockScreen` / `updateLockScreenMetadata`
  // (backed by a native MediaSessionService + notification on Android, MPNowPlayingInfoCenter
  // on iOS) — NOT `setNotificationOptions`, which doesn't exist on AudioPlayer and silently
  // no-ops.
  //
  // CRITICAL: `useAudioPlayer` builds a *new* native player every time the source URL
  // changes, and our source briefly goes null while each track resolves. Activating the
  // lock screen on a not-yet-loaded player binds the Android MediaSession to an empty,
  // non-playing player — and the player it gets released a moment later, which clears the
  // session. That race is why the notification appeared only sometimes. We now wait for
  // `nativeStatus.isLoaded` so we always bind to the real, playing player.
  useEffect(() => {
    if (!currentTrack || !isDirect || !nativePlayer || !nativeStatus.isLoaded) return;
    const metadata = {
      title: currentTrack.title || 'Soniq',
      artist: currentTrack.artist || currentTrack.artistName || '',
      albumTitle: currentTrack.album || currentTrack.albumName || '',
      artworkUrl: currentTrack.artwork || currentTrack.artworkUrl || '',
    };
    try {
      nativePlayer.setActiveForLockScreen(true, metadata, { showSeekForward: true, showSeekBackward: true });
    } catch { /* unsupported on this platform/build — media session simply won't appear */ }
  }, [currentTrack?.id, currentTrack?.title, isDirect, nativePlayer, nativeStatus.isLoaded]);

  // Keep lock-screen metadata fresh if the track's artwork/title resolve after the fact
  // (e.g. SourceResolver fills in artwork once the stream is ready).
  useEffect(() => {
    if (!currentTrack || !isDirect || !nativePlayer) return;
    try {
      nativePlayer.updateLockScreenMetadata({
        title: currentTrack.title || 'Soniq',
        artist: currentTrack.artist || currentTrack.artistName || '',
        albumTitle: currentTrack.album || currentTrack.albumName || '',
        artworkUrl: currentTrack.artwork || currentTrack.artworkUrl || '',
      });
    } catch { /* no-op if this player isn't the active lock-screen controller yet */ }
  }, [currentTrack?.artwork, currentTrack?.artworkUrl, currentTrack?.id, isDirect, nativePlayer]);

  // Release lock-screen controls when playback ends entirely.
  useEffect(() => {
    if (currentTrack || !nativePlayer) return;
    try { nativePlayer.clearLockScreenControls(); } catch { /* no-op */ }
  }, [currentTrack, nativePlayer]);

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
          const isPreview = resolved.streamType === 'preview_only';
          setPlaybackResolverState(
            'ready',
            isPreview ? `Preview only — playing 30s clip from ${resolved.sourceLabel}` : `Playing from ${resolved.sourceLabel}`,
            resolved.sourceLabel
          );
          setPlaybackDiagnostics({
            resolverName: resolved.resolverName,
            sourceLabel: resolved.sourceLabel,
            streamType: resolved.streamType,
            urlDomain: urlDomain(resolved.url),
            failureReason: null,
            attemptedSources: resolved.attemptedSources,
          });
        }
      })
      .catch((error) => {
        console.error('Failed to prepare stream', error);
        if (!cancelled) {
          setPlaybackResolverState('failed', 'Playback failed. No alternate source worked.');
          setPlaybackDiagnostics({
            resolverName: null,
            sourceLabel: null,
            streamType: 'invalid',
            urlDomain: null,
            failureReason: error instanceof Error ? error.message : 'No playable source found',
            attemptedSources: [],
          });
          setIsPlaying(false);
        }
      })
      .finally(() => {
        if (!cancelled) setIsBuffering(false);
        if (resolvingTrackId.current === currentTrack.id) resolvingTrackId.current = null;
      });

    return () => { cancelled = true; };
  }, [currentIndex, currentTrack, hasFreshSource, setIsBuffering, setIsPlaying, setPlaybackDiagnostics, setPlaybackResolverState, updateQueueTrack]);

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
  // Skipped entirely during a Private Session so nothing is recorded.
  useEffect(() => {
    if (settings.privateSession) return;
    if (!currentTrack || currentTrack.id === lastTrackedId.current) return;
    lastTrackedId.current = currentTrack.id;
    addRecentlyPlayed(currentTrack);
  }, [addRecentlyPlayed, currentTrack, settings.privateSession]);

  // ── Playback position + status sync ─────────────────────────────────────
  useEffect(() => {
    if (!isDirect || !nativeStatus) return;

    const fallbackDuration = currentTrack?.duration || 0;
    // Only trust currentTime once the player has actually loaded the *current*
    // source — otherwise we'd briefly re-publish the outgoing track's elapsed
    // time during the swap window, making the slider appear not to reset.
    const rawPosition = nativeStatus.isLoaded ? (nativeStatus.currentTime || 0) : 0;
    let position = rawPosition;
    if (seekTargetRef.current !== null) {
      if (Math.abs(rawPosition - seekTargetRef.current) <= 0.75) {
        seekTargetRef.current = null; // seek landed — resume trusting the player
      } else {
        position = seekTargetRef.current; // hold at target, ignore the stale value
      }
    }
    setPlaybackState(position, nativeStatus.duration || fallbackDuration);
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
      handleTrackEnd(nativeStatus.currentTime || 0);
    }
  }, [currentTrack?.duration, currentTrack?.sourceLabel, currentTrack?.streamUrl, isDirect, nativeStatus, setIsBuffering, setPlaybackResolverState, setPlaybackState]);

  // ── Seek ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!seekRequest || handledSeekId.current === seekRequest.requestId) return;
    handledSeekId.current = seekRequest.requestId;
    if (isDirect) {
      seekTargetRef.current = seekRequest.position;
      nativePlayer?.seekTo(seekRequest.position);
    }
  }, [isDirect, nativePlayer, seekRequest]);

  // ── Playback speed ───────────────────────────────────────────────────────
  // Applies the rate chosen in the player modal to the real native player, with
  // pitch correction so 1.5×/2× don't sound chipmunky. Re-applied whenever the
  // track reloads (a fresh AudioPlayer instance defaults back to 1×).
  useEffect(() => {
    if (!isDirect || !nativePlayer) return;
    try {
      nativePlayer.shouldCorrectPitch = true;
      nativePlayer.setPlaybackRate(playbackRate, 'high');
    } catch { /* unsupported — falls back to normal speed */ }
  }, [playbackRate, isDirect, nativePlayer, currentTrack?.id, nativeStatus.isLoaded]);

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
  const handleTrackEnd = async (listenedSeconds = 0) => {
    // Increment streak counter; auto-switches to Gold icon at 100 plays.
    AppIconService.recordPlay().catch(() => undefined);

    // No history is recorded during a Private Session.
    if (currentTrack && listenedSeconds > 10 && !settings.privateSession) {
      dbRecordListeningHistory(currentTrack, listenedSeconds).catch(() => undefined);
    }

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

    // The "Autoplay" toggle (Settings → Playback) controls whether the queue is
    // auto-extended with recommendations when it runs out.
    if (currentIndex === queue.length - 1 && settings.autoplay) {
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
