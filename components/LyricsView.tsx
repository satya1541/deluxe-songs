'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LyricLine, LyricsData } from '@/types/lyrics';

interface LyricsViewProps {
  songName: string;
  songArtist?: string;
  currentTime: number;
  duration?: number;
  onSeek: (time: number) => void;
  isMetadataLoaded?: boolean;
  themeEmotion?: string;
}

export default function LyricsView({
  songName,
  songArtist = '',
  currentTime,
  duration = 0,
  onSeek,
  isMetadataLoaded = true,
}: LyricsViewProps) {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLParagraphElement | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch lyrics when song changes, duration is known & metadata is confirmed
  useEffect(() => {
    if (!isMetadataLoaded || !songName) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchLyrics = async () => {
      try {
        let url = `/api/lyrics?name=${encodeURIComponent(songName)}&artist=${encodeURIComponent(songArtist || '')}`;
        if (duration > 0) {
          url += `&duration=${Math.round(duration)}`;
        }
        const res = await fetch(url);
        if (res.ok && isMounted) {
          const data: LyricsData = await res.json();
          setLyrics(data);
        } else if (isMounted) {
          setLyrics({ synced: false, lines: [], source: 'none' });
        }
      } catch (err) {
        console.error('Failed to fetch lyrics:', err);
        if (isMounted) {
          setLyrics({ synced: false, lines: [], source: 'none' });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchLyrics();

    return () => {
      isMounted = false;
    };
  }, [songName, songArtist, isMetadataLoaded, duration]);

  // Compute active lyric line index based on playback currentTime
  const activeIndex = useMemo(() => {
    if (!lyrics || !lyrics.synced || lyrics.lines.length === 0) return -1;

    let index = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (currentTime >= lyrics.lines[i].time) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [lyrics, currentTime]);

  // Compute progressive karaoke sweep percentage for active line
  const activeSweepProgress = useMemo(() => {
    if (!lyrics || !lyrics.synced || activeIndex === -1) return '0%';

    const currentLine = lyrics.lines[activeIndex];
    const nextLine = lyrics.lines[activeIndex + 1];
    const lineStart = currentLine.time;
    // Estimate line duration based on next line timestamp or natural singing pace (default 3.8s)
    const lineEnd = nextLine ? Math.min(nextLine.time, lineStart + 6.0) : lineStart + 3.8;
    const duration = Math.max(0.6, lineEnd - lineStart);
    const elapsed = Math.max(0, currentTime - lineStart);
    const ratio = Math.min(1, elapsed / duration);

    return `${(ratio * 100).toFixed(1)}%`;
  }, [lyrics, activeIndex, currentTime]);

  // Auto-scroll to active lyric line smoothly
  useEffect(() => {
    if (isUserScrolling || activeIndex === -1 || !activeLineRef.current || !containerRef.current) return;

    activeLineRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeIndex, isUserScrolling]);

  // Detect user manual scroll to prevent fighting scroll position for 3.5s
  const handleUserScroll = useCallback(() => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3500);
  }, []);

  if (isLoading) {
    return (
      <div className="lyrics-container lyrics-loading" aria-label="Loading Lyrics">
        <div className="lyrics-shimmer-line" style={{ width: '65%' }} />
        <div className="lyrics-shimmer-line" style={{ width: '80%' }} />
        <div className="lyrics-shimmer-line" style={{ width: '55%' }} />
        <div className="lyrics-shimmer-line" style={{ width: '75%' }} />
        <div className="lyrics-shimmer-line" style={{ width: '60%' }} />
      </div>
    );
  }

  // If no lyrics available
  if (!lyrics || (!lyrics.synced && !lyrics.plainLyrics)) {
    return (
      <div className="lyrics-container lyrics-empty">
        <div className="lyrics-empty-card">
          <span className="lyrics-empty-icon">♪</span>
          <p className="lyrics-empty-title">Instrumental / No Lyrics Available</p>
          <p className="lyrics-empty-desc">Enjoy the melody and acoustics</p>
        </div>
      </div>
    );
  }

  // Plain (un-synced) lyrics view
  if (!lyrics.synced && lyrics.plainLyrics) {
    return (
      <div className="lyrics-container lyrics-plain" ref={containerRef}>
        <div className="lyrics-plain-text">
          {lyrics.plainLyrics.split(/\r?\n/).map((line, i) => (
            <p key={i} className="lyric-plain-line">
              {line || '\u00A0'}
            </p>
          ))}
        </div>
      </div>
    );
  }

  // Studio-Synchronized Lyrics with Progressive Karaoke Sweep
  return (
    <div
      className="lyrics-container lyrics-synced"
      ref={containerRef}
      onScroll={handleUserScroll}
      onTouchMove={handleUserScroll}
      onWheel={handleUserScroll}
    >
      <div className="lyrics-scroll-track">
        {lyrics.lines.map((line, idx) => {
          const isActive = idx === activeIndex;
          const isPast = idx < activeIndex;
          const isUpcoming = idx > activeIndex;

          return (
            <p
              key={idx}
              ref={isActive ? activeLineRef : null}
              className={`lyric-line ${
                isActive ? 'lyric-active' : isPast ? 'lyric-past' : 'lyric-upcoming'
              }`}
              style={
                isActive
                  ? ({
                      '--sweep-progress': activeSweepProgress,
                    } as React.CSSProperties)
                  : undefined
              }
              onClick={() => onSeek(line.time)}
              title={`Jump to ${Math.floor(line.time / 60)}:${Math.floor(line.time % 60)
                .toString()
                .padStart(2, '0')}`}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}
