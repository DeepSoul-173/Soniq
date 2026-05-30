import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { usePlayerStore } from '@/src/store/playerStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { useLibraryStore } from '@/src/store/libraryStore';
import { Track } from '@/src/models/types';
import { RecommendationEngine } from '@/src/services/recommendations/RecommendationEngine';
import { SearchService } from '@/src/services/SearchService';

export function UnifiedPlayer() {
  const { 
    queue, currentIndex, isPlaying, setIsPlaying, 
    setPlaybackState, nextTrack, setActiveEngine, setIsBuffering, seekRequest, updateQueueTrack,
  } = usePlayerStore();
  
  const { settings } = useSettingsStore();
  const { addRecentlyPlayed } = useLibraryStore();
  const currentTrack: Track | undefined = queue[currentIndex];
  const isDirect = currentTrack && ['piped', 'jamendo', 'internet_archive'].includes(currentTrack.sourceType);

  // -- Native Audio Engine --
  // Note: expo-audio useAudioPlayer hook accepts a source object.
  const source = (isDirect && currentTrack?.streamUrl) ? currentTrack.streamUrl : null;
  const nativePlayer = useAudioPlayer(source, { updateInterval: 500 });
  const nativeStatus = useAudioPlayerStatus(nativePlayer);

  const handledEndId = useRef<number | null>(null);
  const handledSeekId = useRef<number | null>(null);
  const lastTrackedId = useRef<string | null>(null);
  const resolvingTrackId = useRef<string | null>(null);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: settings.playInBackground,
      interruptionMode: 'doNotMix',
    }).catch((error) => console.error('Failed to configure audio mode', error));
  }, [settings.playInBackground]);

  useEffect(() => {
    if (!currentTrack || currentTrack.sourceType !== 'piped' || currentTrack.streamUrl) return;
    if (resolvingTrackId.current === currentTrack.id) return;

    let cancelled = false;
    resolvingTrackId.current = currentTrack.id;
    setIsBuffering(true);

    SearchService.prepareTrackForPlayback(currentTrack)
      .then((playableTrack) => {
        if (!cancelled) updateQueueTrack(currentIndex, playableTrack);
      })
      .catch((error) => {
        console.error('Failed to prepare Piped stream', error);
        if (!cancelled) setIsPlaying(false);
      })
      .finally(() => {
        if (!cancelled) setIsBuffering(false);
        if (resolvingTrackId.current === currentTrack.id) resolvingTrackId.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [currentIndex, currentTrack, setIsBuffering, setIsPlaying, updateQueueTrack]);

  // Handle active engine and play/pause toggles
  useEffect(() => {
    if (!currentTrack) {
      nativePlayer?.pause();
      setActiveEngine(null);
      return;
    }

    if (isDirect) {
      setActiveEngine('native');
      if (isPlaying) {
        nativePlayer?.play();
      } else {
        nativePlayer?.pause();
      }
    }
  }, [currentTrack, isPlaying, isDirect, nativePlayer, setActiveEngine]);

  useEffect(() => {
    if (!currentTrack || currentTrack.id === lastTrackedId.current) return;
    lastTrackedId.current = currentTrack.id;
    addRecentlyPlayed(currentTrack);
  }, [addRecentlyPlayed, currentTrack]);

  useEffect(() => {
    if (!isDirect || !nativeStatus) return;

    const fallbackDuration = currentTrack?.duration || 0;
    setPlaybackState(nativeStatus.currentTime || 0, nativeStatus.duration || fallbackDuration);
    setIsBuffering(Boolean(nativeStatus.isBuffering));

    if (nativeStatus.didJustFinish && handledEndId.current !== nativeStatus.id) {
      handledEndId.current = nativeStatus.id;
      handleTrackEnd();
    }
  }, [currentTrack?.duration, isDirect, nativeStatus, setIsBuffering, setPlaybackState]);

  useEffect(() => {
    if (!seekRequest || handledSeekId.current === seekRequest.requestId) return;

    handledSeekId.current = seekRequest.requestId;
    if (isDirect) {
      nativePlayer?.seekTo(seekRequest.position);
    }
  }, [isDirect, nativePlayer, seekRequest]);

  // Handle track ending and auto-queue recommendations
  const handleTrackEnd = async () => {
    if (settings.defaultRepeatMode === 'track') {
      if (isDirect) {
        nativePlayer?.seekTo(0);
        nativePlayer?.play();
      }
      return;
    }

    // Auto add recommendations if at the end of the queue
    if (currentIndex === queue.length - 1 && settings.autoAddRecommendations) {
      const rec = await RecommendationEngine.getNextRecommendation(currentTrack);
      if (rec) {
        usePlayerStore.getState().addToQueue(rec);
      }
    }

    nextTrack();
  };

  return <View style={styles.container} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
});
