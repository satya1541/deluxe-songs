'use client';

import { useState, useEffect } from 'react';

export default function TopBar() {
  const [currentTime, setCurrentTime] = useState<string>('12:00 pm');
  const [onlineCount, setOnlineCount] = useState<number>(41);
  const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(true);

  useEffect(() => {
    // Check initial stored animation preference
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('deluxe_animations_enabled');
      const isEnabled = stored !== 'false';
      setAnimationsEnabled(isEnabled);
      if (!isEnabled) {
        document.body.classList.add('no-animations');
      }
    }

    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12 || 12;
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };

    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    const updateOnlineCount = () => {
      const base = 38;
      const variation = Math.floor(Math.random() * 12);
      setOnlineCount(base + variation);
    };

    const onlineInterval = setInterval(updateOnlineCount, 8000);

    const handleExternalToggle = (e: any) => {
      if (e?.detail?.enabled !== undefined) {
        setAnimationsEnabled(e.detail.enabled);
      }
    };

    window.addEventListener('toggle-animations', handleExternalToggle);

    return () => {
      clearInterval(clockInterval);
      clearInterval(onlineInterval);
      window.removeEventListener('toggle-animations', handleExternalToggle);
    };
  }, []);

  const handleToggleCinema = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toggle-cinema-mode'));
    }
  };

  const handleToggleAnimations = () => {
    setAnimationsEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('deluxe_animations_enabled', String(next));
        if (next) {
          document.body.classList.remove('no-animations');
        } else {
          document.body.classList.add('no-animations');
        }
        window.dispatchEvent(new CustomEvent('toggle-animations', { detail: { enabled: next } }));
      }
      return next;
    });
  };

  return (
    <header className="top-bar">
      <div className="top-left">
        <span className="time" suppressHydrationWarning>{currentTime}</span>
      </div>

      <div className="top-center">
        <span className="online-dot"></span>
        <span className="online-count" suppressHydrationWarning>{onlineCount}</span>
        <span className="online-label">online</span>
      </div>

      <div className="top-right">
        {/* Visual FX / Eco Mode (Disable Animations) Toggle Button */}
        <button
          type="button"
          className={`topbar-fx-btn ${animationsEnabled ? 'fx-active' : 'fx-eco'}`}
          onClick={handleToggleAnimations}
          title={animationsEnabled ? 'Visual FX: ON (Click to disable animations / save battery)' : 'Eco Mode: ON (Click to enable visual animations)'}
          aria-label={animationsEnabled ? 'Disable animations (Eco Mode)' : 'Enable animations'}
        >
          <span className="fx-icon">{animationsEnabled ? '✨' : '⚡'}</span>
          <span className="fx-text">{animationsEnabled ? 'FX' : 'Eco'}</span>
        </button>

        {/* Sleek Fullscreen Cinema Immersion Button */}
        <button
          type="button"
          className="topbar-cinema-btn"
          onClick={handleToggleCinema}
          title="Fullscreen Cinema Immersion (Press F)"
          aria-label="Fullscreen Cinema Immersion (Press F)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
          <span className="topbar-cinema-label">Full Screen</span>
          <kbd className="topbar-kbd">F</kbd>
        </button>

        <a
          href="https://open.spotify.com"
          target="_blank"
          rel="noopener noreferrer"
          className="music-link spotify-link"
          title="Open Spotify"
        >
          <svg className="spotify-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <span className="music-link-text">Spotify</span>
          <svg className="external-icon" viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
            <path d="M3.5 1.5a.5.5 0 0 0 0 1H5.793L2.146 6.146a.5.5 0 1 0 .708.708L6.5 3.207V5.5a.5.5 0 0 0 1 0v-4h-4z" transform="translate(1.5, 1.5) scale(0.85)" />
          </svg>
        </a>

        <a
          href="https://music.youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          className="music-link yt-link"
          title="Open YouTube Music"
        >
          <svg className="yt-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 2.16c5.424 0 9.84 4.416 9.84 9.84S17.424 21.84 12 21.84 2.16 17.424 2.16 12 6.576 2.16 12 2.16zM9.6 8.4v7.2l6-3.6-6-3.6z" />
          </svg>
          <span className="music-link-text">YT Music</span>
          <svg className="external-icon" viewBox="0 0 12 12" width="10" height="10" fill="currentColor">
            <path d="M3.5 1.5a.5.5 0 0 0 0 1H5.793L2.146 6.146a.5.5 0 1 0 .708.708L6.5 3.207V5.5a.5.5 0 0 0 1 0v-4h-4z" transform="translate(1.5, 1.5) scale(0.85)" />
          </svg>
        </a>
      </div>
    </header>
  );
}
