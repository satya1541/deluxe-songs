'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExploreSong, SUPPORTED_LANGUAGES, AudioSourcePlatform } from '@/types/explore';
import ExplorePlayerDeck from '@/components/explore/ExplorePlayerDeck';
import HeadphoneIntroVideo from '@/components/explore/HeadphoneIntroVideo';
import { EmotionData, getInstantEmotion } from '@/lib/emotions';
import { SearchSuggestionItem } from '@/app/api/explore/suggestions/route';

function SuggestionThumb({ image, type, title }: { image?: string; type: string; title: string }) {
  const [hasError, setHasError] = useState(false);

  if (!image || hasError) {
    return (
      <div className={`spotify-suggestion-icon-placeholder ${type === 'artist' ? 'artist' : ''}`}>
        {type === 'artist' ? '👤' : type === 'song' ? '🎵' : '🔍'}
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

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | AudioSourcePlatform>('all');
  const [songs, setSongs] = useState<ExploreSong[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentSong, setCurrentSong] = useState<ExploreSong | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [upcomingQueue, setUpcomingQueue] = useState<ExploreSong[]>([]);
  const [historyStack, setHistoryStack] = useState<ExploreSong[]>([]);
  const [activeEmotionData, setActiveEmotionData] = useState<EmotionData | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [showHeadphoneIntro, setShowHeadphoneIntro] = useState<boolean>(true);

  // AI Recommendation Toggle State (OFF by default to conserve Gemini API tokens & reduce latency)
  const [aiRecEnabled, setAiRecEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('deluxe_ai_rec_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const aiRecEnabledRef = useRef<boolean>(aiRecEnabled);
  aiRecEnabledRef.current = aiRecEnabled;

  // Search Suggestions State
  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [isDefaultSuggestions, setIsDefaultSuggestions] = useState<boolean>(true);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchResultsSectionRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [queueSourceSong, setQueueSourceSong] = useState<ExploreSong | null>(null);
  const queueSourceSongRef = useRef<ExploreSong | null>(null);
  queueSourceSongRef.current = queueSourceSong;
  const isQueueNavigationRef = useRef<boolean>(false);
  const lastLoadedRecSongIdRef = useRef<string | null>(null);
  const isReplenishingRef = useRef<boolean>(false);

  // Synchronized refs to guarantee zero-lag and non-stale closure access
  const selectedPlatformRef = useRef<'all' | AudioSourcePlatform>(selectedPlatform);
  selectedPlatformRef.current = selectedPlatform;
  const searchQueryRef = useRef<string>(searchQuery);
  searchQueryRef.current = searchQuery;
  const selectedLanguageRef = useRef<string>(selectedLanguage);
  selectedLanguageRef.current = selectedLanguage;

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

  // Toggle AI Recommendations (with localStorage persistence & automatic queue refresh)
  const toggleAiRec = useCallback(() => {
    setAiRecEnabled((prev) => {
      const next = !prev;
      aiRecEnabledRef.current = next;
      lastLoadedRecSongIdRef.current = null; // force fresh recommendation fetch
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('deluxe_ai_rec_enabled', String(next));
        } catch {}
      }
      return next;
    });
  }, []);

  // Fetch search or trending songs with multi-source platform support
  const fetchSongs = useCallback(async (
    query?: string,
    language?: string,
    platform?: 'all' | AudioSourcePlatform
  ) => {
    setIsLoading(true);
    const activeQuery = query !== undefined ? query : searchQueryRef.current;
    const activeLang = language !== undefined ? language : selectedLanguageRef.current;
    const activePlatform = platform !== undefined ? platform : selectedPlatformRef.current;

    try {
      if (activeQuery.trim()) {
        const res = await fetch(`/api/explore/search?q=${encodeURIComponent(activeQuery.trim())}&source=${encodeURIComponent(activePlatform)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.songs)) {
          setSongs(data.songs);
          scrollToSearchResults();
        }
      } else {
        const res = await fetch(`/api/explore/trending?language=${encodeURIComponent(activeLang)}&source=${encodeURIComponent(activePlatform)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.songs)) {
          setSongs(data.songs);
        }
      }
    } catch (err) {
      console.error('Error fetching explore songs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [scrollToSearchResults]);

  // Fetch search suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    setIsLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/explore/suggestions?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
        setIsDefaultSuggestions(!!data.isDefault);
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // Initial load: fetch trending songs and default suggestions
  useEffect(() => {
    fetchSongs('', selectedLanguage);
    fetchSuggestions('');
  }, [fetchSongs, fetchSuggestions, selectedLanguage]);

  // Click outside to dismiss search suggestions dropdown
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

  // Replenish queue if running low (< 5 tracks) in background without looping
  const replenishQueue = useCallback(async (sourceSong: ExploreSong) => {
    if (isReplenishingRef.current) return;
    isReplenishingRef.current = true;
    try {
      const params = new URLSearchParams({
        name: sourceSong.name,
        artist: sourceSong.artist,
        language: sourceSong.language || 'all',
        songId: sourceSong.id,
        useAi: String(aiRecEnabledRef.current),
      });

      const res = await fetch(`/api/explore/recommendations?${params.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.songs)) {
        setUpcomingQueue((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          if (currentSong) existingIds.add(currentSong.id);
          const newSongs = data.songs.filter((s: ExploreSong) => !existingIds.has(s.id));
          return [...prev, ...newSongs];
        });
      }
    } catch (e) {
      console.warn('Queue replenishment error:', e);
    } finally {
      isReplenishingRef.current = false;
    }
  }, [currentSong]);

  // Fetch same-emotion recommendations ONLY once when starting a fresh song
  useEffect(() => {
    if (!currentSong) {
      setUpcomingQueue([]);
      setActiveEmotionData(null);
      lastLoadedRecSongIdRef.current = null;
      return;
    }

    // If song changed because we stepped forward/backward in the queue, DO NOT wipe out the queue or refetch!
    if (isQueueNavigationRef.current) {
      isQueueNavigationRef.current = false;
      lastLoadedRecSongIdRef.current = currentSong.id;
      return;
    }

    // Guard against duplicate / re-render triggered fetches for the exact same track
    if (lastLoadedRecSongIdRef.current === currentSong.id) {
      return;
    }
    lastLoadedRecSongIdRef.current = currentSong.id;

    const instantEmotion = getInstantEmotion(currentSong.name, currentSong.artist);
    setActiveEmotionData(instantEmotion);
    setIsLoadingQueue(true);

    const controller = new AbortController();
    const fetchQueue = async () => {
      try {
        const params = new URLSearchParams({
          name: currentSong.name,
          artist: currentSong.artist,
          language: currentSong.language || 'all',
          songId: currentSong.id,
          useAi: String(aiRecEnabled),
        });

        const res = await fetch(`/api/explore/recommendations?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (data.success && Array.isArray(data.songs)) {
          setUpcomingQueue(data.songs);
          if (data.emotion) {
            setActiveEmotionData(data.emotion);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch same-emotion queue:', err);
        }
      } finally {
        setIsLoadingQueue(false);
      }
    };

    fetchQueue();
    return () => controller.abort();
  }, [currentSong?.id, currentSong?.name, currentSong?.artist, currentSong?.language, aiRecEnabled]);

  // Next Track in Queue - Advances queue without wiping it out!
  const handleNextSong = useCallback(() => {
    if (upcomingQueue.length === 0) return;
    isQueueNavigationRef.current = true;
    const nextTrack = upcomingQueue[0];
    const remaining = upcomingQueue.slice(1);

    if (currentSong) {
      setHistoryStack((prev) => [...prev, currentSong]);
    }
    setUpcomingQueue(remaining);
    setCurrentSong(nextTrack);
    setIsPlaying(true);

    // Replenish in background if queue is getting low
    if (remaining.length < 5 && queueSourceSongRef.current) {
      replenishQueue(queueSourceSongRef.current);
    }
  }, [upcomingQueue, currentSong, replenishQueue]);

  // Previous Track - Steps back without wiping the queue!
  const handlePrevSong = useCallback(() => {
    if (historyStack.length === 0) return;
    isQueueNavigationRef.current = true;
    const lastTrack = historyStack[historyStack.length - 1];
    const remainingHistory = historyStack.slice(0, -1);

    if (currentSong) {
      setUpcomingQueue((prev) => [currentSong, ...prev]);
    }
    setHistoryStack(remainingHistory);
    setCurrentSong(lastTrack);
    setIsPlaying(true);
  }, [historyStack, currentSong]);

  // Play a song directly from the Upcoming Queue - Preserves remaining queue!
  const handlePlayFromQueue = useCallback((song: ExploreSong) => {
    if (currentSong?.id === song.id) {
      setIsPlaying((p) => !p);
      return;
    }

    isQueueNavigationRef.current = true;
    const idx = upcomingQueue.findIndex((s) => s.id === song.id);

    if (idx !== -1) {
      // Add current song and any skipped tracks to history
      const skipped = upcomingQueue.slice(0, idx);
      if (currentSong) {
        setHistoryStack((prev) => [...prev, currentSong, ...skipped]);
      }
      // Remaining queue is everything after the clicked song
      const remaining = upcomingQueue.slice(idx + 1);
      setUpcomingQueue(remaining);

      // Replenish in background if queue is running low
      if (remaining.length < 5 && queueSourceSongRef.current) {
        replenishQueue(queueSourceSongRef.current);
      }
    }

    setCurrentSong(song);
    setIsPlaying(true);
  }, [currentSong, upcomingQueue, replenishQueue]);

  // Start fresh song from Search or Trending grid (initializes a new queue session)
  const handleStartFreshSong = useCallback((song: ExploreSong) => {
    if (currentSong?.id === song.id) {
      setIsPlaying((p) => !p);
      return;
    }

    isQueueNavigationRef.current = false;
    lastLoadedRecSongIdRef.current = null;
    setQueueSourceSong(song);
    setHistoryStack([]);
    setCurrentSong(song);
    setIsPlaying(true);
  }, [currentSong]);

  // In-app Explore Navigation Stack
  const [navHistory, setNavHistory] = useState<{ query: string; language: string }[]>([]);
  const lastNavStateRef = useRef<{ query: string; language: string }>({ query: '', language: 'all' });

  const pushNavHistory = (query: string, language: string) => {
    const current = lastNavStateRef.current;
    if (current.query === query && current.language === language) return;
    setNavHistory((prev) => [...prev, current]);
    lastNavStateRef.current = { query, language };
  };

  const handleGoBack = () => {
    // 1. If we have in-app Explore search/filter history, pop to the previous view!
    if (navHistory.length > 0) {
      const prev = navHistory[navHistory.length - 1];
      setNavHistory((h) => h.slice(0, -1));
      lastNavStateRef.current = prev;
      setSearchQuery(prev.query);
      setSelectedLanguage(prev.language);
      setIsSearchFocused(false);
      setSelectedSuggestionIndex(-1);
      fetchSongs(prev.query, prev.language);
      return;
    }

    // 2. If a search query is currently entered, go back to Explore Home (clear search)!
    if (searchQuery.trim()) {
      lastNavStateRef.current = { query: '', language: selectedLanguage };
      setSearchQuery('');
      setIsSearchFocused(false);
      setSelectedSuggestionIndex(-1);
      fetchSongs('', selectedLanguage);
      return;
    }

    // 3. If a language filter is active, revert to 'All / Global' hits
    if (selectedLanguage !== 'all') {
      lastNavStateRef.current = { query: '', language: 'all' };
      setSelectedLanguage('all');
      fetchSongs('', 'all');
      return;
    }

    // 4. Only when user is already at the root Explore page, return to Solo Player (/)
    window.location.href = '/';
  };

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setIsSearchFocused(true);
    setSelectedSuggestionIndex(-1);

    // Fast suggestions debounce (180ms)
    if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    suggestionTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 180);

    // Main search grid debounce (350ms)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      if (val.trim() && val.trim() !== lastNavStateRef.current.query) {
        pushNavHistory(val.trim(), selectedLanguageRef.current);
      }
      fetchSongs(val, selectedLanguageRef.current, selectedPlatformRef.current);
    }, 350);
  };

  const handleClearSearch = () => {
    pushNavHistory('', selectedLanguageRef.current);
    setSearchQuery('');
    fetchSongs('', selectedLanguageRef.current, selectedPlatformRef.current);
    fetchSuggestions('');
    setSelectedSuggestionIndex(-1);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleLanguageSelect = (langId: string) => {
    pushNavHistory(searchQuery, langId);
    setSelectedLanguage(langId);
    setSearchQuery('');
    setIsSearchFocused(false);
    fetchSongs('', langId, selectedPlatformRef.current);
  };

  const handlePlatformSelect = (platform: 'all' | AudioSourcePlatform) => {
    setSelectedPlatform(platform);
    selectedPlatformRef.current = platform;
    fetchSongs(searchQueryRef.current, selectedLanguageRef.current, platform);
  };

  // Select a suggestion item
  const handleSelectSuggestion = (item: SearchSuggestionItem) => {
    const chosenQuery = item.queryValue || item.title;
    pushNavHistory(chosenQuery, selectedLanguageRef.current);
    setSearchQuery(chosenQuery);
    setIsSearchFocused(false);
    setSelectedSuggestionIndex(-1);
    fetchSongs(chosenQuery, selectedLanguageRef.current, selectedPlatformRef.current);
    scrollToSearchResults();
  };

  // Keyboard navigation for suggestions
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchFocused || suggestions.length === 0) {
      if (e.key === 'Enter') {
        pushNavHistory(searchQuery, selectedLanguageRef.current);
        fetchSongs(searchQuery, selectedLanguageRef.current, selectedPlatformRef.current);
        scrollToSearchResults();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
      } else {
        pushNavHistory(searchQuery, selectedLanguageRef.current);
        setIsSearchFocused(false);
        fetchSongs(searchQuery, selectedLanguageRef.current, selectedPlatformRef.current);
        scrollToSearchResults();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsSearchFocused(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const currentLanguageName =
    SUPPORTED_LANGUAGES.find((l) => l.id === selectedLanguage)?.name || 'All / Global';

  return (
    <div className="spotify-explore-wrapper">
      {/* Spotify Top Navigation Bar */}
      <header className="spotify-top-nav">
        <div className="spotify-nav-left">
          <button
            type="button"
            className="spotify-back-btn"
            onClick={handleGoBack}
            title="Go Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back</span>
          </button>
        </div>

        {/* Global Spotify Search Field with Live Suggestions */}
        <div className="spotify-search-field-container" ref={searchContainerRef}>
          <div className="spotify-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            className="spotify-search-input"
            placeholder="What do you want to play?"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => {
              setIsSearchFocused(true);
              if (suggestions.length === 0) {
                fetchSuggestions(searchQuery);
              }
            }}
            onKeyDown={handleSearchKeyDown}
          />
          {searchQuery && (
            <button
              type="button"
              className="spotify-search-clear"
              onClick={handleClearSearch}
              title="Clear search"
            >
              ✕
            </button>
          )}

          {/* Spotify Live Search Suggestions Dropdown */}
          {isSearchFocused && suggestions.length > 0 && (
            <div className="spotify-search-dropdown">
              <div className="spotify-suggestion-header">
                <span>
                  {isDefaultSuggestions
                    ? '🔥 Popular & Trending Searches'
                    : `✨ Suggestions for "${searchQuery}"`}
                </span>
                {isLoadingSuggestions && (
                  <span style={{ fontSize: '10px', color: '#767676' }}>Updating...</span>
                )}
              </div>

              <div className="spotify-suggestion-list">
                {suggestions.map((item, idx) => {
                  const isSelected = selectedSuggestionIndex === idx;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`spotify-suggestion-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectSuggestion(item)}
                      onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                    >
                      <SuggestionThumb
                        image={item.image}
                        type={item.type}
                        title={item.title}
                      />

                      <div className="spotify-suggestion-info">
                        <span className="spotify-suggestion-title">{item.title}</span>
                        <span className="spotify-suggestion-subtitle">{item.subtitle}</span>
                      </div>

                      <span className={`spotify-suggestion-badge ${item.type}`}>
                        {item.type}
                      </span>

                      <span className="spotify-suggestion-arrow">↗</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="spotify-nav-right">
          <button
            type="button"
            className="spotify-headphone-intro-btn"
            onClick={() => setShowHeadphoneIntro(true)}
            title="Please Wear Headphones Video"
            aria-label="Play Headphone Intro Video"
          >
            🎧
          </button>
          <div
            className="spotify-hires-top-badge"
            title="Hi-Res Audio • FLAC (24 bit, 192 kHz, Stereo)"
          >
            <img
              src="/hires-audio.jpg"
              alt="Hi-Res AUDIO"
              className="spotify-hires-top-img"
            />
          </div>
        </div>
      </header>

      {/* Language & Source Filter Rail */}
      <div className="spotify-filter-rail-wrapper">
        <div className="spotify-filter-rail">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => handleLanguageSelect(lang.id)}
              className={`spotify-tag-pill ${selectedLanguage === lang.id ? 'active' : ''}`}
            >
              {lang.name}
            </button>
          ))}
        </div>

        {/* Source Platform Switcher */}
        <div className="spotify-source-rail">
          <span className="spotify-source-label">Source:</span>
          {[
            { id: 'all', label: 'All Sources', icon: '🌐' },
            { id: 'jiosaavn', label: 'JioSaavn 320k', icon: '⚡' },
            { id: 'youtube', label: 'YouTube Music', icon: '▶' },
            { id: 'soundcloud', label: 'SoundCloud', icon: '☁' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePlatformSelect(p.id as any)}
              className={`spotify-source-pill source-${p.id} ${selectedPlatform === p.id ? 'active' : ''}`}
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}

          <div className="spotify-filter-rail-divider" />

          {/* AI Recommendation Toggle Button */}
          <button
            type="button"
            onClick={toggleAiRec}
            className={`spotify-source-pill spotify-ai-rec-toggle-pill ${aiRecEnabled ? 'active' : ''}`}
            title={
              aiRecEnabled
                ? 'AI Recommendation: ON (Gemini AI DJ enabled) • Click to turn OFF & save tokens'
                : 'AI Recommendation: OFF (Using Fast Multi-Source fallback) • Click to turn ON'
            }
          >
            <span>{aiRecEnabled ? '✨' : '🤖'}</span>
            <span>AI Recommendation: {aiRecEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="spotify-explore-main">
        {/* ================================================================= */}
        {/* DYNAMIC "UP NEXT: SAME EMOTION" SECTION (When song is active)     */}
        {/* ================================================================= */}
        {currentSong && upcomingQueue.length > 0 && (
          <section className="spotify-emotion-queue-section">
            <div className="spotify-emotion-queue-header">
              <div className="spotify-emotion-queue-title-wrap">
                <div className="spotify-emotion-badge-pill">
                  <span>{activeEmotionData?.icon || '✨'}</span>
                  <span className="spotify-emotion-badge-name">
                    {activeEmotionData?.label || 'Same Emotion'} Vibe
                  </span>
                </div>
                <h2 className="spotify-section-heading">
                  Up Next from Queue
                </h2>
                <p className="spotify-section-sub">
                  Autoplay ON • Continuously queuing tracks matching the mood of{' '}
                  <strong style={{ color: '#ffffff' }}>"{queueSourceSong?.name || currentSong.name}"</strong>
                </p>
              </div>

              <div className="spotify-queue-actions">
                <button
                  type="button"
                  className={`spotify-ghost-pill spotify-ai-rec-toggle-pill ${aiRecEnabled ? 'active' : ''}`}
                  onClick={toggleAiRec}
                  title={
                    aiRecEnabled
                      ? 'AI Recommendation: ON (Gemini AI DJ) • Click to turn OFF & save tokens'
                      : 'AI Recommendation: OFF (Fast Multi-Source) • Click to turn ON'
                  }
                >
                  <span>{aiRecEnabled ? '✨ AI Rec: ON' : '🤖 AI Rec: OFF'}</span>
                </button>
                <button
                  type="button"
                  className="spotify-ghost-pill"
                  onClick={handleNextSong}
                  title="Skip to next same-emotion track"
                >
                  <span>Play Next</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Horizontal Rail of Upcoming Same-Emotion Songs */}
            <div className="spotify-emotion-rail">
              {upcomingQueue.slice(0, 10).map((song, idx) => {
                const isCurrent = currentSong?.id === song.id;
                const isThisPlaying = isCurrent && isPlaying;

                return (
                  <article
                    key={`upnext-${song.id}-${idx}`}
                    className={`spotify-album-card spotify-queue-rail-card ${
                      isCurrent ? 'card-active' : ''
                    }`}
                    onClick={() => handlePlayFromQueue(song)}
                  >
                    <div className="spotify-card-artwork-wrap">
                      <img
                        src={song.cover}
                        alt={song.name}
                        className="spotify-card-img"
                        loading="lazy"
                      />
                      <span className="spotify-rail-order-tag">#{idx + 1} Up Next</span>

                      <button
                        type="button"
                        className={`spotify-play-badge ${isThisPlaying ? 'badge-playing' : ''}`}
                        aria-label={isThisPlaying ? 'Pause' : 'Play'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayFromQueue(song);
                        }}
                      >
                        {isThisPlaying ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="spotify-card-meta">
                      <h3
                        className={`spotify-card-title ${isCurrent ? 'title-playing' : ''}`}
                        title={song.name}
                      >
                        {song.name}
                      </h3>
                      <p className="spotify-card-artist" title={song.artist}>
                        {song.artist}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Section Heading for Main Browse / Search */}
        <div
          ref={searchResultsSectionRef}
          className="spotify-section-header"
          style={{ scrollMarginTop: '150px' }}
        >
          <h2 className="spotify-section-heading">
            {searchQuery ? `Search results for "${searchQuery}"` : `${currentLanguageName} Hits`}
          </h2>
          <span className="spotify-results-count">
            {isLoading ? 'Searching...' : `${songs.length} tracks`}
          </span>
        </div>

        {/* Content State: Loading Skeleton */}
        {isLoading ? (
          <div className="spotify-grid">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="spotify-card-skeleton">
                <div className="skeleton-thumb" />
                <div className="skeleton-title" />
                <div className="skeleton-subtitle" />
              </div>
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="spotify-empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No results found for &ldquo;{searchQuery}&rdquo;</h3>
            <p>Check your spelling, or try searching for another artist or language.</p>
          </div>
        ) : (
          /* Song Grid with 6px rounded Obsidian cards */
          <div className="spotify-grid">
            {songs.map((song) => {
              const isCurrent = currentSong?.id === song.id;
              const isThisPlaying = isCurrent && isPlaying;

              return (
                <article
                  key={song.id}
                  className={`spotify-album-card ${isCurrent ? 'card-active' : ''}`}
                  onClick={() => handleStartFreshSong(song)}
                >
                  {/* Square 1:1 Album Artwork */}
                  <div className="spotify-card-artwork-wrap">
                    <img
                      src={song.cover}
                      alt={song.name}
                      className="spotify-card-img"
                      loading="lazy"
                    />

                    {/* Spotify Green Circular Play Button (Slides up on card hover) */}
                    <button
                      type="button"
                      className={`spotify-play-badge ${isThisPlaying ? 'badge-playing' : ''}`}
                      aria-label={isThisPlaying ? 'Pause' : 'Play'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartFreshSong(song);
                      }}
                    >
                      {isThisPlaying ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Metadata Block */}
                  <div className="spotify-card-meta">
                    <h3 className={`spotify-card-title ${isCurrent ? 'title-playing' : ''}`} title={song.name}>
                      {song.name}
                    </h3>
                    <p className="spotify-card-artist" title={song.artist}>
                      {song.artist}
                    </p>
                    {song.sourceBadge && (
                      <div
                        className="spotify-card-source-tag"
                        style={{
                          backgroundColor: song.sourceBadge.bg,
                          color: song.sourceBadge.color,
                          borderColor: song.sourceBadge.border,
                        }}
                      >
                        <span className="tag-icon">{song.sourceBadge.icon}</span>
                        <span className="tag-name">{song.sourceBadge.name}</span>
                        <span className="tag-sep">•</span>
                        <span className="tag-quality">{song.sourceBadge.qualityLabel}</span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Spotify Bottom Persistent Playback Bar with Upcoming Queue */}
      <ExplorePlayerDeck
        currentSong={currentSong}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onNextSong={handleNextSong}
        onPrevSong={handlePrevSong}
        hasNext={upcomingQueue.length > 0}
        hasPrev={historyStack.length > 0}
        upcomingQueue={upcomingQueue}
        activeEmotionData={activeEmotionData}
        onSelectFromQueue={(song) => handlePlayFromQueue(song)}
        aiRecEnabled={aiRecEnabled}
        onToggleAiRec={toggleAiRec}
        onClose={() => {
          setIsPlaying(false);
          setCurrentSong(null);
        }}
      />

      {/* Headphone Intro Video (Desktop/Tablet & Mobile responsive) */}
      {showHeadphoneIntro && (
        <HeadphoneIntroVideo onComplete={() => setShowHeadphoneIntro(false)} />
      )}
    </div>
  );
}
