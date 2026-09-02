'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExploreSong } from '@/types/explore';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import AudioEnhancer from '@/components/AudioEnhancer';
import SongArtwork from '@/components/explore/SongArtwork';
import ImmersivePlayer from '@/components/explore/ImmersivePlayer';
import SourceQualityBadge from '@/components/explore/SourceQualityBadge';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Play, Pause, SkipBack, SkipForward, SlidersHorizontal, Playlist, X } from '@phosphor-icons/react';

interface ExplorePlayerDeckProps {
  currentSong: ExploreSong | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextSong?: () => void;
  onPrevSong?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  upcomingQueue?: ExploreSong[];
  historyStack?: ExploreSong[];
  onSelectFromQueue?: (song: ExploreSong) => void;
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
  historyStack = [],
  onSelectFromQueue,
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
    } catch { }
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
  const [isImmersive, setIsImmersive] = useState<boolean>(true); // Default to immersive when playing starts

  // Web Audio DSP Engine integration
  const engine = useAudioEngine(audioRef);
  const [enhancerOpen, setEnhancerOpen] = useState<boolean>(false);

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
      audioRef.current.play().catch(() => { });
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
      if (engineRef.current.isInitialized) {
        audioRef.current.volume = 1.0;
        engineRef.current.setVolume(isMuted ? 0 : volume);
      } else {
        audioRef.current.volume = isMuted ? 0 : volume / 100;
      }
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
      } catch { }
    }
    if (engineRef.current.isInitialized) {
      if (audioRef.current) audioRef.current.volume = 1.0;
      engineRef.current.setVolume(clamped);
    } else {
      if (audioRef.current) audioRef.current.volume = clamped / 100;
    }
    showToast(`Volume: ${clamped}%`, clamped === 0 ? '🔇' : clamped < 50 ? '🔉' : '🔊');
  }, [showToast]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const targetVol = nextMuted ? 0 : volume;
    if (engineRef.current.isInitialized) {
      if (audioRef.current) audioRef.current.volume = 1.0;
      engineRef.current.setVolume(targetVol);
    } else {
      if (audioRef.current) audioRef.current.volume = targetVol / 100;
    }
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
                <SongArtwork
                  cover={currentSong.cover}
                  name={currentSong.name}
                  songId={currentSong.id}
                  className="spotify-queue-thumb"
                />
                <div className="spotify-queue-info">
                  <div className="spotify-queue-name-row">
                    <span className="spotify-queue-song-name active">{currentSong.name}</span>
                    <SourceQualityBadge
                      source={currentSong.source}
                      sourceBadge={currentSong.sourceBadge}
                      quality={currentSong.quality}
                      size="sm"
                    />
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
                  Next in Queue
                </span>
                <span className="spotify-queue-count">{upcomingQueue.length} songs</span>
              </div>

              {upcomingQueue.length === 0 ? (
                <div className="spotify-queue-empty">
                  <span>No more songs in queue.</span>
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
                      <SongArtwork
                        cover={song.cover}
                        name={song.name}
                        songId={song.id}
                        className="spotify-queue-thumb"
                      />
                      <div className="spotify-queue-info">
                        <div className="spotify-queue-name-row">
                          <span className="spotify-queue-song-name">{song.name}</span>
                          <SourceQualityBadge
                            source={song.source}
                            sourceBadge={song.sourceBadge}
                            quality={song.quality}
                            size="sm"
                          />
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

      <motion.div
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-4xl z-[100] fluid-pill-nav",
          "flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isImmersive ? "pointer-events-none" : ""
        )}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: isImmersive ? 120 : 0, opacity: isImmersive ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
      >
        <audio
          ref={audioRef}
          crossOrigin="anonymous"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={() => setIsLoadingAudio(false)}
          onWaiting={() => setIsLoadingAudio(true)}
          onEnded={handleSongEnded}
          onError={async () => {
            setIsLoadingAudio(false);
            const err = audioRef.current?.error;
            let codeLabel = 'Stream error';
            if (err) {
              if (err.code === 1) codeLabel = 'Aborted';
              else if (err.code === 2) codeLabel = 'Network error';
              else if (err.code === 3) codeLabel = 'Decode error';
              else if (err.code === 4) codeLabel = 'Unsupported/404';
            }
            let httpStatus = '';
            try {
              if (currentSong?.streamUrl) {
                const check = await fetch(currentSong.streamUrl, { method: 'HEAD' });
                if (!check.ok) httpStatus = ` [HTTP ${check.status}]`;
              }
            } catch { }
            showToast(`${codeLabel}${httpStatus}. Tap to retry.`, '⚠️');
          }}
          preload="auto"
        />

        {/* Thin progress scrubber line at the top for mobile */}
        <div
          className="w-full h-[2px] md:hidden bg-white/10 cursor-pointer relative overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className="absolute top-0 left-0 h-full bg-[#1db954]"
            style={{ width: `${Math.min(100, (currentTime / (duration || currentSong.duration || 240)) * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 gap-2">
          {/* Left: Artwork & Info (Tap anywhere to open Immersive Player) */}
          <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer flex-1 min-w-0 md:w-1/3 md:flex-initial" onClick={() => setIsImmersive(true)}>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-lg relative group">
              <SongArtwork
                cover={currentSong.cover}
                name={currentSong.name}
                songId={currentSong.id}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-white font-bold text-xs sm:text-sm truncate" title={currentSong.name}>
                {currentSong.name}
              </span>
              <span className="text-white/60 text-[11px] sm:text-xs truncate mt-0.5" title={currentSong.artist}>
                {currentSong.artist}
              </span>
            </div>
          </div>

          {/* Center: Desktop Controls & Scrubber */}
          <div className="hidden md:flex flex-col items-center justify-center flex-1 max-w-md px-3">
            <div className="flex items-center gap-4 mb-1">
              <button
                type="button"
                className="text-white/60 hover:text-white transition-colors disabled:opacity-30 active:scale-95"
                onClick={handlePrevClick}
                disabled={!hasPrev && currentTime < 3}
              >
                <SkipBack size={20} weight="light" />
              </button>

              <button
                type="button"
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_4px_16px_rgba(255,255,255,0.2)]"
                onClick={onTogglePlay}
              >
                {isLoadingAudio ? (
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause size={20} weight="fill" />
                ) : (
                  <Play size={20} weight="fill" className="ml-0.5" />
                )}
              </button>

              <button
                type="button"
                className="text-white/60 hover:text-white transition-colors disabled:opacity-30 active:scale-95"
                onClick={onNextSong}
                disabled={!hasNext}
              >
                <SkipForward size={20} weight="light" />
              </button>
            </div>

            <div className="flex items-center w-full gap-2.5 text-[11px] text-white/50 font-mono">
              <span className="w-8 text-right">{formatTime(currentTime)}</span>
              <div
                className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer relative overflow-hidden group"
                onClick={handleSeek}
              >
                <div
                  className="absolute top-0 left-0 h-full bg-white/90 group-hover:bg-[#1db954] rounded-full"
                  style={{ width: `${Math.min(100, (currentTime / (duration || currentSong.duration || 240)) * 100)}%` }}
                />
              </div>
              <span className="w-8">{formatTime(duration || currentSong.duration || 240)}</span>
            </div>
          </div>

          {/* Right: Actions & Mobile Transport */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-3 shrink-0 md:w-1/3">
            {/* Mobile Play/Pause & Next */}
            <div className="flex md:hidden items-center gap-1">
              <button
                type="button"
                className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center active:scale-90 transition-all shadow-md"
                onClick={onTogglePlay}
              >
                {isLoadingAudio ? (
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause size={17} weight="fill" />
                ) : (
                  <Play size={17} weight="fill" className="ml-0.5" />
                )}
              </button>

              <button
                type="button"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-all"
                onClick={onNextSong}
                disabled={!hasNext}
              >
                <SkipForward size={18} weight="fill" />
              </button>
            </div>

            <button
              type="button"
              className={cn("hidden sm:flex text-white/60 hover:text-white active:scale-95 transition-all", enhancerOpen && "text-[#1db954]")}
              onClick={() => {
                engine.initEngine();
                setEnhancerOpen(true);
              }}
              title="Sound Studio"
            >
              <SlidersHorizontal size={18} />
            </button>
            <button
              type="button"
              className={cn("text-white/60 hover:text-white active:scale-95 transition-all p-1.5", queueOpen && "text-[#1db954]")}
              onClick={() => setQueueOpen((o) => !o)}
              title="Queue"
            >
              <Playlist size={19} />
            </button>
            {onClose && (
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 transition-all active:scale-90"
                onClick={onClose}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Keep ImmersivePlayer mounted outside the fluid-pill-nav to maintain its fixed inset behavior */ }
      <AnimatePresence>
  {
    isImmersive && (
      <ImmersivePlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onNextSong={onNextSong}
        onPrevSong={handlePrevClick}
        upcomingQueue={upcomingQueue}
        historyStack={historyStack}
        onMinimize={() => setIsImmersive(false)}
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={handleVolumeChange}
        onToggleMute={toggleMute}
        onOpenEnhancer={() => {
          engine.initEngine();
          setEnhancerOpen(true);
        }}
        onToggleQueue={() => setQueueOpen((o) => !o)}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        isLoadingAudio={isLoadingAudio}
        formatTime={formatTime}
      />
    )
  }
      </AnimatePresence>

      {/* Audio Enhancer Modal */}
      <AudioEnhancer
        engine={engine}
        isOpen={enhancerOpen}
        onClose={() => setEnhancerOpen(false)}
        hideAi={true}
      />
    </>
  );
}
