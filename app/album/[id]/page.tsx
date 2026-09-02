'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExploreSong } from '@/types/explore';
import { SaavnAlbumDetails } from '@/lib/saavn-stream';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import SongArtwork from '@/components/explore/SongArtwork';

export default function AlbumPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { currentSong, isPlaying, playSong, togglePlay } = useGlobalAudio();

  const [album, setAlbum] = useState<SaavnAlbumDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAlbum() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/explore/album/${encodeURIComponent(params.id)}`);
        const data = await res.json();
        if (data.success && data.album) {
          setAlbum(data.album);
        } else {
          setError(data.error || 'Album not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load album details');
      } finally {
        setIsLoading(false);
      }
    }
    loadAlbum();
  }, [params.id]);

  const handlePlayAll = useCallback(() => {
    if (!album || !album.songs || album.songs.length === 0) return;
    const isPlayingAlbum = isPlaying && album.songs.some((s) => s.id === currentSong?.id);
    if (isPlayingAlbum) {
      togglePlay();
      return;
    }
    const firstSong = album.songs[0];
    playSong(firstSong, album.songs.slice(1));
  }, [album, isPlaying, currentSong, togglePlay, playSong]);

  const handlePlaySong = useCallback((song: ExploreSong, index: number) => {
    if (!album || !album.songs) return;
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    playSong(song, album.songs.slice(index + 1));
  }, [album, currentSong, togglePlay, playSong]);

  const formatDuration = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="artist-page-container loading-state">
        <div className="artist-loading-spinner" />
        <p>Loading album...</p>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="artist-page-container error-state">
        <button onClick={() => router.back()} className="artist-back-btn">
          ← Back
        </button>
        <div className="artist-error-box">
          <h2>Album Not Found</h2>
          <p>{error || 'Unable to load details for this album.'}</p>
          <Link href="/" className="artist-home-link">
            Return to Explore
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="artist-page-container">
      {/* Top Ambient Backdrop */}
      <div
        className="artist-hero-backdrop"
        style={{ backgroundImage: `url(${album.image})` }}
      />
      <div className="artist-hero-gradient" />

      {/* Top Navigation */}
      <header className="artist-nav-bar">
        <button onClick={() => router.back()} className="artist-back-btn" title="Go Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Back</span>
        </button>
        <div className="artist-nav-title">{album.name}</div>
        <div className="artist-nav-hires" title="Master Quality Audio Lossless">
          <img src="/lossless-logo.jpeg" alt="Lossless" style={{ borderRadius: '3px', objectFit: 'contain' }} />
        </div>
      </header>

      {/* Album Hero Section */}
      <div className="artist-hero-section album-hero">
        <div className="artist-hero-avatar-wrap album-cover-wrap">
          <img src={album.image} alt={album.name} className="artist-hero-avatar album-cover-img" />
        </div>
        <div className="artist-hero-content">
          <span className="album-type-badge">ALBUM</span>
          <h1 className="artist-hero-name album-title">{album.name}</h1>
          <p className="artist-hero-stats album-stats">
            <span className="album-artist-bold">{album.artist}</span>
            {album.year ? ` • ${album.year}` : ''}
            {` • ${album.songCount} songs`}
          </p>
        </div>
      </div>

      {/* Play Action Bar */}
      <div className="artist-action-bar">
        <button onClick={handlePlayAll} className="artist-main-play-btn" title="Play Album">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>

      {/* Tracklist Table */}
      <main className="artist-content-main">
        <section className="artist-section">
          <div className="artist-track-list">
            {album.songs.map((song, idx) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  className={`artist-track-row ${isCurrent ? 'active' : ''}`}
                  onClick={() => handlePlaySong(song, idx)}
                >
                  <div className="artist-track-num">
                    {isCurrent && isPlaying ? (
                      <div className="spotify-eq-bars-mini">
                        <span />
                        <span />
                        <span />
                      </div>
                    ) : (
                      <span className="track-idx-num">{idx + 1}</span>
                    )}
                    <span className="track-play-icon">▶</span>
                  </div>
                  <SongArtwork
                    cover={song.cover}
                    name={song.name}
                    songId={song.id}
                    className="artist-track-thumb"
                  />
                  <div className="artist-track-info">
                    <span className={`artist-track-title ${isCurrent ? 'active' : ''}`}>
                      {song.name}
                    </span>
                    <span className="artist-track-album">{song.artist}</span>
                  </div>
                  <div className="artist-track-badge">
                    <span className="source-pill-mini" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <img src="/lossless-logo.jpeg" alt="Lossless" style={{ width: '13px', height: '13px', borderRadius: '2px', objectFit: 'contain' }} />
                      <span>Lossless</span>
                    </span>
                  </div>
                  <div className="artist-track-duration">
                    {formatDuration(song.duration)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
