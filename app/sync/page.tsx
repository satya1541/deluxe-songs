'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { GlobalRadioState } from '@/types/sync';
import SyncStationPlayer from '@/components/sync/SyncStationPlayer';
import DynamicBackground from '@/components/DynamicBackground';
import { useWakeLock } from '@/hooks/useWakeLock';

export default function SyncPage() {
  // Stable Client UUID for real-time active listener heartbeat
  const [clientId] = useState<string>(() => {
    if (typeof window === 'undefined') return `client-${Date.now()}`;
    let stored = sessionStorage.getItem('deluxe_sync_client_id');
    if (!stored) {
      stored = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('deluxe_sync_client_id', stored);
    }
    return stored;
  });

  // Global Radio State
  const [globalState, setGlobalState] = useState<GlobalRadioState | null>(null);

  // Top Bar Feature States
  const [visualsEnabled, setVisualsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('deluxe_visuals_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const [screenAwake, setScreenAwake] = useState<boolean>(true);

  // Screen Wake Lock: Keeps display awake during live broadcast
  const wakeLock = useWakeLock(screenAwake);

  const toggleVisuals = useCallback(() => {
    setVisualsEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('deluxe_visuals_enabled', String(next));
        } catch { }
      }
      return next;
    });
  }, []);

  const toggleScreenAwake = useCallback(() => {
    setScreenAwake((prev) => !prev);
  }, []);

  // 1. Fetch Global Radio Broadcast State & Send Heartbeat (every 5s)
  const fetchGlobalRadio = useCallback(async () => {
    try {
      const res = await fetch(`/api/sync/global?clientId=${encodeURIComponent(clientId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setGlobalState((prev) => {
            if (!prev) return data.state;
            const prevSongKey = prev.song?.fileName || prev.song?.name;
            const nextSongKey = data.state.song?.fileName || data.state.song?.name;
            // If same song, preserve startedAt and song reference to prevent audio reset
            if (prevSongKey === nextSongKey) {
              return {
                ...prev,
                activeListeners: data.state.activeListeners,
                nextSong: data.state.nextSong,
              };
            }
            return data.state;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to poll global radio:', e);
    }
  }, [clientId]);

  useEffect(() => {
    fetchGlobalRadio();
    const interval = setInterval(fetchGlobalRadio, 5000);
    return () => clearInterval(interval);
  }, [fetchGlobalRadio]);

  // Send leave notification on tab close/unload to immediately update listener count
  useEffect(() => {
    const handleUnload = () => {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/sync/global?action=leave&clientId=${encodeURIComponent(clientId)}`);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [clientId]);

  const handleGlobalSongEnded = () => {
    fetchGlobalRadio();
  };

  const listenerCount = globalState?.activeListeners ?? 1;

  return (
    <div className="sync-page-wrapper">
      <DynamicBackground />

      {/* Top Bar Header */}
      <header className="sync-top-nav">
        <div className="sync-nav-left">
          <Link href="/" className="sync-back-home-btn" title="Back to Solo Music Player">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Solo Player</span>
          </Link>

          <Link href="/explore" className="sync-back-home-btn" title="Search & Stream All Music (320kbps Master)">
            <span>Search and Stream</span>
          </Link>

          <div className="sync-brand-pill">
            <span className="sync-pulse-indicator" />
            <span className="sync-brand-text">DELUXE LIVE BROADCAST</span>
          </div>
        </div>

        <div className="sync-nav-right">
          {/* Stay Awake Screen Toggle */}
          <button
            type="button"
            className={`topbar-wake-btn ${screenAwake ? 'wake-active' : 'wake-inactive'}`}
            onClick={toggleScreenAwake}
            title={
              screenAwake
                ? wakeLock.isLocked
                  ? '☀️ Screen Awake: ACTIVE (Screen will not sleep during playback)'
                  : '☀️ Screen Awake: ENABLED'
                : '🌙 Screen Awake: OFF (Device normal sleep timeout)'
            }
            aria-label="Toggle Screen Stay Awake"
          >
            {screenAwake ? (
              <>
                <span className={`wake-dot ${wakeLock.isLocked ? 'wake-dot-pulse' : ''}`} />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
                <span className="topbar-btn-text">Awake: ON</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span className="topbar-btn-text">Awake: OFF</span>
              </>
            )}
          </button>

          {/* Toggle Visuals / Weather Animations */}
          <button
            type="button"
            className="topbar-visuals-btn"
            onClick={toggleVisuals}
            title={visualsEnabled ? 'Disable Visual Effects' : 'Enable Visual Effects'}
          >
            {visualsEnabled ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="topbar-btn-text">Animation: ON</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
                <span className="topbar-btn-text">Animation: OFF</span>
              </>
            )}
          </button>

          {/* Real-time Online Listener Chip */}
          <div className="sync-online-chip" title="Real-time connected live listeners">
            <span className="chip-dot" />
            <span>
              {listenerCount} {listenerCount === 1 ? 'Listener Live' : 'Listening Live'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Broadcast Content Area */}
      <main className="sync-main-content">
        <div className="sync-tab-content global-mode">
          <SyncStationPlayer
            song={globalState?.song || null}
            isPlaying={true}
            expectedPosition={globalState?.elapsedSec || 0}
            startedAtEpoch={globalState?.startedAt || 0}
            isHost={false}
            onSongEnded={handleGlobalSongEnded}
            titleBadge="24/7 GLOBAL RADIO"
            nextSong={globalState?.nextSong || null}
            visualsEnabled={visualsEnabled}
          />
        </div>
      </main>
    </div>
  );
}
