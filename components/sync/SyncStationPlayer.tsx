'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Song } from '@/types/music';
import { LyricsData, LyricLine } from '@/types/lyrics';
import songDurationsMap from '@/lib/song-durations.json';
import { useAudioEngine, AI_ACOUSTIC_PROFILES, AIAcousticProfile } from '@/hooks/useAudioEngine';
import AudioEnhancer from '@/components/AudioEnhancer';
import EmotionOverlay, { getInstantEmotion } from '@/components/EmotionOverlay';
import VolumeHUD from '@/components/VolumeHUD';

interface SyncStationPlayerProps {
  song: Song | null;
  isPlaying: boolean;
  expectedPosition: number; // in seconds
  startedAtEpoch: number; // epoch ms
  isHost: boolean;
  onTogglePlay?: () => void;
  onSeek?: (newPosition: number) => void;
  onSongEnded?: () => void;
  titleBadge?: string;
  nextSong?: Song | null;
  visualsEnabled?: boolean;
}

export default function SyncStationPlayer({
  song,
  isPlaying,
  expectedPosition,
  startedAtEpoch,
  isHost,
  onTogglePlay,
  onSeek,
  onSongEnded,
  titleBadge = '24/7 GLOBAL RADIO',
  nextSong,
  visualsEnabled = true,
}: SyncStationPlayerProps) {
  // Dual-Deck Crossfader References
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  const [activeDeck, setActiveDeck] = useState<'A' | 'B'>('A');
  const activeDeckRef = useRef<'A' | 'B'>('A');
  activeDeckRef.current = activeDeck;

  const isCrossfadingRef = useRef<boolean>(false);
  const crossfadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio DSP Engine & AI Smart Acoustics
  const engine = useAudioEngine(audioRefA);
  const [enhancerOpen, setEnhancerOpen] = useState<boolean>(false);
  const [aiSmartEq, setAiSmartEq] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('deluxe_sync_ai_smart_eq_v1') === 'true';
    } catch {
      return false;
    }
  });

  const activeEmotion = song ? getInstantEmotion(song.name, song.artist) : null;
  const activeProfile: AIAcousticProfile | null =
    activeEmotion?.emotion && AI_ACOUSTIC_PROFILES[activeEmotion.emotion]
      ? AI_ACOUSTIC_PROFILES[activeEmotion.emotion]
      : AI_ACOUSTIC_PROFILES.content_romantic || Object.values(AI_ACOUSTIC_PROFILES)[0];

  // Auto-sculpt acoustics when AI Smart EQ is active and song plays
  useEffect(() => {
    if (aiSmartEq && activeProfile && isPlaying) {
      engine.applyAcousticProfile(activeProfile);
    }
  }, [aiSmartEq, activeProfile, isPlaying, engine.applyAcousticProfile]);

  // AI Acoustic Profile floating confirmation toast
  const [aiToast, setAiToast] = useState<{ profile: AIAcousticProfile } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleAiSmartEq = useCallback(() => {
    setAiSmartEq((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('deluxe_sync_ai_smart_eq_v1', String(next));
        } catch {}
      }
      if (next && activeProfile) {
        engine.initEngine();
        engine.applyAcousticProfile(activeProfile);
        setAiToast({ profile: activeProfile });
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          setAiToast(null);
        }, 2200);
      } else if (!next) {
        engine.resetToFlat();
        setAiToast(null);
      }
      return next;
    });
  }, [activeProfile, engine]);

  const toggleEnhancer = () => {
    engine.initEngine();
    setEnhancerOpen((p) => !p);
  };

  // Helper getters for active and standby audio elements
  const getActiveAudio = useCallback(() => {
    return activeDeckRef.current === 'A' ? audioRefA.current : audioRefB.current;
  }, []);

  const getStandbyAudio = useCallback(() => {
    return activeDeckRef.current === 'A' ? audioRefB.current : audioRefA.current;
  }, []);

  // Autoplay / Audio state (Default volume: 50%)
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(50);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [driftOffset, setDriftOffset] = useState<number>(0);
  const [showVolumeToast, setShowVolumeToast] = useState<boolean>(false);

  // Synchronized Lyrics state
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [activeLyricIndex, setActiveLyricIndex] = useState<number>(-1);
  const [showLyrics, setShowLyrics] = useState<boolean>(true);
  const [isLyricsLoading, setIsLyricsLoading] = useState<boolean>(false);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Initial volume setup on both decks
  useEffect(() => {
    const active = getActiveAudio();
    const standby = getStandbyAudio();
    if (active) active.volume = 0.5;
    if (standby) standby.volume = 0;
  }, [getActiveAudio, getStandbyAudio]);

  // Master Volume Handler
  const applyMasterVolume = useCallback((volPercent: number, muted: boolean) => {
    const targetVol = muted ? 0 : volPercent / 100;
    const active = getActiveAudio();
    if (active && !isCrossfadingRef.current) {
      active.volume = targetVol;
    }
  }, [getActiveAudio]);

  // ArrowUp & ArrowDown volume keyboard control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setVolume((prev) => {
          const next = Math.min(100, prev + 5);
          applyMasterVolume(next, false);
          if (isMuted) setIsMuted(false);
          return next;
        });
        setShowVolumeToast(true);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setVolume((prev) => {
          const next = Math.max(0, prev - 5);
          applyMasterVolume(next, next === 0);
          if (next === 0) setIsMuted(true);
          return next;
        });
        setShowVolumeToast(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMuted, applyMasterVolume]);

  // Auto-hide volume HUD after 1.4s
  useEffect(() => {
    if (showVolumeToast) {
      const timer = setTimeout(() => setShowVolumeToast(false), 1400);
      return () => clearTimeout(timer);
    }
  }, [showVolumeToast, volume]);

  // Transparent one-tap audio unlock for mobile browsers
  useEffect(() => {
    const handleFirstGesture = () => {
      const active = getActiveAudio();
      if (active && active.paused && isPlaying) {
        active.play().catch(() => {});
      }
    };
    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, [isPlaying, getActiveAudio]);

  // Compute live expected position based on time elapsed worldwide
  const getCalculatedLivePosition = useCallback(() => {
    if (!isPlaying) return expectedPosition;
    if (startedAtEpoch > 0) {
      const elapsedSinceStart = (Date.now() - startedAtEpoch) / 1000;
      return Math.max(0, elapsedSinceStart);
    }
    return Math.max(0, expectedPosition);
  }, [isPlaying, startedAtEpoch, expectedPosition]);

  const currentSongKeyRef = useRef<string>('');
  const hasSeekedSongRef = useRef<string>('');

  // Function to perform initial seek when audio headers and buffer are ready
  const performInitialLiveSeek = useCallback(() => {
    const audio = getActiveAudio();
    if (!audio || !song) return;
    const songKey = song.fileName || `${song.name}__${song.artist}`;

    if (hasSeekedSongRef.current !== songKey && audio.readyState >= 1) {
      hasSeekedSongRef.current = songKey;
      const targetPos = getCalculatedLivePosition();
      audio.currentTime = targetPos;
      if (isPlaying && audio.paused) {
        audio.play().catch(() => {});
      }
    }
  }, [getActiveAudio, song, isPlaying, getCalculatedLivePosition]);

  // Sync Audio Position on Song Switch
  useEffect(() => {
    const audio = getActiveAudio();
    if (!audio || !song || !audioUnlocked || isCrossfadingRef.current) return;

    const songKey = song.fileName || `${song.name}__${song.artist}`;

    // 1. Song changed: Load new song onto active deck
    if (currentSongKeyRef.current !== songKey) {
      currentSongKeyRef.current = songKey;
      hasSeekedSongRef.current = '';
      if (audio.src !== song.file) {
        audio.src = song.file;
      }
      audio.volume = isMuted ? 0 : volume / 100;
      if (isPlaying) {
        audio.play().catch(() => {});
      }
      return;
    }

    // 2. Play/Pause state matching
    if (isPlaying && audio.paused) {
      audio.play().catch(() => {});
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [song, isPlaying, audioUnlocked, getActiveAudio, isMuted, volume]);

  // High-Precision Phase-Locked Loop (PLL) Drift Controller (Every 1s)
  useEffect(() => {
    if (!audioUnlocked || !isPlaying || isCrossfadingRef.current) return;

    const pllInterval = setInterval(() => {
      const audio = getActiveAudio();
      if (!audio || audio.readyState < 2 || audio.paused) return;

      const targetPos = getCalculatedLivePosition();
      const currentPos = audio.currentTime;
      const diff = currentPos - targetPos; // negative: behind stream, positive: ahead of stream
      const absDiff = Math.abs(diff);
      setDriftOffset(absDiff);

      // 1. Catastrophic drift (> 8s, e.g. laptop wake from sleep): Hard snap
      if (absDiff > 8.0) {
        audio.currentTime = targetPos;
        audio.playbackRate = 1.0;
        return;
      }

      // 2. Continuous Proportional Speed Adjustment (Zero buffering pauses)
      if (diff < -2.0) {
        // Behind by > 2s: Catch up at 1.15x
        audio.playbackRate = 1.15;
      } else if (diff < -0.6) {
        // Behind by 0.6s - 2s: Catch up at 1.08x
        audio.playbackRate = 1.08;
      } else if (diff < -0.06) {
        // Behind by 60ms - 600ms: Micro-nudge at 1.03x
        audio.playbackRate = 1.03;
      } else if (diff > 2.0) {
        // Ahead by > 2s: Slow down at 0.86x
        audio.playbackRate = 0.86;
      } else if (diff > 0.6) {
        // Ahead by 0.6s - 2s: Slow down at 0.93x
        audio.playbackRate = 0.93;
      } else if (diff > 0.06) {
        // Ahead by 60ms - 600ms: Micro-nudge at 0.97x
        audio.playbackRate = 0.97;
      } else {
        // Perfectly Phase-Locked (±60ms tolerance)
        audio.playbackRate = 1.0;
      }
    }, 1000);

    return () => {
      clearInterval(pllInterval);
    };
  }, [audioUnlocked, isPlaying, getCalculatedLivePosition, getActiveAudio]);

  // Preload Upcoming Track on Standby Deck
  useEffect(() => {
    if (!nextSong?.file) return;
    const standby = getStandbyAudio();
    if (!standby) return;

    if (standby.src !== nextSong.file) {
      standby.src = nextSong.file;
      standby.preload = 'auto';
      standby.volume = 0;
      standby.currentTime = 0;
      standby.load();
    }
  }, [nextSong?.file, activeDeck, getStandbyAudio]);

  // Execute 3.5-second Seamless Dual-Deck Crossfade
  const executeCrossfade = useCallback(() => {
    const outgoing = getActiveAudio();
    const incoming = getStandbyAudio();
    if (!incoming || !outgoing) return;

    const targetVolume = isMuted ? 0 : volume / 100;
    const CROSSFADE_MS = 3500;
    const INTERVAL_MS = 50;
    const totalSteps = CROSSFADE_MS / INTERVAL_MS;
    let step = 0;

    // Start incoming track immediately at 0 volume
    incoming.currentTime = 0;
    incoming.volume = 0;
    incoming.play().catch(() => {});

    if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);

    crossfadeTimerRef.current = setInterval(() => {
      step++;
      const progress = Math.min(1, step / totalSteps);

      // Smooth equal-power curve approximation
      const inVol = targetVolume * Math.sin(progress * (Math.PI / 2));
      const outVol = targetVolume * Math.cos(progress * (Math.PI / 2));

      incoming.volume = Math.max(0, Math.min(1, inVol));
      outgoing.volume = Math.max(0, Math.min(1, outVol));

      if (step >= totalSteps) {
        clearInterval(crossfadeTimerRef.current!);
        outgoing.pause();
        outgoing.currentTime = 0;
        outgoing.volume = 0;
        incoming.volume = targetVolume;

        // Switch active deck
        const nextDeck = activeDeckRef.current === 'A' ? 'B' : 'A';
        setActiveDeck(nextDeck);
        activeDeckRef.current = nextDeck;
        isCrossfadingRef.current = false;

        // Notify parent that song ended to update metadata and queue next preload
        onSongEnded?.();
      }
    }, INTERVAL_MS);
  }, [getActiveAudio, getStandbyAudio, isMuted, volume, onSongEnded]);

  const lastCrossfadedSongRef = useRef<string>('');

  // Continuous Frame-Rate Phase Alignment in handleTimeUpdate
  const handleTimeUpdate = (deck: 'A' | 'B') => {
    if (deck !== activeDeckRef.current) return;
    const active = getActiveAudio();
    if (!active) return;

    const cur = active.currentTime;
    const dur = active.duration || duration || 240;
    setCurrentTime(cur);

    const targetPos = getCalculatedLivePosition();
    const diff = cur - targetPos; // negative: behind global clock, positive: ahead
    const absDiff = Math.abs(diff);
    setDriftOffset(absDiff);

    // Continuous Real-Time Speed Trimming (Guarantees zero perceptible delay between tabs)
    if (!isCrossfadingRef.current && isPlaying && !active.paused) {
      if (absDiff > 6.0) {
        active.currentTime = targetPos;
        active.playbackRate = 1.0;
      } else if (diff < -1.0) {
        // Behind by > 1s: catch up at 1.22x
        active.playbackRate = 1.22;
      } else if (diff < -0.15) {
        // Behind by 150ms - 1s: catch up at 1.08x
        active.playbackRate = 1.08;
      } else if (diff < -0.03) {
        // Micro-trim behind (30ms - 150ms): 1.025x
        active.playbackRate = 1.025;
      } else if (diff > 1.0) {
        // Ahead by > 1s: slow down at 0.80x
        active.playbackRate = 0.80;
      } else if (diff > 0.15) {
        // Ahead by 150ms - 1s: slow down at 0.92x
        active.playbackRate = 0.92;
      } else if (diff > 0.03) {
        // Micro-trim ahead (30ms - 150ms): 0.975x
        active.playbackRate = 0.975;
      } else {
        // Phase locked (< 30ms)
        active.playbackRate = 1.0;
      }
    }

    // Crossfade trigger check (Only once per song at duration - 3.5s)
    const songKey = song?.fileName || `${song?.name}__${song?.artist}`;
    const remaining = dur - cur;
    if (
      dur > 15 &&
      cur > 10 &&
      remaining <= 3.6 &&
      remaining > 0.1 &&
      !isCrossfadingRef.current &&
      lastCrossfadedSongRef.current !== songKey &&
      nextSong?.file
    ) {
      isCrossfadingRef.current = true;
      lastCrossfadedSongRef.current = songKey;
      executeCrossfade();
    }
  };

  const handleLoadedMetadata = (deck: 'A' | 'B') => {
    const audio = deck === 'A' ? audioRefA.current : audioRefB.current;
    if (!audio) return;
    const probedDur = (songDurationsMap as Record<string, number>)[song?.fileName || ''] || audio.duration || 240;
    if (deck === activeDeckRef.current) {
      setDuration(probedDur);
      const songKey = song?.fileName || `${song?.name}__${song?.artist}`;
      if (hasSeekedSongRef.current !== songKey) {
        hasSeekedSongRef.current = songKey;
        const targetPos = getCalculatedLivePosition();
        audio.currentTime = targetPos;
      }
      if (isPlaying && audio.paused) {
        audio.play().catch(() => {});
      }
    }
  };

  // Instant snap when audio actually starts playing after buffer completes
  const handleDeckPlaying = (deck: 'A' | 'B') => {
    if (deck === activeDeckRef.current && !isCrossfadingRef.current) {
      const active = getActiveAudio();
      if (!active) return;
      const targetPos = getCalculatedLivePosition();
      const lag = targetPos - active.currentTime;
      if (lag > 0.4 && lag < 6.0) {
        active.currentTime = targetPos;
      }
    }
  };

  // Fallback onEnded if crossfade didn't trigger (e.g. user seek to near end or short track)
  const handleDeckEnded = (deck: 'A' | 'B') => {
    if (deck === activeDeckRef.current && !isCrossfadingRef.current) {
      onSongEnded?.();
    }
  };

  // Fetch Lyrics for Current Song (Uses exact probed duration synchronously)
  useEffect(() => {
    if (!song?.name) {
      setLyricsData(null);
      setIsLyricsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLyricsLoading(true);
    setLyricsData(null);

    const fetchLyrics = async () => {
      try {
        const exactDur = (songDurationsMap as Record<string, number>)[song.fileName || ''] || 240;
        const url = `/api/lyrics?name=${encodeURIComponent(song.name)}&artist=${encodeURIComponent(song.artist || '')}&duration=${exactDur}`;
        const res = await fetch(url);
        if (res.ok && isMounted) {
          const data = await res.json();
          setLyricsData(data);
        } else if (isMounted) {
          setLyricsData(null);
        }
      } catch (err) {
        console.warn('Failed to fetch lyrics for sync station:', err);
        if (isMounted) setLyricsData(null);
      } finally {
        if (isMounted) {
          setIsLyricsLoading(false);
        }
      }
    };

    fetchLyrics();
    return () => {
      isMounted = false;
    };
  }, [song?.fileName, song?.name, song?.artist]);

  // Update Active Lyric Line based on currentTime
  useEffect(() => {
    if (!lyricsData?.synced || !lyricsData.lines || lyricsData.lines.length === 0) {
      setActiveLyricIndex(-1);
      return;
    }

    let currentIdx = -1;
    for (let i = 0; i < lyricsData.lines.length; i++) {
      if (currentTime >= lyricsData.lines[i].time - 0.2) {
        currentIdx = i;
      } else {
        break;
      }
    }

    if (currentIdx !== activeLyricIndex) {
      setActiveLyricIndex(currentIdx);

      // Auto scroll active lyric into view
      if (currentIdx >= 0 && lyricsContainerRef.current) {
        const activeElem = lyricsContainerRef.current.querySelector(`.sync-lyric-line-${currentIdx}`);
        if (activeElem) {
          activeElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentTime, lyricsData, activeLyricIndex]);

  // Handle Volume Slider Change
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    applyMasterVolume(newVol, isMuted);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    applyMasterVolume(volume, nextMuted);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!song) {
    return (
      <div className="sync-player-empty">
        <div className="sync-empty-pulse">📻</div>
        <p>Connecting to Deluxe Broadcast Stream...</p>
      </div>
    );
  }

  return (
    <div className="sync-station-player">
      {/* Dual Audio Decks for Gapless Preloaded Crossfading */}
      <audio
        ref={audioRefA}
        onTimeUpdate={() => handleTimeUpdate('A')}
        onLoadedMetadata={() => handleLoadedMetadata('A')}
        onCanPlay={() => handleLoadedMetadata('A')}
        onPlaying={() => handleDeckPlaying('A')}
        onEnded={() => handleDeckEnded('A')}
        preload="auto"
      />
      <audio
        ref={audioRefB}
        onTimeUpdate={() => handleTimeUpdate('B')}
        onLoadedMetadata={() => handleLoadedMetadata('B')}
        onCanPlay={() => handleLoadedMetadata('B')}
        onPlaying={() => handleDeckPlaying('B')}
        onEnded={() => handleDeckEnded('B')}
        preload="auto"
      />

      {/* Floating Volume HUD Toast */}
      {showVolumeToast && (
        <div className="sync-volume-toast" role="status" aria-live="polite">
          <span className="sync-vol-toast-icon">
            {isMuted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
          </span>
          <span className="sync-vol-toast-text">Volume {isMuted ? 0 : volume}%</span>
          <div className="sync-vol-toast-bar">
            <div className="sync-vol-toast-fill" style={{ width: `${isMuted ? 0 : volume}%` }} />
          </div>
        </div>
      )}

      {/* Player Main Stage */}
      <div className="sync-stage-grid">
        {/* Left Column: Rotating Vinyl & Song Info */}
        <div className="sync-stage-left">
          <div className="sync-badge-row">
            <span className="sync-live-pill">
              <span className="sync-live-dot" />
              {titleBadge}
            </span>
            {aiSmartEq && activeProfile && (
              <span className="sync-ai-pill" title={`Acoustic Profile: ${activeProfile.tagline}`}>
                ✨ {activeProfile.icon} {activeProfile.badge}
              </span>
            )}
            <span className="sync-drift-pill" title="Clock Phase Offset">
              {driftOffset <= 0.08 ? '⚡ Phase Locked (±40ms)' : `🔄 Auto-Aligning (${Math.round(driftOffset * 1000)}ms)`}
            </span>
          </div>

          <div className="sync-vinyl-container">
            <div className="sync-vinyl-glow" />
            <div className={`sync-vinyl-disc ${isPlaying && audioUnlocked ? 'spinning' : ''}`}>
              <img src={song.cover} alt={song.name} className="sync-vinyl-art" />
              <div className="sync-vinyl-hole" />
            </div>
          </div>

          <div className="sync-track-details">
            <h2 className="sync-track-title">{song.name}</h2>
            <p className="sync-track-artist">{song.artist}</p>
          </div>

          {/* Equalizer Wave Animation */}
          <div className="sync-eq-visualizer">
            {[...Array(16)].map((_, i) => (
              <div
                key={i}
                className={`sync-eq-bar ${isPlaying && audioUnlocked ? 'animating' : ''}`}
                style={{
                  animationDelay: `${(i * 0.12).toFixed(2)}s`,
                  animationDuration: `${0.8 + (i % 4) * 0.25}s`,
                }}
              />
            ))}
          </div>

          {nextSong && (
            <div className="sync-next-song-card">
              <span className="next-label">UP NEXT:</span>
              <span className="next-title">{nextSong.name}</span>
              <span className="next-artist">— {nextSong.artist}</span>
            </div>
          )}
        </div>

        {/* Right Column: Synchronized Karaoke Lyrics View */}
        <div className="sync-stage-right">
          <div className="sync-lyrics-header">
            <span className="sync-lyrics-title">🎙️ Synchronized Karaoke Lyrics</span>
            <button
              type="button"
              className="sync-lyrics-toggle-btn"
              onClick={() => setShowLyrics((p) => !p)}
            >
              {showLyrics ? 'Hide Lyrics' : 'Show Lyrics'}
            </button>
          </div>

          {showLyrics && (
            <div className="sync-lyrics-box" ref={lyricsContainerRef}>
              {isLyricsLoading ? (
                <div className="sync-lyrics-loading">
                  <div className="lyrics-shimmer-line" />
                  <div className="lyrics-shimmer-line" style={{ width: '80%' }} />
                  <div className="lyrics-shimmer-line" style={{ width: '60%' }} />
                  <p className="sync-lyrics-hint">Fetching synchronized vocal tracks...</p>
                </div>
              ) : lyricsData?.synced && lyricsData.lines && lyricsData.lines.length > 0 ? (
                <div className="sync-karaoke-stream">
                  {lyricsData.lines.map((line: LyricLine, idx: number) => {
                    const isActive = idx === activeLyricIndex;
                    const isPassed = idx < activeLyricIndex;
                    return (
                      <p
                        key={idx}
                        className={`sync-lyric-line sync-lyric-line-${idx} ${
                          isActive ? 'lyric-active' : isPassed ? 'lyric-passed' : 'lyric-upcoming'
                        }`}
                      >
                        {line.text}
                      </p>
                    );
                  })}
                </div>
              ) : lyricsData?.plainLyrics ? (
                <div className="sync-plain-lyrics">
                  {lyricsData.plainLyrics.split('\n').map((l, i) => (
                    <p key={i}>{l}</p>
                  ))}
                </div>
              ) : (
                <div className="sync-lyrics-empty">
                  <div className="sync-lyrics-empty-icon">🎵</div>
                  <p className="sync-lyrics-empty-title">Instrumental / No Synced Lyrics</p>
                  <p className="sync-lyrics-empty-sub">Enjoy the live broadcast beats!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Sync Transport Deck */}
      <div className="sync-transport-deck">
        <div className="sync-deck-inner">
          {/* Scrubber Progress Bar */}
          <div className="sync-progress-row">
            <span className="sync-time-stamp">{formatTime(currentTime)}</span>
            <div
              className="sync-progress-track-wrap"
              onClick={(e) => {
                if (!isHost || !onSeek) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const newPos = (clickX / rect.width) * (duration || 240);
                onSeek(newPos);
              }}
              style={{ cursor: isHost ? 'pointer' : 'default' }}
            >
              <div
                className="sync-progress-fill"
                style={{ width: `${Math.min(100, (currentTime / (duration || 240)) * 100)}%` }}
              />
            </div>
            <span className="sync-time-stamp">{formatTime(duration || 240)}</span>
          </div>

          {/* Controls & Volume Row */}
          <div className="sync-controls-row">
            <div className="sync-controls-left">
              {isHost && onTogglePlay && (
                <button
                  type="button"
                  className="sync-host-play-btn"
                  onClick={onTogglePlay}
                  title="Host DJ Play/Pause"
                >
                  {isPlaying ? '⏸️ DJ Pause' : '▶️ DJ Play'}
                </button>
              )}
              <span className="sync-mode-indicator">
                {isHost ? '👑 DJ In Control' : '🎧 Listener Mode (Auto-Synced)'}
              </span>
            </div>

            <div className="sync-controls-right">
              {/* Direct AI Smart Acoustics Button */}
              <button
                type="button"
                className={`control-btn ai-acoustics-btn ${aiSmartEq ? 'ai-acoustics-active' : ''}`}
                onClick={toggleAiSmartEq}
                aria-label="Toggle AI Smart Acoustics"
                title={
                  aiSmartEq && activeProfile
                    ? `✨ AI Smart Acoustics: ON (${activeProfile.name})`
                    : '✨ Turn ON AI Smart Acoustics'
                }
              >
                <span className="ai-btn-sparkle">✨</span>
                <span className="ai-btn-label">AI</span>
              </button>

              {/* Audio Enhancer EQ Button */}
              <button
                type="button"
                className={`control-btn eq-btn ${enhancerOpen ? 'eq-active' : ''}`}
                onClick={toggleEnhancer}
                aria-label="Audio Enhancer"
                title="Equalizer & Sound Effects"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="2" y="14" width="4" height="8" rx="1" />
                  <rect x="10" y="6" width="4" height="16" rx="1" />
                  <rect x="18" y="10" width="4" height="12" rx="1" />
                </svg>
              </button>

              {/* Volume Slider */}
              <div className="sync-volume-wrap">
                <button type="button" className="sync-mute-btn" onClick={toggleMute}>
                  {isMuted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                  className="sync-volume-slider"
                  title={`Volume: ${isMuted ? 0 : volume}%`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Enhancer Panel with 5-Band EQ & Spatial Reverb */}
      <AudioEnhancer
        engine={engine}
        isOpen={enhancerOpen}
        onClose={() => setEnhancerOpen(false)}
        aiSmartEq={aiSmartEq}
        onToggleAiSmartEq={toggleAiSmartEq}
        activeProfile={activeProfile}
      />

      {/* Emotion Visual Effects Overlay */}
      {visualsEnabled && song && (
        <EmotionOverlay
          songName={song.name}
          songArtist={song.artist}
          isMetadataLoaded={true}
          isPlaying={isPlaying}
          getLiveFeatures={engine.getLiveFeatures}
        />
      )}

      {/* AI Smart Acoustics Active Profile Toast Pill */}
      {aiToast && (
        <aside
          className="ai-acoustic-toast"
          aria-live="polite"
          role="status"
          aria-label={`AI Spatial Audio: ${aiToast.profile.name}`}
        >
          <div className="ai-toast-card">
            <span className="ai-toast-sparkle">✨</span>
            <div className="ai-toast-content">
              <div className="ai-toast-title">
                <span>{aiToast.profile.icon} {aiToast.profile.name}</span>
                <span className="ai-toast-tag">3D HEADPHONE</span>
              </div>
              <span className="ai-toast-desc">{aiToast.profile.tagline}</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
