'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Song } from '@/types/music';
import { EmotionType } from '@/components/EmotionOverlay';
import { AudioEngineControls } from '@/hooks/useAudioEngine';

interface CinemaModeProps {
  isActive: boolean;
  onClose: () => void;
  currentSong: Song;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  emotion: EmotionType;
  engine: AudioEngineControls;
  aiSmartEq: boolean;
  onToggleAiSmartEq: () => void;
  onOpenEnhancer: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function CinemaMode({
  isActive,
  onClose,
  currentSong,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  currentTime,
  duration,
  onSeek,
  emotion,
  engine,
  aiSmartEq,
  onToggleAiSmartEq,
}: CinemaModeProps) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Mouse idle detection: Auto-hide controls after 2.5 seconds of inactivity
  const handleMouseMove = useCallback(() => {
    setControlsVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (isPlaying && !isScrubbing) {
        setControlsVisible(false);
      }
    }, 2500);
  }, [isPlaying, isScrubbing]);

  useEffect(() => {
    if (!isActive) return;

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isActive, handleMouseMove]);

  // Fullscreen toggle helper with cross-browser support
  useEffect(() => {
    if (isActive) {
      const elem = document.documentElement;
      if (elem.requestFullscreen && !document.fullscreenElement) {
        elem.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isActive]);

  // Precise Seek & Drag Calculation
  const calculateSeekTime = useCallback((clientX: number): number => {
    if (!progressBarRef.current || !duration) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const width = rect.width;
    if (width <= 0) return 0;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    return percentage * duration;
  }, [duration]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsScrubbing(true);
    const newTime = calculateSeekTime(e.clientX);
    setScrubTime(newTime);
    onSeek(newTime);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const targetTime = calculateSeekTime(moveEvent.clientX);
      setScrubTime(targetTime);
      onSeek(targetTime);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      const finalTime = calculateSeekTime(upEvent.clientX);
      onSeek(finalTime);
      setIsScrubbing(false);
      setScrubTime(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  if (!isActive) return null;

  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div
      className={`cinema-overlay emotion-cinema-${emotion || 'soft_romantic'} ${controlsVisible ? 'controls-shown' : 'controls-hidden'}`}
      onMouseMove={handleMouseMove}
      aria-label="Cinema Fullscreen Immersion"
    >
      {/* Top Floating Bar: Shows current song name & artist in place of Deluxe Cinema Immersion */}
      <div className={`cinema-top-bar ${controlsVisible ? 'bar-visible' : 'bar-hidden'}`}>
        <div className="cinema-brand">
          <span className="cinema-sparkle">✨</span>
          <span className="cinema-brand-title">{currentSong.name}</span>
          {currentSong.artist && (
            <span className="cinema-brand-artist">• {currentSong.artist}</span>
          )}
        </div>
        <div className="cinema-top-actions">
          <button
            type="button"
            className="cinema-exit-btn"
            onClick={onClose}
            title="Exit Cinema Mode (Esc / F)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
            </svg>
            <span>Exit (F)</span>
          </button>
        </div>
      </div>

      {/* Main Center Stage: Full spinning circular album cover (spinning like outside player) */}
      <div className="cinema-stage stage-centered">
        <div className="cinema-vinyl-wrap">
          <div className={`cinema-vinyl-glow aura-emotion-${emotion || 'soft_romantic'}`} />
          
          <div className="cinema-album-wrapper">
            <div className={`cinema-album-art ${isPlaying ? 'playing' : ''}`}>
              <Image
                src={currentSong.cover}
                alt={currentSong.name}
                width={300}
                height={300}
                className="cinema-cover-img"
                priority
                unoptimized
              />
            </div>
            <div className="cinema-vinyl-hole" />
          </div>

          <div className="cinema-song-meta">
            <h2 className="cinema-song-title">{currentSong.name}</h2>
            <p className="cinema-artist-name">{currentSong.artist}</p>
          </div>
        </div>
      </div>

      {/* Bottom Floating Glass Control Deck */}
      <div className={`cinema-control-deck ${controlsVisible ? 'deck-visible' : 'deck-hidden'}`}>
        <div className="cinema-deck-glass">
          {/* Progress Timeline with smooth forward/backward seek & drag */}
          <div className="cinema-progress-row">
            <span className="cinema-time-current">{formatTime(displayTime)}</span>
            <div
              className="cinema-progress-bar"
              ref={progressBarRef}
              onPointerDown={handlePointerDown}
            >
              <div className="cinema-progress-track">
                <div
                  className="cinema-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div
                className="cinema-progress-thumb"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
            <span className="cinema-time-duration">{formatTime(duration)}</span>
          </div>

          {/* Controls Buttons */}
          <div className="cinema-buttons-row">
            <div className="cinema-left-actions">
              <button
                type="button"
                className={`cinema-tool-btn ${aiSmartEq ? 'cinema-ai-active' : ''}`}
                onClick={onToggleAiSmartEq}
                title="Toggle AI Smart Acoustics"
              >
                <span className="ai-btn-sparkle">✨</span>
                <span>AI Smart EQ</span>
              </button>
            </div>

            <div className="cinema-main-transport">
              <button
                type="button"
                className="cinema-transport-btn prev"
                onClick={onPrev}
                aria-label="Previous track"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              <button
                type="button"
                className="cinema-play-btn"
                onClick={onTogglePlay}
                aria-label="Play / Pause"
              >
                {isPlaying ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="cinema-transport-btn next"
                onClick={onNext}
                aria-label="Next track"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 6h2v12h-2zm-2 6L5.5 6v12z" />
                </svg>
              </button>
            </div>

            <div className="cinema-right-actions">
              <div className="cinema-volume-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.7">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={engine.state.volume}
                  onChange={(e) => engine.setVolume(parseInt(e.target.value))}
                  className="cinema-volume-slider"
                  title={`Volume: ${engine.state.volume}%`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
