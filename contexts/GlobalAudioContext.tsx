'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ExploreSong } from '@/types/explore';

interface GlobalAudioContextType {
  currentSong: ExploreSong | null;
  isPlaying: boolean;
  upcomingQueue: ExploreSong[];
  historyStack: ExploreSong[];
  playSong: (song: ExploreSong, newQueue?: ExploreSong[]) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  playFromQueue: (song: ExploreSong) => void;
  closePlayer: () => void;
  setQueue: (queue: ExploreSong[]) => void;
}

const GlobalAudioContext = createContext<GlobalAudioContextType | undefined>(undefined);

const STORAGE_KEY = 'deluxe_global_playback_state_v1';

export function GlobalAudioProvider({ children }: { children: React.ReactNode }) {
  const [currentSong, setCurrentSong] = useState<ExploreSong | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [upcomingQueue, setUpcomingQueue] = useState<ExploreSong[]>([]);
  const [historyStack, setHistoryStack] = useState<ExploreSong[]>([]);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Hydrate from localStorage on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentSong) {
          setCurrentSong(parsed.currentSong);
          setUpcomingQueue(Array.isArray(parsed.upcomingQueue) ? parsed.upcomingQueue : []);
          setHistoryStack(Array.isArray(parsed.historyStack) ? parsed.historyStack : []);
          // Do not autoplay on cold reload unless user interacts
          setIsPlaying(false);
        }
      }
    } catch (e) {
      console.warn('Failed to load playback state from storage', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persist playback state to localStorage on state change
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (currentSong) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            currentSong,
            upcomingQueue: upcomingQueue.slice(0, 50),
            historyStack: historyStack.slice(-30),
          })
        );
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to persist playback state', e);
    }
  }, [currentSong, upcomingQueue, historyStack, isHydrated]);

  const playSong = useCallback((song: ExploreSong, newQueue?: ExploreSong[]) => {
    setCurrentSong(song);
    setIsPlaying(true);
    if (newQueue) {
      setUpcomingQueue(newQueue);
      setHistoryStack([]);
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const nextSong = useCallback(() => {
    if (upcomingQueue.length === 0) return;
    const nextTrack = upcomingQueue[0];
    const remaining = upcomingQueue.slice(1);
    if (currentSong) {
      setHistoryStack((prev) => [...prev, currentSong]);
    }
    setUpcomingQueue(remaining);
    setCurrentSong(nextTrack);
    setIsPlaying(true);
  }, [upcomingQueue, currentSong]);

  const prevSong = useCallback(() => {
    if (historyStack.length === 0) return;
    const lastTrack = historyStack[historyStack.length - 1];
    const remainingHistory = historyStack.slice(0, -1);
    if (currentSong) {
      setUpcomingQueue((prev) => [currentSong, ...prev]);
    }
    setHistoryStack(remainingHistory);
    setCurrentSong(lastTrack);
    setIsPlaying(true);
  }, [historyStack, currentSong]);

  const playFromQueue = useCallback((song: ExploreSong) => {
    if (currentSong?.id === song.id) {
      setIsPlaying((prev) => !prev);
      return;
    }
    const idx = upcomingQueue.findIndex((s) => s.id === song.id);
    if (idx !== -1) {
      const skipped = upcomingQueue.slice(0, idx);
      if (currentSong) {
        setHistoryStack((prev) => [...prev, currentSong, ...skipped]);
      }
      setUpcomingQueue(upcomingQueue.slice(idx + 1));
    }
    setCurrentSong(song);
    setIsPlaying(true);
  }, [currentSong, upcomingQueue]);

  const closePlayer = useCallback(() => {
    setIsPlaying(false);
    setCurrentSong(null);
    setUpcomingQueue([]);
    setHistoryStack([]);
  }, []);

  const setQueue = useCallback((queue: ExploreSong[]) => {
    setUpcomingQueue(queue);
  }, []);

  return (
    <GlobalAudioContext.Provider
      value={{
        currentSong,
        isPlaying,
        upcomingQueue,
        historyStack,
        playSong,
        togglePlay,
        nextSong,
        prevSong,
        playFromQueue,
        closePlayer,
        setQueue,
      }}
    >
      {children}
    </GlobalAudioContext.Provider>
  );
}

export function useGlobalAudio() {
  const context = useContext(GlobalAudioContext);
  if (!context) {
    throw new Error('useGlobalAudio must be used within a GlobalAudioProvider');
  }
  return context;
}
