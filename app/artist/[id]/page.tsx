'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExploreSong } from '@/types/explore';
import { SaavnArtistDetails } from '@/lib/saavn-stream';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import SongArtwork from '@/components/explore/SongArtwork';

export default function ArtistPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { currentSong, isPlaying, playSong, togglePlay } = useGlobalAudio();

  const [artist, setArtist] = useState<(SaavnArtistDetails & { videos?: ExploreSong[] }) | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'discography' | 'similar' | 'about'>('overview');
  const [discographyFilter, setDiscographyFilter] = useState<'all' | 'albums' | 'singles'>('all');
  const [showAllTracks, setShowAllTracks] = useState<boolean>(false);
  const [isScrolledHeader, setIsScrolledHeader] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadArtist() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/explore/artist/${encodeURIComponent(params.id)}`);
        const data = await res.json();
        if (data.success && data.artist) {
          setArtist(data.artist);
          // Check follow state
          try {
            const savedFollows = JSON.parse(localStorage.getItem('deluxe_followed_artists') || '[]');
            setIsFollowing(savedFollows.includes(data.artist.id || params.id));
          } catch { }
        } else {
          setError(data.error || 'Artist not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load artist details');
      } finally {
        setIsLoading(false);
      }
    }
    loadArtist();
  }, [params.id]);

  // Scroll listener for sticky header artist reveal
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    setIsScrolledHeader(scrollTop > 260);
  }, []);

  const toggleFollow = () => {
    setIsFollowing((prev) => {
      const next = !prev;
      try {
        const key = 'deluxe_followed_artists';
        const saved = JSON.parse(localStorage.getItem(key) || '[]');
        const artistId = artist?.id || params.id;
        const updated = next
          ? Array.from(new Set([...saved, artistId]))
          : saved.filter((id: string) => id !== artistId);
        localStorage.setItem(key, JSON.stringify(updated));
      } catch { }
      return next;
    });
  };

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2400);
      }
    } catch { }
  };

  const handlePlayAll = useCallback(() => {
    if (!artist || !artist.topSongs || artist.topSongs.length === 0) return;
    const isPlayingArtist = isPlaying && artist.topSongs.some((s) => s.id === currentSong?.id);
    if (isPlayingArtist) {
      togglePlay();
      return;
    }
    const firstSong = artist.topSongs[0];
    playSong(firstSong, artist.topSongs.slice(1));
  }, [artist, isPlaying, currentSong, togglePlay, playSong]);

  const handleShuffleAll = useCallback(() => {
    if (!artist || !artist.topSongs || artist.topSongs.length === 0) return;
    const shuffled = [...artist.topSongs].sort(() => Math.random() - 0.5);
    const firstSong = shuffled[0];
    playSong(firstSong, shuffled.slice(1));
  }, [artist, playSong]);

  const handlePlaySong = useCallback((song: ExploreSong, index: number) => {
    if (!artist || !artist.topSongs) return;
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    playSong(song, artist.topSongs.slice(index + 1));
  }, [artist, currentSong, togglePlay, playSong]);

  const formatDuration = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFollowers = (countStr: string) => {
    const num = parseInt(countStr, 10);
    if (isNaN(num)) return countStr;
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="artist-page-container loading-state">
        <div className="artist-loading-spinner" />
        <p className="artist-loading-text">Loading verified artist profile...</p>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="artist-page-container error-state">
        <button onClick={() => router.back()} className="artist-back-btn">
          ← Back
        </button>
        <div className="artist-error-box">
          <h2>Artist Not Found</h2>
          <p>{error || 'Unable to load details for this artist.'}</p>
          <Link href="/" className="artist-home-link">
            Return to Explore
          </Link>
        </div>
      </div>
    );
  }

  const displayedTracks = showAllTracks ? artist.topSongs : artist.topSongs.slice(0, 5);
  const isPlayingArtist = isPlaying && artist.topSongs.some((s) => s.id === currentSong?.id);
  // Albums are already sorted by year desc from the API, so first item is latest
  const latestRelease = artist.topAlbums && artist.topAlbums.length > 0 ? artist.topAlbums[0] : null;

  // Filter collaborations where other artists are featured
  const collaborations = artist.topSongs.filter(
    (s) => s.artist && (s.artist.includes(',') || s.artist.includes('&') || s.artist.toLowerCase().includes('feat'))
  );

  // Filter Discography using releaseType from API
  const allAlbums = artist.topAlbums || [];
  const albumsOnly = allAlbums.filter((a) => a.releaseType === 'album');
  const singlesOnly = allAlbums.filter((a) => a.releaseType === 'single');
  const filteredAlbums = discographyFilter === 'all'
    ? allAlbums
    : discographyFilter === 'albums'
      ? albumsOnly
      : singlesOnly;

  // Calculate dynamic Top Cities distribution based on listener count and dominant language
  const totalListenersNum = parseInt(artist.followerCount || '1500000', 10) || 1500000;
  const isHindiPunjabi = ['hindi', 'punjabi', 'bhojpuri', 'haryanvi'].includes(artist.dominantLanguage?.toLowerCase() || 'hindi');
  
  const topCities = isHindiPunjabi
    ? [
        { city: 'Delhi, India', listeners: Math.round(totalListenersNum * 0.28), pct: 100 },
        { city: 'Mumbai, India', listeners: Math.round(totalListenersNum * 0.22), pct: 78 },
        { city: 'Bengaluru, India', listeners: Math.round(totalListenersNum * 0.16), pct: 57 },
        { city: 'Toronto, Canada', listeners: Math.round(totalListenersNum * 0.12), pct: 42 },
        { city: 'London, UK', listeners: Math.round(totalListenersNum * 0.08), pct: 28 },
      ]
    : [
        { city: 'New York, USA', listeners: Math.round(totalListenersNum * 0.26), pct: 100 },
        { city: 'London, UK', listeners: Math.round(totalListenersNum * 0.21), pct: 80 },
        { city: 'Los Angeles, USA', listeners: Math.round(totalListenersNum * 0.17), pct: 65 },
        { city: 'Sydney, Australia', listeners: Math.round(totalListenersNum * 0.13), pct: 50 },
        { city: 'Toronto, Canada', listeners: Math.round(totalListenersNum * 0.09), pct: 35 },
      ];

  return (
    <div className="artist-page-container" ref={containerRef} onScroll={handleScroll}>
      {/* Top Ambient Blurred Aura */}
      <div
        className="artist-hero-backdrop"
        style={{ backgroundImage: `url(${artist.image})` }}
      />
      <div className="artist-hero-gradient" />

      {/* Sticky Glass Nav Bar */}
      <header className={`artist-nav-bar ${isScrolledHeader ? 'scrolled' : ''}`}>
        <div className="artist-nav-left">
          <button onClick={() => router.back()} className="artist-back-btn" title="Go Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back</span>
          </button>

          {/* Revealed Mini Identity on Scroll */}
          <div className={`artist-nav-mini-identity ${isScrolledHeader ? 'visible' : ''}`}>
            <button
              onClick={handlePlayAll}
              className="artist-nav-mini-play"
              title={isPlayingArtist ? 'Pause' : 'Play'}
            >
              {isPlayingArtist ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <span className="artist-nav-mini-name">{artist.name}</span>
          </div>
        </div>

        <div className="artist-nav-right">
          <div className="artist-nav-hires" title="Master Quality Audio Lossless">
            <img src="/lossless-logo.jpeg" alt="Lossless" style={{ borderRadius: '3px', objectFit: 'contain' }} />
          </div>
        </div>
      </header>

      {/* Hero Banner Section */}
      <div className="artist-hero-section">
        <div className="artist-hero-avatar-wrap">
          <img src={artist.image} alt={artist.name} className="artist-hero-avatar" />
        </div>
        <div className="artist-hero-content">
          <div className="artist-verified-badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#3d91f4">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span>Verified Artist</span>
          </div>
          <h1 className="artist-hero-name">{artist.name}</h1>
          <p className="artist-hero-stats">
            <strong style={{ color: '#ffffff', fontWeight: 700 }}>{formatFollowers(artist.followerCount)}</strong> monthly listeners
            {artist.dominantLanguage ? ` • Top in ${artist.dominantLanguage.charAt(0).toUpperCase() + artist.dominantLanguage.slice(1)}` : ''}
          </p>
        </div>
      </div>

      {/* Action Bar (Play, Shuffle, Follow, Share) */}
      <div className="artist-action-bar">
        <button
          onClick={handlePlayAll}
          className={`artist-main-play-btn ${isPlayingArtist ? 'playing' : ''}`}
          title={isPlayingArtist ? 'Pause Discography' : 'Play Discography'}
        >
          {isPlayingArtist ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={handleShuffleAll}
          className="artist-shuffle-btn"
          title="Shuffle Discography"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
        </button>

        <button
          onClick={toggleFollow}
          className={`artist-follow-btn ${isFollowing ? 'following' : ''}`}
        >
          {isFollowing ? '✓ Following' : 'Follow'}
        </button>

        <button
          onClick={handleShare}
          className="artist-share-btn"
          title="Share Artist Profile"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {copiedToast && <span className="artist-copied-toast">Link Copied!</span>}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="artist-tabs-bar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`artist-tab-item ${activeTab === 'overview' ? 'active' : ''}`}
        >
          Overview
        </button>
        {artist.topAlbums.length > 0 && (
          <button
            onClick={() => setActiveTab('discography')}
            className={`artist-tab-item ${activeTab === 'discography' ? 'active' : ''}`}
          >
            Discography ({artist.topAlbums.length})
          </button>
        )}
        {artist.similarArtists.length > 0 && (
          <button
            onClick={() => setActiveTab('similar')}
            className={`artist-tab-item ${activeTab === 'similar' ? 'active' : ''}`}
          >
            Fans Also Like
          </button>
        )}
        <button
          onClick={() => setActiveTab('about')}
          className={`artist-tab-item ${activeTab === 'about' ? 'active' : ''}`}
        >
          About
        </button>
      </div>

      {/* Main Content Sections */}
      <main className="artist-content-main">
        {/* ========================================================
            OVERVIEW TAB
           ======================================================== */}
        {activeTab === 'overview' && (
          <>
            {/* 1. LATEST RELEASE SPOTLIGHT CARD */}
            {latestRelease && (
              <section className="artist-section artist-latest-release-container">
                <div className="artist-section-header">
                  <h2 className="artist-section-title">Latest Release</h2>
                </div>
                <Link href={`/album/${latestRelease.id}`} className="artist-latest-card">
                  <div className="artist-latest-cover-wrap">
                    <img src={latestRelease.image} alt={latestRelease.name} className="artist-latest-cover" />
                    <div className="artist-latest-play-hover">▶</div>
                  </div>
                  <div className="artist-latest-info">
                    <span className="artist-latest-badge">🌟 Latest Release</span>
                    <h3 className="artist-latest-title">{latestRelease.name}</h3>
                    <p className="artist-latest-meta">
                      {latestRelease.year || 'New'} • {latestRelease.songCount ? `${latestRelease.songCount} Songs` : 'Single / Album'}
                    </p>
                  </div>
                </Link>
              </section>
            )}

            {/* POPULAR TRACKS */}
            <section className="artist-section">
              <div className="artist-section-header">
                <h2 className="artist-section-title">Popular Tracks</h2>
              </div>

              {/* Table Column Headers */}
              <div className="artist-track-table-header">
                <span className="col-hash">#</span>
                <span className="col-thumb" />
                <span className="col-title">Title</span>
                <span className="col-album">Album</span>
                <span className="col-quality">Quality</span>
                <span className="col-time">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
              </div>

              <div className="artist-track-list">
                {displayedTracks.map((song, idx) => {
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
                        <span className="artist-track-artist-sub">{song.artist}</span>
                      </div>
                      <div className="artist-track-album">{song.album}</div>
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

              {artist.topSongs.length > 5 && (
                <button
                  onClick={() => setShowAllTracks((p) => !p)}
                  className="artist-show-more-btn"
                >
                  {showAllTracks ? 'Show less' : `See more (${artist.topSongs.length} tracks)`}
                </button>
              )}
            </section>

            {/* 3. OFFICIAL MUSIC VIDEOS & LIVE PERFORMANCES */}
            {artist.videos && artist.videos.length > 0 && (
              <section className="artist-section">
                <div className="artist-section-header">
                  <h2 className="artist-section-title">🎬 Official Music Videos & Live</h2>
                </div>
                <div className="artist-videos-grid">
                  {artist.videos.map((vid) => (
                    <div
                      key={vid.id}
                      className="artist-video-card"
                      onClick={() => playSong(vid, artist.videos?.filter(v => v.id !== vid.id) || [])}
                    >
                      <div className="artist-video-thumb-wrap">
                        <img src={vid.cover} alt={vid.name} className="artist-video-thumb" />
                        <span className="artist-video-badge">4K Official</span>
                        <div className="artist-video-play-overlay">
                          <div className="artist-video-play-circle">▶</div>
                        </div>
                      </div>
                      <div className="artist-video-info">
                        <h4 className="artist-video-title">{vid.name}</h4>
                        <p className="artist-video-channel" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{vid.artist || artist.name}</span>
                          <span>•</span>
                          <img src="/opus-logo.jpeg" alt="Opus" style={{ width: '12px', height: '12px', borderRadius: '2px', objectFit: 'contain' }} />
                          <span>Opus</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. COLLABORATIONS & FEATURED TRACKS */}
            {collaborations.length > 0 && (
              <section className="artist-section">
                <div className="artist-section-header">
                  <h2 className="artist-section-title">🤝 Featured & Collaborations</h2>
                </div>
                <div className="artist-collab-grid">
                  {collaborations.slice(0, 8).map((collab, cIdx) => (
                    <div
                      key={`collab-${collab.id}`}
                      className="artist-collab-card"
                      onClick={() => handlePlaySong(collab, cIdx)}
                    >
                      <img src={collab.cover} alt={collab.name} className="artist-collab-thumb" />
                      <div className="artist-collab-details">
                        <h4 className="artist-collab-title">{collab.name}</h4>
                        <p className="artist-collab-artists">{collab.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* DISCOGRAPHY PREVIEW */}
            {artist.topAlbums.length > 0 && (
              <section className="artist-section">
                <div className="artist-section-header">
                  <h2 className="artist-section-title">Discography</h2>
                  <button onClick={() => setActiveTab('discography')} className="artist-see-all">
                    Show all
                  </button>
                </div>
                <div className="artist-grid">
                  {artist.topAlbums.slice(0, 6).map((album) => (
                    <Link
                      key={album.id}
                      href={`/album/${album.id}`}
                      className="artist-card-item"
                    >
                      <div className="artist-card-cover-wrap">
                        <img src={album.image} alt={album.name} className="artist-card-cover" />
                        <div className="artist-card-play-hover">▶</div>
                      </div>
                      <h4 className="artist-card-title">{album.name}</h4>
                      <p className="artist-card-subtitle">{album.year || 'Album'} • Release</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* FANS ALSO LIKE PREVIEW */}
            {artist.similarArtists.length > 0 && (
              <section className="artist-section">
                <h2 className="artist-section-title">Fans Also Like</h2>
                <div className="artist-grid artist-circular-grid">
                  {artist.similarArtists.slice(0, 6).map((sa) => (
                    <Link
                      key={sa.id}
                      href={`/artist/${sa.id}`}
                      className="artist-card-item circular"
                    >
                      <div className="artist-card-avatar-wrap">
                        <img src={sa.image} alt={sa.name} className="artist-card-avatar" />
                      </div>
                      <h4 className="artist-card-title">{sa.name}</h4>
                      <p className="artist-card-subtitle">{sa.role || 'Artist'}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ========================================================
            DISCOGRAPHY FULL TAB (WITH FILTERS)
           ======================================================== */}
        {activeTab === 'discography' && (
          <section className="artist-section">
            <h2 className="artist-section-title">Discography</h2>
            
            {/* Discography Filter Pills */}
            <div className="artist-filter-pills">
              <button
                className={`artist-filter-btn ${discographyFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDiscographyFilter('all')}
              >
                All Releases ({allAlbums.length})
              </button>
              <button
                className={`artist-filter-btn ${discographyFilter === 'albums' ? 'active' : ''}`}
                onClick={() => setDiscographyFilter('albums')}
              >
                Albums ({albumsOnly.length})
              </button>
              <button
                className={`artist-filter-btn ${discographyFilter === 'singles' ? 'active' : ''}`}
                onClick={() => setDiscographyFilter('singles')}
              >
                Singles & EPs ({singlesOnly.length})
              </button>
            </div>

            <div className="artist-grid">
              {filteredAlbums.map((album) => (
                <Link
                  key={album.id}
                  href={`/album/${album.id}`}
                  className="artist-card-item"
                >
                  <div className="artist-card-cover-wrap">
                    <img src={album.image} alt={album.name} className="artist-card-cover" />
                    <div className="artist-card-play-hover">▶</div>
                  </div>
                  <h4 className="artist-card-title">{album.name}</h4>
                  <p className="artist-card-subtitle">
                    {album.year} • {album.songCount ? `${album.songCount} songs` : 'Album'}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================
            SIMILAR ARTISTS TAB
           ======================================================== */}
        {activeTab === 'similar' && (
          <section className="artist-section">
            <h2 className="artist-section-title">Similar Artists</h2>
            <div className="artist-grid artist-circular-grid">
              {artist.similarArtists.map((sa) => (
                <Link
                  key={sa.id}
                  href={`/artist/${sa.id}`}
                  className="artist-card-item circular"
                >
                  <div className="artist-card-avatar-wrap">
                    <img src={sa.image} alt={sa.name} className="artist-card-avatar" />
                  </div>
                  <h4 className="artist-card-title">{sa.name}</h4>
                  <p className="artist-card-subtitle">{sa.role || 'Artist'}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================
            ABOUT & STATS TAB (WITH TOP CITIES)
           ======================================================== */}
        {activeTab === 'about' && (
          <section className="artist-section">
            <h2 className="artist-section-title">About {artist.name}</h2>
            <div className="artist-about-grid">
              <div className="artist-bio-card">
                <img src={artist.image} alt={artist.name} className="artist-bio-banner" />
                <div className="artist-bio-details">
                  <div className="artist-bio-stat-number">
                    {formatFollowers(artist.followerCount)}
                  </div>
                  <div className="artist-bio-stat-label">Monthly Listeners</div>
                  <p className="artist-bio-paragraph">
                    {artist.bio || `${artist.name} is one of the top chart-topping musical artists with millions of global streams.`}
                  </p>
                  {artist.dob && (
                    <div className="artist-bio-dob">
                      <span>Born / Active: </span>
                      <span>{artist.dob}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 5. TOP CITIES LEADERBOARD */}
              <div className="artist-top-cities-card">
                <div className="artist-top-cities-header">
                  <h3 className="artist-top-cities-title">📊 Top Streaming Cities</h3>
                </div>
                <div className="artist-city-list">
                  {topCities.map((item, cIdx) => (
                    <div key={item.city} className="artist-city-row">
                      <div className="artist-city-info">
                        <span className="artist-city-name">{cIdx + 1}. {item.city}</span>
                        <span className="artist-city-listeners">{item.listeners.toLocaleString()} listeners</span>
                      </div>
                      <div className="artist-city-bar-bg">
                        <div className="artist-city-bar-fill" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
