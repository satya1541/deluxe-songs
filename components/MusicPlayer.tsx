'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Song } from '@/types/music';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import AudioEnhancer from '@/components/AudioEnhancer';
import EmotionOverlay from '@/components/EmotionOverlay';

const PLAYED_HISTORY_KEY = 'deluxe_played_history_v1';

function getPlayedHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PLAYED_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePlayedHistory(history: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PLAYED_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

function clearPlayedHistory() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PLAYED_HISTORY_KEY);
  } catch {}
}

// Random shuffle array helper (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Smart queue generator: puts unplayed songs FIRST, resets when all songs have been played
function generateSmartQueue(songList: Song[], currentQueue: number[] = []): number[] {
  if (songList.length === 0) return [];
  
  let playedList = getPlayedHistory();
  const allSongFiles = new Set(songList.map((s) => s.file));
  
  // Clean up any deleted songs from played history
  playedList = playedList.filter((f) => allSongFiles.has(f));

  // If ALL songs have already been played, reset history and start fresh
  if (playedList.length >= songList.length && songList.every((s) => playedList.includes(s.file))) {
    clearPlayedHistory();
    playedList = [];
  }

  const playedSet = new Set(playedList);
  const unplayedIndices: number[] = [];
  const playedIndices: number[] = [];

  songList.forEach((song, idx) => {
    if (playedSet.has(song.file)) {
      playedIndices.push(idx);
    } else {
      unplayedIndices.push(idx);
    }
  });

  // Shuffle unplayed songs and put them in front
  const shuffledUnplayed = shuffleArray(unplayedIndices);
  // Shuffle previously played songs and put them at the end
  const shuffledPlayed = shuffleArray(playedIndices);

  const finalQueue = [...shuffledUnplayed, ...shuffledPlayed];

  // Prevent immediate repetition across shuffles if possible
  if (
    currentQueue.length > 0 &&
    finalQueue.length > 1 &&
    finalQueue[0] === currentQueue[currentQueue.length - 1]
  ) {
    [finalQueue[0], finalQueue[1]] = [finalQueue[1], finalQueue[0]];
  }

  return finalQueue;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const markedThisSessionRef = useRef<Set<string>>(new Set());

  const [songs, setSongs] = useState<Song[]>([]);
  const [queue, setQueue] = useState<number[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [enhancerOpen, setEnhancerOpen] = useState<boolean>(false);

  // Audio engine
  const engine = useAudioEngine(audioRef);

  // Mark song as played once listened to for >= 3 seconds
  const markSongPlayedAfterThreshold = useCallback((song: Song, allSongs: Song[]) => {
    if (!song?.file || allSongs.length === 0) return;
    if (markedThisSessionRef.current.has(song.file)) return;

    markedThisSessionRef.current.add(song.file);

    let playedList = getPlayedHistory();
    if (!playedList.includes(song.file)) {
      playedList.push(song.file);
    }

    const allFiles = allSongs.map((s) => s.file);
    // Check if all available songs have now been played for at least 3 seconds
    const allPlayed = allFiles.length > 0 && allFiles.every((f) => playedList.includes(f));

    if (allPlayed) {
      // All songs played! Automatically clear cache so next cycle starts completely from the beginning
      clearPlayedHistory();
      markedThisSessionRef.current.clear();
    } else {
      savePlayedHistory(playedList);
    }
  }, []);

  const loadSongs = useCallback(async () => {
    try {
      const res = await fetch('/api/songs', { cache: 'no-store' });
      if (res.ok) {
        const fetchedSongs: Song[] = await res.json();
        if (fetchedSongs.length > 0) {
          setSongs(fetchedSongs);
          setQueue((prevQueue) => {
            if (prevQueue.length === 0) {
              return generateSmartQueue(fetchedSongs);
            }
            // If new songs added, append to queue
            const existingIndices = new Set(prevQueue);
            const newIndices = fetchedSongs
              .map((_, i) => i)
              .filter((i) => !existingIndices.has(i));
            return [...prevQueue, ...newIndices];
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch dynamic songs list:', err);
    }
  }, []);

  // Fetch dynamic list of songs automatically from /public/music/ via /api/songs
  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  // Set default audio element volume to 50%
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
    }
  }, []);

  const currentSongIndex = queue[queueIndex] ?? 0;
  const currentSong: Song | undefined = songs[currentSongIndex] || songs[0];

  // Play / Pause side effect controlled ONLY by isPlaying state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (isPlaying) {
      // Initialize audio engine on first play (requires user gesture)
      if (!engine.isInitialized) {
        engine.initEngine();
      }
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Playback blocked or failed:', err);
          setIsPlaying(false);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong, engine]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const nextSong = useCallback(() => {
    setQueueIndex((prevIndex) => {
      const nextIdx = prevIndex + 1;
      if (nextIdx >= queue.length) {
        const newQueue = generateSmartQueue(songs, queue);
        setQueue(newQueue);
        return 0;
      }
      return nextIdx;
    });
  }, [queue, songs]);

  const prevSong = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      if (!isPlaying) setIsPlaying(true);
    } else {
      setQueueIndex((prevIndex) => {
        if (prevIndex > 0) return prevIndex - 1;
        return queue.length - 1;
      });
    }
  }, [isPlaying, queue.length]);

  // Audio Event Handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      setCurrentTime(cur);

      // Track >= 3 seconds of listening
      if (cur >= 3 && currentSong && songs.length > 0) {
        markSongPlayedAfterThreshold(currentSong, songs);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    nextSong();
  };

  const handleAudioError = useCallback(() => {
    if (!currentSong) return;
    console.warn(`Track "${currentSong.name}" (${currentSong.file}) could not be loaded. Skipping to next track.`);
    
    // Clean up from local history so it doesn't block queues
    let history = getPlayedHistory();
    if (history.includes(currentSong.file)) {
      savePlayedHistory(history.filter((f) => f !== currentSong.file));
    }

    // Auto-skip to next playable track
    setTimeout(() => {
      nextSong();
    }, 200);
  }, [currentSong, nextSong]);

  // Seek bar click
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !audioRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    if (width > 0) {
      const percentage = clickX / width;
      const newTime = percentage * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      if (!isPlaying) setIsPlaying(true);
    }
  };

  // Keyboard shortcut listener (Space bar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const toggleEnhancer = useCallback(() => {
    setEnhancerOpen((prev) => !prev);
  }, []);

  if (!currentSong) {
    return (
      <div className="music-player">
        <div className="player-inner player-loading">
          <div className="album-art-wrapper">
            <div className="album-art skeleton-shimmer">
              <div className="vinyl-hole" />
            </div>
          </div>

          <div className="player-info">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-artist" />
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div className="progress-track">
                  <div className="progress-fill skeleton-shimmer" style={{ width: '35%' }} />
                </div>
              </div>
              <div className="time-display">
                <span>0:00</span>
                <span className="time-sep">/</span>
                <span>0:00</span>
              </div>
            </div>
          </div>

          <div className="player-controls">
            <div className="control-btn eq-btn" style={{ opacity: 0.4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="2" y="14" width="4" height="8" rx="1" />
                <rect x="10" y="6" width="4" height="16" rx="1" />
                <rect x="18" y="10" width="4" height="12" rx="1" />
              </svg>
            </div>
            <div className="control-btn prev-btn" style={{ opacity: 0.4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </div>
            <div className="control-btn play-btn skeleton-shimmer" style={{ opacity: 0.8 }}>
              <svg className="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="control-btn next-btn" style={{ opacity: 0.4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6h2v12h-2zm-2 6L5.5 6v12z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="music-player">
        <audio
          ref={audioRef}
          src={currentSong.file}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleAudioError}
        />
        <div className="player-inner">
          <div className="album-art-wrapper">
            <div className={`album-art ${isPlaying ? 'playing' : ''}`}>
              <Image
                src={currentSong.cover}
                alt={currentSong.name}
                width={80}
                height={80}
                priority
                unoptimized
              />
            </div>
            <div className="vinyl-hole"></div>
          </div>

          <div className="player-info">
            <p className="song-name">{currentSong.name}</p>
            <p className="artist-name">{currentSong.artist}</p>
            <div className="progress-bar-container">
              <div className="progress-bar" ref={progressBarRef} onClick={handleSeek}>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div
                  className="progress-thumb"
                  style={{ left: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                <span className="time-sep">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          <div className="player-controls">
            {/* EQ Button */}
            <button
              type="button"
              className={`control-btn eq-btn ${enhancerOpen ? 'eq-active' : ''}`}
              onClick={toggleEnhancer}
              aria-label="Audio Enhancer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="2" y="14" width="4" height="8" rx="1" />
                <rect x="10" y="6" width="4" height="16" rx="1" />
                <rect x="18" y="10" width="4" height="12" rx="1" />
              </svg>
            </button>

            <button
              type="button"
              className="control-btn prev-btn"
              onClick={prevSong}
              aria-label="Previous track"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button
              type="button"
              className="control-btn play-btn"
              onClick={togglePlay}
              aria-label="Play or Pause"
            >
              {isPlaying ? (
                <svg className="pause-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="control-btn next-btn"
              onClick={nextSong}
              aria-label="Next track"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6h2v12h-2zm-2 6L5.5 6v12z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Emotion Visual Effects Overlay */}
      <EmotionOverlay
        songName={currentSong.name}
        songArtist={currentSong.artist}
        isPlaying={isPlaying}
      />

      {/* Audio Enhancer Panel */}
      <AudioEnhancer
        engine={engine}
        isOpen={enhancerOpen}
        onClose={() => setEnhancerOpen(false)}
      />
    </>
  );
}
