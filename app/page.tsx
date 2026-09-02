'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExploreSong, SUPPORTED_LANGUAGES, AudioSourcePlatform, CanonicalSong, CanonicalArtist, CanonicalAlbum, ExploreSearchResult } from '@/types/explore';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import SongArtwork from '@/components/explore/SongArtwork';
import SourceQualityBadge from '@/components/explore/SourceQualityBadge';
import { GroupedSuggestions, SearchSuggestionItem } from '@/app/api/explore/suggestions/route';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { MagnifyingGlass, X, Play, Pause, ArrowUpRight } from '@phosphor-icons/react';

function SuggestionThumb({ image, type, title }: { image?: string; type: string; title: string }) {
  const [hasError, setHasError] = useState(false);

  if (!image || hasError) {
    return (
      <div className={`spotify-suggestion-icon-placeholder ${type === 'artist' ? 'artist' : ''}`}>
        {type === 'artist' ? '🎙️' : type === 'song' ? '🎵' : '💿'}
      </div>
    );
  }

  return (
    <img
      src={image}
      alt=""
      className={`spotify-suggestion-thumb ${type === 'artist' ? 'artist' : ''}`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

function ExplorePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentSong, isPlaying, playSong, togglePlay, upcomingQueue, historyStack, setQueue } = useGlobalAudio();

  // Read state from URL
  const searchQuery = searchParams.get('q') || '';
  const selectedLanguage = searchParams.get('lang') || 'hindi';
  const selectedPlatform = (searchParams.get('source') || (searchQuery ? 'all' : 'jiosaavn')) as 'all' | AudioSourcePlatform;

  // Local UI state for search input (to allow typing without immediate URL update)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Search Results State
  const [songs, setSongs] = useState<CanonicalSong[]>([]);
  const [artists, setArtists] = useState<CanonicalArtist[]>([]);
  const [albums, setAlbums] = useState<CanonicalAlbum[]>([]);
  const [topResult, setTopResult] = useState<CanonicalArtist | CanonicalAlbum | CanonicalSong | undefined>(undefined);
  const [intent, setIntent] = useState<{ primary: string; confidence: number } | undefined>(undefined);
  const [correctedQuery, setCorrectedQuery] = useState<string | undefined>(undefined);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search Suggestions State
  const [groupedSuggestions, setGroupedSuggestions] = useState<GroupedSuggestions | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  // flattened index for keyboard navigation
  const [flattenedSuggestions, setFlattenedSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchResultsSectionRef = useRef<HTMLDivElement | null>(null);

  // AbortController ref for race condition prevention
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  // Prevent parallel recommendation fetching
  const fetchingRecommendationsRef = useRef<boolean>(false);

  // Load Recent Searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem('deluxe_recent_searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch { }
  }, []);

  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== query.toLowerCase());
      const newSearches = [query, ...filtered].slice(0, 5); // Keep top 5
      try {
        localStorage.setItem('deluxe_recent_searches', JSON.stringify(newSearches));
      } catch { }
      return newSearches;
    });
  };

  const removeRecentSearch = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const newSearches = prev.filter(q => q !== query);
      try {
        localStorage.setItem('deluxe_recent_searches', JSON.stringify(newSearches));
      } catch { }
      return newSearches;
    });
  };

  // Smoothly scroll down to the Search results section
  const scrollToSearchResults = useCallback(() => {
    setTimeout(() => {
      if (searchResultsSectionRef.current) {
        searchResultsSectionRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 120);
  }, []);

  // Update URL state
  const updateSearchState = (query: string, lang: string, source: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (lang && lang !== 'hindi') params.set('lang', lang);
    if (source && source !== (query ? 'all' : 'jiosaavn')) params.set('source', source);

    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  const handleLanguageSelect = (langId: string) => {
    updateSearchState(searchQuery, langId, selectedPlatform);
  };

  const handlePlatformSelect = (platform: 'all' | AudioSourcePlatform) => {
    updateSearchState(searchQuery, selectedLanguage, platform);
  };

  const handleClearSearch = () => {
    setLocalSearchQuery('');
    updateSearchState('', selectedLanguage, selectedPlatform);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleGoBack = () => {
    if (searchQuery.trim()) {
      handleClearSearch();
      return;
    }
    router.back();
  };

  // Fetch search or trending songs
  const fetchSongs = useCallback(async (
    query: string,
    language: string,
    platform: 'all' | AudioSourcePlatform
  ) => {
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    fetchAbortControllerRef.current = abortController;

    setIsLoading(true);

    try {
      if (query.trim()) {
        saveRecentSearch(query.trim());
        const res = await fetch(`/api/explore/search?q=${encodeURIComponent(query.trim())}&source=${encodeURIComponent(platform)}`, {
          signal: abortController.signal
        });
        const data = await res.json();
        if (data.success) {
          setSongs(data.songs || []);
          setArtists(data.artists || []);
          setAlbums(data.albums || []);
          setTopResult(data.topResult);
          setIntent(data.intent);
          setCorrectedQuery(data.correctedQuery);
        }
      } else {
        const res = await fetch(`/api/explore/trending?language=${encodeURIComponent(language)}&source=${encodeURIComponent(platform)}`, {
          signal: abortController.signal
        });
        const data = await res.json();
        if (data.success) {
          setSongs(data.songs || []);
          setArtists([]);
          setAlbums([]);
          setTopResult(undefined);
          setIntent(undefined);
          setCorrectedQuery(undefined);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Fetch aborted due to race condition prevention');
      } else {
        console.error('Error fetching explore songs:', err);
      }
    } finally {
      if (fetchAbortControllerRef.current === abortController) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch search suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setGroupedSuggestions(null);
      setFlattenedSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/explore/suggestions?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.success && data.groupedSuggestions) {
        setGroupedSuggestions(data.groupedSuggestions);

        // Flatten for keyboard nav
        const flat: SearchSuggestionItem[] = [];
        if (data.groupedSuggestions.artists) flat.push(...data.groupedSuggestions.artists);
        if (data.groupedSuggestions.songs) flat.push(...data.groupedSuggestions.songs);
        if (data.groupedSuggestions.albums) flat.push(...data.groupedSuggestions.albums);
        if (data.groupedSuggestions.queries) flat.push(...data.groupedSuggestions.queries);
        setFlattenedSuggestions(flat);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
    fetchSongs(searchQuery, selectedLanguage, selectedPlatform);
  }, [searchQuery, selectedLanguage, selectedPlatform, fetchSongs]);

  // Hook up the Authentic Recommendation Engine
  useEffect(() => {
    if (currentSong && upcomingQueue.length < 3 && !fetchingRecommendationsRef.current) {
      fetchingRecommendationsRef.current = true;
      const fetchRecommendations = async () => {
        try {
          const res = await fetch('/api/explore/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentTrack: currentSong,
              sessionContext: {
                language: selectedLanguage === 'all' ? undefined : selectedLanguage,
                recentInteractions: historyStack.slice(-10).map((s) => ({
                  type: 'complete',
                  timestamp: Date.now(),
                  trackId: s.id,
                  language: s.language || undefined,
                })),
                excludedTrackIds: [currentSong.id, ...historyStack.map((h) => h.id), ...upcomingQueue.map((q) => q.id)],
              },
            }),
          });
          const data = await res.json();
          if (data.success && data.tracks && data.tracks.length > 0) {
            const existingIds = new Set([...upcomingQueue, currentSong, ...historyStack].map((s) => s.id));
            const newTracks = data.tracks.filter((t: ExploreSong) => !existingIds.has(t.id));
            if (newTracks.length > 0) {
              setQueue([...upcomingQueue, ...newTracks]);
            }
          }
        } catch (err) {
          console.error('Failed to fetch smart recommendations:', err);
        } finally {
          fetchingRecommendationsRef.current = false;
        }
      };
      fetchRecommendations();
    }
  }, [currentSong, upcomingQueue, historyStack, selectedLanguage, setQueue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
        setSelectedSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalSearchQuery(val);
    fetchSuggestions(val);
  };

  const executeSearch = (queryToExecute: string) => {
    // Always default to 'all' sources for any new search
    updateSearchState(queryToExecute, selectedLanguage, 'all');
    setIsSearchFocused(false);
    setSelectedSuggestionIndex(-1);
    scrollToSearchResults();
  };

  const handleSelectSuggestion = (item: SearchSuggestionItem) => {
    const chosenQuery = item.queryValue || item.title;
    setLocalSearchQuery(chosenQuery);
    executeSearch(chosenQuery);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchFocused) {
      if (e.key === 'Enter') {
        executeSearch(localSearchQuery);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < flattenedSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : flattenedSuggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && flattenedSuggestions[selectedSuggestionIndex]) {
        handleSelectSuggestion(flattenedSuggestions[selectedSuggestionIndex]);
      } else {
        executeSearch(localSearchQuery);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsSearchFocused(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  // Playback handlers
  const handleStartFreshSong = useCallback(
    (song: ExploreSong) => {
      if (currentSong?.id === song.id) {
        togglePlay();
        return;
      }
      const songIndex = songs.findIndex((s) => s.id === song.id);
      const queue = songIndex !== -1 ? songs.slice(songIndex + 1) : [];
      playSong(song, queue);
    },
    [currentSong, songs, togglePlay, playSong]
  );

  const currentLanguageName = SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage)?.name || 'Hindi';

  const hasNoResults = !isLoading && !topResult && songs.length === 0 && artists.length === 0 && albums.length === 0;

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: '120px' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, width: '100%', padding: '16px 24px 10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', background: 'rgba(5,5,5,0.7)', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'auto' }}>
          <button type="button" className="double-bezel-shell" style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={handleGoBack} title="Go Back">
            <div className="double-bezel-core" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
              <ArrowUpRight size={18} weight="light" style={{ transform: 'rotate(-135deg)', color: '#fff' }} />
            </div>
          </button>
        </div>

        <div style={{ flex: 1, width: '100%', maxWidth: '34rem', margin: '0 auto', pointerEvents: 'auto', position: 'relative' }} ref={searchContainerRef}>
          <div className="double-bezel-shell">
            <div className="double-bezel-core" style={{ display: 'flex', alignItems: 'center', padding: '9px 18px', gap: '12px', transition: 'all 0.5s' }}>
              <MagnifyingGlass size={18} weight="light" style={{ color: 'rgba(255,255,255,0.5)' }} />
              <input
                ref={searchInputRef}
                type="text"
                style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', color: '#fff', fontSize: '15px', letterSpacing: '0.02em', fontFamily: 'inherit' }}
                placeholder="Search songs, artists, albums..."
                value={localSearchQuery}
                onChange={handleSearchChange}
                onFocus={() => {
                  setIsSearchFocused(true);
                  if (localSearchQuery.trim().length >= 2) {
                    fetchSuggestions(localSearchQuery);
                  }
                }}
                onKeyDown={handleSearchKeyDown}
              />
              {localSearchQuery && (
                <button type="button" style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px', transition: 'color 0.2s' }} onClick={handleClearSearch} title="Clear search">
                  <X size={16} weight="light" />
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {isSearchFocused && (
              ((localSearchQuery.trim().length >= 2 && groupedSuggestions && flattenedSuggestions.length > 0) ||
                (!localSearchQuery.trim() && recentSearches.length > 0)) && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    marginTop: '10px',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    overflow: 'hidden',
                    maxHeight: '380px',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(12, 13, 18, 0.96)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '1.25rem',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <div style={{ padding: '8px', overflowY: 'auto', width: '100%', height: '100%' }}>
                    {!localSearchQuery.trim() && recentSearches.length > 0 && (
                      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Searches</span>
                      </div>
                    )}

                    {!localSearchQuery.trim() && recentSearches.length > 0 && recentSearches.map(recentQ => (
                      <button
                        key={`recent-${recentQ}`}
                        type="button"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '10px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', transition: 'background-color 0.2s', color: '#fff' }}
                        onClick={() => {
                          setLocalSearchQuery(recentQ);
                          executeSearch(recentQ);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
                            <MagnifyingGlass size={15} weight="light" />
                          </div>
                          <span style={{ color: '#fff', fontWeight: 500, fontSize: '14px' }}>{recentQ}</span>
                        </div>
                        <div onClick={(e) => removeRecentSearch(e, recentQ)} style={{ padding: '6px', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', background: 'none', border: 'none' }}>
                          <X size={15} />
                        </div>
                      </button>
                    ))}

                    {localSearchQuery.trim().length >= 2 && groupedSuggestions && flattenedSuggestions.length > 0 && (
                      <>
                        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Suggestions</span>
                          {isLoadingSuggestions && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Updating...</span>}
                        </div>

                        {['artists', 'songs', 'albums', 'queries'].map((groupKey) => {
                          const items = groupedSuggestions[groupKey as keyof GroupedSuggestions];
                          if (!items || items.length === 0) return null;
                          return (
                            <div key={groupKey}>
                              {items.map((item) => {
                                const idx = flattenedSuggestions.findIndex(f => f.id === item.id);
                                const isSelected = selectedSuggestionIndex === idx;
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    style={{
                                      width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px',
                                      borderRadius: '10px', transition: 'background-color 0.2s', textAlign: 'left',
                                      background: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent',
                                      border: 'none', cursor: 'pointer', color: '#fff',
                                    }}
                                    onClick={() => handleSelectSuggestion(item)}
                                    onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                                  >
                                    <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {item.image ? (
                                        <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        <MagnifyingGlass size={18} weight="light" style={{ color: 'rgba(255,255,255,0.3)' }} />
                                      )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ color: '#fff', fontWeight: 500, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{item.subtitle}</div>
                                    </div>
                                    <div style={{ padding: '3px 8px', borderRadius: '9999px', fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                                      {item.type}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>

        <div style={{ width: 40, height: 40 }} className="pointer-events-auto hidden md:block" /> {/* Spacer */}
      </header>

      <div className="px-3 sm:px-6 py-2 flex flex-col gap-2.5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-3 sm:mx-0 px-3 sm:px-0">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => handleLanguageSelect(lang.id)}
              className={selectedLanguage === lang.id ? 'glass-pill-active shrink-0' : 'glass-pill shrink-0'}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12.5px',
                fontWeight: selectedLanguage === lang.id ? 600 : 500,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              {lang.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-3 sm:mx-0 px-3 sm:px-0">
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold shrink-0 mr-1">Source:</span>
          {(searchQuery
            ? [
              { id: 'all', label: 'All Sources', icon: null },
              { id: 'jiosaavn', label: 'Lossless', icon: '/lossless-logo.jpeg' },
              { id: 'youtube', label: 'Opus', icon: '/opus-logo.jpeg' },
            ]
            : [
              { id: 'jiosaavn', label: 'Lossless', icon: '/lossless-logo.jpeg' },
              { id: 'youtube', label: 'Opus', icon: '/opus-logo.jpeg' },
            ]
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePlatformSelect(p.id as any)}
              className={selectedPlatform === p.id ? 'glass-pill-active shrink-0' : 'glass-pill shrink-0'}
              style={{
                padding: '5px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: selectedPlatform === p.id ? 600 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {p.icon ? (
                <img
                  src={p.icon}
                  alt={p.label}
                  style={{ width: '15px', height: '15px', borderRadius: '2px', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ fontSize: '11px' }}>🌐</span>
              )}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="px-3 sm:px-6 pb-28 sm:pb-32 flex-1" style={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.2s', pointerEvents: isLoading ? 'none' : 'auto' }}>
        <div ref={searchResultsSectionRef} style={{ marginBottom: '12px', scrollMarginTop: '120px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              style={{ fontSize: 'clamp(1.25rem, 4vw, 2rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}
            >
              {searchQuery ? `Search results for "${searchQuery}"` : `${currentLanguageName} Top 50 Hits`}
            </motion.h2>
            {correctedQuery && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '2px' }}
              >
                Showing results for <span style={{ color: '#fff', fontWeight: 700 }}>{correctedQuery}</span>
              </motion.p>
            )}
          </div>
        </div>

        {hasNoResults ? (
          <div className="double-bezel-shell" style={{ maxWidth: '36rem', margin: '40px auto 0', textAlign: 'center' }}>
            <div className="double-bezel-core" style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <MagnifyingGlass size={28} weight="light" style={{ color: 'rgba(255,255,255,0.3)' }} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>No results found for &ldquo;{searchQuery}&rdquo;</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '24px' }}>Check your spelling, or try searching for another artist or language.</p>

              {(selectedLanguage !== 'hindi' || (searchQuery ? selectedPlatform !== 'all' : selectedPlatform !== 'jiosaavn')) && (
                <button
                  onClick={() => updateSearchState(searchQuery, 'hindi', searchQuery ? 'all' : 'jiosaavn')}
                  className="btn-nested"
                >
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Reset filters</span>
                  <div className="btn-nested-icon" style={{ width: '1.75rem', height: '1.75rem' }}>
                    <X size={12} />
                  </div>
                </button>
              )}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full"
          >
      {/* Top Result Section */}
      {topResult && (
        <div className="double-bezel-shell col-span-1 lg:col-span-8">
          <div className="double-bezel-core p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center cursor-pointer relative overflow-hidden"
            onClick={() => topResult.type === 'song' ? handleStartFreshSong(topResult as CanonicalSong) : router.push(`/${topResult.type}/${topResult.id}`)}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.05)', opacity: 0, transition: 'opacity 0.7s', pointerEvents: 'none',
              backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1), transparent)` }} />

            <div className="double-bezel-shell w-24 h-24 sm:w-32 sm:h-32 shrink-0 p-1">
              <img
                src={topResult.cover}
                alt={topResult.name}
                className="double-bezel-core"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: topResult.type === 'artist' ? '50%' : '1rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', zIndex: 10, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 500, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  Top Result • {topResult.type}
                </span>
              </div>
              <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 2.2rem)', fontWeight: 700, color: '#fff', marginBottom: '8px', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                {topResult.name}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: '13.5px' }}>
                {topResult.type === 'artist' && <span>{(topResult as CanonicalArtist).role}</span>}
                {topResult.type === 'album' && <span>{(topResult as CanonicalAlbum).artist} • {(topResult as CanonicalAlbum).year}</span>}
                {topResult.type === 'song' && <span>{(topResult as CanonicalSong).artist}</span>}
              </div>

              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-start sm:justify-end' }}>
                <div className="btn-nested" style={{ padding: '0.4rem 0.8rem 0.4rem 1.2rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>
                    {topResult.type === 'song' ? 'Play Now' : 'Explore'}
                  </span>
                  <div className="btn-nested-icon" style={{ width: '1.75rem', height: '1.75rem' }}>
                    {topResult.type === 'song' ? <Play size={12} weight="fill" /> : <ArrowUpRight size={12} />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asymmetrical Artists/Albums Sidebar */}
      {(artists.length > 0 || (intent?.primary === 'album' && albums.length > 0)) && (
        <div className="col-span-1 lg:col-span-4 flex flex-col gap-3 sm:gap-4">
          {artists.slice(0, 2).map((artist, idx) => (
            <Link key={artist.id} href={`/artist/${artist.id}`} style={{ display: 'block', height: '100%', textDecoration: 'none' }}>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
                className="double-bezel-shell"
                style={{ height: '100%' }}
              >
                <div className="double-bezel-core p-3 sm:p-4 flex items-center gap-3">
                  <img
                    src={artist.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'}
                    alt={artist.name}
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.05)' }}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <h4 style={{ color: '#fff', fontWeight: 700, fontSize: '14px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.name}</h4>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textTransform: 'capitalize' }}>{artist.role || 'Artist'}</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}

      {/* Albums Grid */}
      {albums.length > 0 && (
        <div className="col-span-1 lg:col-span-12 mt-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Albums</h3>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(255,255,255,0.1), transparent)' }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {albums.map((album, idx) => (
              <Link key={album.id} href={`/album/${album.id}`} style={{ textDecoration: 'none' }}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                  className="double-bezel-shell"
                  style={{ aspectRatio: '1' }}
                >
                  <div className="double-bezel-core" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <img src={album.cover} alt={album.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8, transition: 'all 0.7s' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.2), transparent)' }} />
                    <div style={{ marginTop: 'auto', padding: '10px sm:12px', zIndex: 10 }}>
                      <h4 style={{ color: '#fff', fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.name}</h4>
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.artist}</p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Songs Grid */}
      {songs.length > 0 && (
        <div className="col-span-1 lg:col-span-12 mt-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Songs</h3>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(255,255,255,0.1), transparent)' }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {songs.map((song, idx) => {
              const isCurrent = currentSong?.id === song.id;
              const isThisPlaying = isCurrent && isPlaying;
              return (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                  className="double-bezel-shell"
                  style={{
                    cursor: 'pointer',
                    boxShadow: isCurrent ? '0 0 30px rgba(29,185,84,0.15)' : 'none',
                    outline: isCurrent ? '1px solid rgba(29,185,84,0.5)' : 'none',
                  }}
                  onClick={() => handleStartFreshSong(song)}
                >
                  <div className="double-bezel-core p-2.5 sm:p-3 flex items-center gap-3 sm:gap-4" style={{
                    transition: 'background-color 0.5s',
                    backgroundColor: isCurrent ? 'rgba(255,255,255,0.1)' : undefined,
                  }}>
                    <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0">
                      <SongArtwork
                        cover={song.cover}
                        name={song.name}
                        songId={song.id}
                        className="song-artwork-img"
                      />
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                        transition: 'opacity 0.3s',
                        opacity: isThisPlaying ? 1 : 0,
                      }}>
                        {isThisPlaying ? <Pause size={20} weight="fill" style={{ color: '#fff' }} /> : <Play size={20} weight="fill" style={{ color: '#fff', marginLeft: '2px' }} />}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <h3 className="font-bold truncate text-sm sm:text-base transition-colors" style={{ color: isCurrent ? '#1db954' : '#fff' }} title={song.name}>
                        {song.name}
                      </h3>
                      <p className="text-white/50 text-xs sm:text-sm truncate mt-0.5" title={song.artist}>
                        {song.artist}
                      </p>
                    </div>

                    <SourceQualityBadge
                      source={song.source}
                      sourceBadge={song.sourceBadge}
                      quality={song.quality}
                      size="sm"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="spotify-explore-wrapper"><div className="spotify-section-header">Loading Explore...</div></div>}>
      <ExplorePageContent />
    </Suspense>
  );
}
