'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExploreSong } from '@/types/explore';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import AudioEnhancer from '@/components/AudioEnhancer';
import { EmotionData } from '@/lib/emotions';

interface ExplorePlayerDeckProps {
  currentSong: ExploreSong | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextSong?: () => void;
  onPrevSong?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  upcomingQueue?: ExploreSong[];
  activeEmotionData?: EmotionData | null;
  onSelectFromQueue?: (song: ExploreSong) => void;
  aiRecEnabled?: boolean;
  onToggleAiRec?: () => void;
  onClose?: () => void;
}

export default function ExplorePlayerDeck({
  currentSong,
  isPlaying,
  onTogglePlay,
  onNextSong,
  onPrevSong,
  hasNext = false,
  hasPrev = false,
  upcomingQueue = [],
  activeEmotionData,
  onSelectFromQueue,
  aiRecEnabled = false,
  onToggleAiRec,
  onClose,
}: ExplorePlayerDeckProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === 'undefined') return 50;
    try {
      const saved = localStorage.getItem('deluxe_explore_volume');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (parsed === 80) return 50; // migrate previous 80% default to 50%
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
      }
    } catch {}
    return 50;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [isVolHovered, setIsVolHovered] = useState<boolean>(false);
  const [queueOpen, setQueueOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIcon, setToastIcon] = useState<string>('🔊');
  const [isAiToast, setIsAiToast] = useState<boolean>(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Web Audio DSP Engine integration
  const engine = useAudioEngine(audioRef);
  const [enhancerOpen, setEnhancerOpen] = useState<boolean>(false);
  const activeEmotion = activeEmotionData;

  // Stable refs to prevent re-triggering effects on volume/engine churn
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const onNextSongRef = useRef(onNextSong);
  onNextSongRef.current = onNextSong;

  const showToast = useCallback((msg: string, icon: string = '🔊') => {
    setToastMessage(msg);
    setToastIcon(icon);
    setIsAiToast(false);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  }, []);

  // Load and play song when currentSong changes ONLY
  const prevSongIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentSong || !audioRef.current) return;
    if (prevSongIdRef.current === currentSong.id && audioRef.current.src.includes(currentSong.streamUrl)) return;
    prevSongIdRef.current = currentSong.id;

    const audio = audioRef.current;
    setIsLoadingAudio(true);
    audio.src = currentSong.streamUrl;
    audio.volume = isMutedRef.current ? 0 : volumeRef.current / 100;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsLoadingAudio(false);
        })
        .catch((err) => {
          setIsLoadingAudio(false);
          if (err?.name === 'NotAllowedError') {
            showToast('Tap ▶️ to start audio', '▶️');
          }
        });
    }
  }, [currentSong?.id, currentSong?.streamUrl]);

  // Handle Play / Pause toggle sync (prevent duplicate concurrent play calls on song change)
  const prevIsPlayingRef = useRef<boolean>(isPlaying);
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    if (prevIsPlayingRef.current === isPlaying) return;
    prevIsPlayingRef.current = isPlaying;

    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentSong]);

  // Audio Event Handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || currentSong?.duration || 240);
      audioRef.current.volume = isMuted ? 0 : volume / 100;
      setIsLoadingAudio(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPos = (clickX / rect.width) * (duration || currentSong?.duration || 240);
    audioRef.current.currentTime = newPos;
    setCurrentTime(newPos);
  };

  // Safe volume changer
  const handleVolumeChange = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(100, newVol));
    setVolume(clamped);
    setIsMuted(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('deluxe_explore_volume', String(clamped));
      } catch {}
    }
    if (audioRef.current) {
      audioRef.current.volume = clamped / 100;
    }
    engineRef.current.setVolume(clamped);
    showToast(`Volume: ${clamped}%`, clamped === 0 ? '🔇' : clamped < 50 ? '🔉' : '🔊');
  }, [showToast]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.volume = nextMuted ? 0 : volume / 100;
    }
    engineRef.current.setVolume(nextMuted ? 0 : volume);
    showToast(nextMuted ? 'Muted' : `Volume: ${volume}%`, nextMuted ? '🔇' : '🔊');
  }, [isMuted, volume, showToast]);

  // Seamless auto-advance to next same-emotion song when track finishes
  const handleSongEnded = () => {
    if (onNextSongRef.current) {
      onNextSongRef.current();
    }
  };

  // Previous button handler (restarts if playing > 3s, else calls onPrevSong)
  const handlePrevClick = () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (onPrevSong) {
      onPrevSong();
    }
  };

  // Keyboard shortcut listener: Up/Down for volume, Space for play/pause, N for next, P for prev
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange(volumeRef.current + 5);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(volumeRef.current - 5);
      } else if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if ((e.key === 'n' || e.key === 'N') && onNextSong) {
        e.preventDefault();
        onNextSong();
      } else if ((e.key === 'p' || e.key === 'P') && onPrevSong) {
        e.preventDefault();
        handlePrevClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleVolumeChange, onTogglePlay, onNextSong, onPrevSong]);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  const displayVolume = isMuted ? 0 : volume;

  return (
    <>
      {/* Floating HUD Notification for Volume / AI Changes */}
      {toastMessage && (
        <div className={`spotify-hud-toast ${isAiToast ? 'toast-ai' : ''}`}>
          <span className="toast-icon">{toastIcon}</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Spotify Queue Drawer Flyout */}
      {queueOpen && (
        <div className="spotify-queue-drawer">
          <div className="spotify-queue-header">
            <div className="spotify-queue-title-block">
              <h3 className="spotify-queue-heading">Queue</h3>
              {activeEmotion && (
                <span className="spotify-queue-emotion-pill">
                  {activeEmotion.icon} {activeEmotion.label}
                </span>
              )}
              {onToggleAiRec && (
                <button
                  type="button"
                  className={`spotify-queue-ai-toggle ${aiRecEnabled ? 'active' : ''}`}
                  onClick={onToggleAiRec}
                  title={
                    aiRecEnabled
                      ? 'AI Recommendation: ON (Gemini AI DJ) • Click to turn OFF & save tokens'
                      : 'AI Recommendation: OFF (Fast Multi-Source) • Click to turn ON'
                  }
                >
                  <span className="spotify-ai-toggle-dot" />
                  <span>{aiRecEnabled ? '✨ AI Rec: ON' : '⚡ AI Rec: OFF'}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              className="spotify-queue-close-btn"
              onClick={() => setQueueOpen(false)}
              aria-label="Close queue"
            >
              ✕
            </button>
          </div>

          <div className="spotify-queue-body">
            {/* Now Playing */}
            <div className="spotify-queue-section">
              <span className="spotify-queue-section-label">Now Playing</span>
              <div className="spotify-queue-item active">
                <img
                  src={currentSong.cover}
                  alt={currentSong.name}
                  className="spotify-queue-thumb"
                />
                <div className="spotify-queue-info">
                  <div className="spotify-queue-name-row">
                    <span className="spotify-queue-song-name active">{currentSong.name}</span>
                    {currentSong.sourceBadge && (
                      <span
                        className="spotify-queue-source-pill"
                        style={{
                          backgroundColor: currentSong.sourceBadge.bg,
                          color: currentSong.sourceBadge.color,
                          borderColor: currentSong.sourceBadge.border,
                        }}
                        title={`${currentSong.sourceBadge.name} (${currentSong.sourceBadge.qualityLabel})`}
                      >
                        {currentSong.sourceBadge.icon} {currentSong.sourceBadge.name} • {currentSong.sourceBadge.qualityLabel}
                      </span>
                    )}
                  </div>
                  <span className="spotify-queue-artist-name">{currentSong.artist}</span>
                </div>
                <div className="spotify-eq-bars-mini">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>

            {/* Next from same emotion */}
            <div className="spotify-queue-section">
              <div className="spotify-queue-section-header">
                <span className="spotify-queue-section-label">
                  Next from: {activeEmotion?.label || 'Same Emotion'}
                </span>
                <span className="spotify-queue-count">{upcomingQueue.length} songs</span>
              </div>

              {upcomingQueue.length === 0 ? (
                <div className="spotify-queue-empty">
                  <span>Finding matching vibe songs...</span>
                </div>
              ) : (
                <div className="spotify-queue-list">
                  {upcomingQueue.map((song, idx) => (
                    <div
                      key={`${song.id}-${idx}`}
                      className="spotify-queue-item"
                      onClick={() => {
                        if (onSelectFromQueue) {
                          onSelectFromQueue(song);
                        }
                      }}
                    >
                      <span className="spotify-queue-index">{idx + 1}</span>
                      <img
                        src={song.cover}
                        alt={song.name}
                        className="spotify-queue-thumb"
                      />
                      <div className="spotify-queue-info">
                        <div className="spotify-queue-name-row">
                          <span className="spotify-queue-song-name">{song.name}</span>
                          {song.sourceBadge && (
                            <span
                              className="spotify-queue-source-pill"
                              style={{
                                backgroundColor: song.sourceBadge.bg,
                                color: song.sourceBadge.color,
                                borderColor: song.sourceBadge.border,
                              }}
                              title={`${song.sourceBadge.name} (${song.sourceBadge.qualityLabel})`}
                            >
                              {song.sourceBadge.icon} {song.sourceBadge.name} • {song.sourceBadge.qualityLabel}
                            </span>
                          )}
                        </div>
                        <span className="spotify-queue-artist-name">{song.artist}</span>
                      </div>
                      <span className="spotify-queue-duration">
                        {formatTime(song.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="spotify-bottom-player-bar">
        <audio
          ref={audioRef}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={() => setIsLoadingAudio(false)}
          onWaiting={() => setIsLoadingAudio(true)}
          onEnded={handleSongEnded}
          onError={() => {
            setIsLoadingAudio(false);
            const err = audioRef.current?.error;
            if (err) {
              showToast('Audio stream interrupted. Tap to retry.', '⚠️');
            }
          }}
          preload="auto"
        />

        {/* Mobile Top-Edge Micro Progress Bar (Hidden on Desktop) */}
        <div className="spotify-mobile-micro-progress" onClick={handleSeek}>
          <div
            className="spotify-mobile-micro-progress-fill"
            style={{
              width: `${Math.min(100, (currentTime / (duration || currentSong.duration || 240)) * 100)}%`,
            }}
          />
        </div>

        <div className="spotify-player-inner">
          {/* Left: 56px Artwork, Title, Artist, & 320k Tag */}
          <div className="spotify-player-left">
            <img
              src={currentSong.cover}
              alt={currentSong.name}
              className="spotify-player-thumb"
            />
            <div className="spotify-player-track-info">
              <div className="spotify-player-title-row">
                <span className="spotify-player-title" title={currentSong.name}>
                  {currentSong.name}
                </span>
                <img
                  src="/hires-audio.jpg"
                  alt="Hi-Res Audio"
                  className="spotify-player-hires-logo"
                  title="Hi-Res Audio • FLAC (24 bit, 192 kHz, Stereo)"
                />
                {currentSong.sourceBadge && (
                  <span
                    className="spotify-player-source-pill"
                    style={{
                      backgroundColor: currentSong.sourceBadge.bg,
                      color: currentSong.sourceBadge.color,
                      borderColor: currentSong.sourceBadge.border,
                    }}
                    title={`Playing via ${currentSong.sourceBadge.name} (${currentSong.sourceBadge.qualityLabel})`}
                  >
                    {currentSong.sourceBadge.icon} {currentSong.sourceBadge.name}
                  </span>
                )}
              </div>
              <span className="spotify-player-artist" title={currentSong.artist}>
                {currentSong.artist}
              </span>
            </div>
          </div>

          {/* Center: Controls & Scrubber */}
          <div className="spotify-player-center">
            <div className="spotify-player-controls-row">
              {/* Previous Track */}
              <button
                type="button"
                className={`spotify-transport-btn ${!hasPrev ? 'btn-disabled' : ''}`}
                onClick={handlePrevClick}
                disabled={!hasPrev && currentTime < 3}
                aria-label="Previous track (P)"
                title="Previous track (P)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              {/* Play/Pause Main Button */}
              <button
                type="button"
                className="spotify-main-play-btn"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isLoadingAudio ? (
                  <span className="spotify-spinner-mini" />
                ) : isPlaying ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#000000">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#000000">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Next Track */}
              <button
                type="button"
                className={`spotify-transport-btn ${!hasNext ? 'btn-disabled' : ''}`}
                onClick={onNextSong}
                disabled={!hasNext}
                aria-label="Next track (N)"
                title="Next track (N)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>

              {/* Audio Enhancer EQ Button */}
              <button
                type="button"
                className={`spotify-icon-button ${enhancerOpen ? 'button-spotify-active' : ''}`}
                onClick={() => {
                  engine.initEngine();
                  setEnhancerOpen(true);
                }}
                aria-label="Audio Enhancer"
                title="Equalizer & Sound Effects"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="2" y="14" width="4" height="8" rx="1" />
                  <rect x="10" y="6" width="4" height="16" rx="1" />
                  <rect x="18" y="10" width="4" height="12" rx="1" />
                </svg>
              </button>
            </div>

            {/* Progress Row */}
            <div className="spotify-playback-bar-wrap">
              <span className="spotify-time-text">{formatTime(currentTime)}</span>
              <div className="spotify-progress-bar-container" onClick={handleSeek}>
                <div
                  className="spotify-progress-bar-fill"
                  style={{
                    width: `${Math.min(100, (currentTime / (duration || currentSong.duration || 240)) * 100)}%`,
                  }}
                />
              </div>
              <span className="spotify-time-text">
                {formatTime(duration || currentSong.duration || 240)}
              </span>
            </div>
          </div>

          {/* Right: Volume, Queue & Dismiss */}
          <div className="spotify-player-right">
            {/* Hi-Res Audio Quality Pill */}
            <div
              className="spotify-player-hires-pill"
              title="Hi-Res Audio • FLAC (24 bit, 192 kHz, Stereo)"
            >
              <img
                src="/hires-audio.jpg"
                alt="Hi-Res Audio"
                className="spotify-player-hires-pill-img"
              />
              <span className="spotify-player-hires-pill-text">Hi-Res</span>
            </div>

            {/* Queue Drawer Button */}
            <button
              type="button"
              className={`spotify-queue-btn ${queueOpen ? 'button-spotify-active' : ''}`}
              onClick={() => setQueueOpen((o) => !o)}
              title="Queue & Upcoming Songs"
              aria-label="Queue & Upcoming Songs"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              {upcomingQueue.length > 0 && (
                <span className="spotify-queue-badge">{upcomingQueue.length}</span>
              )}
            </button>

            <div
              className="spotify-volume-container"
              onMouseEnter={() => setIsVolHovered(true)}
              onMouseLeave={() => setIsVolHovered(false)}
            >
              <button
                type="button"
                className="spotify-vol-btn"
                onClick={toggleMute}
                aria-label={isMuted || displayVolume === 0 ? 'Unmute' : 'Mute'}
                title={isMuted || displayVolume === 0 ? 'Unmute' : 'Mute'}
              >
                {isMuted || displayVolume === 0 ? '🔇' : displayVolume < 50 ? '🔉' : '🔊'}
              </button>

              {/* Spotify-style two-tone filled volume track */}
              <input
                type="range"
                min="0"
                max="100"
                value={displayVolume}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
                className="spotify-vol-slider"
                style={{
                  background: `linear-gradient(to right, ${
                    isVolHovered ? '#1ed760' : '#ffffff'
                  } 0%, ${
                    isVolHovered ? '#1ed760' : '#ffffff'
                  } ${displayVolume}%, #4d4d4d ${displayVolume}%, #4d4d4d 100%)`,
                }}
                title={`Volume: ${displayVolume}% (Press Up/Down to adjust)`}
              />

              <span className="spotify-vol-percent-label">{displayVolume}%</span>
            </div>

            {onClose && (
              <button
                type="button"
                className="spotify-close-player-btn"
                onClick={onClose}
                title="Close player"
                aria-label="Close player"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Audio Enhancer Modal */}
        <AudioEnhancer
          engine={engine}
          isOpen={enhancerOpen}
          onClose={() => setEnhancerOpen(false)}
          hideAi={true}
        />
      </div>
    </>
  );
}
