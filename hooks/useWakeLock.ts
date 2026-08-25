'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseWakeLockReturn {
  isLocked: boolean;
  isSupported: boolean;
  requestLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  toggleLock: () => Promise<void>;
}

export function useWakeLock(autoLock: boolean = false): UseWakeLockReturn {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);
  const userWantsLockRef = useRef<boolean>(autoLock);
  const fallbackVideoRef = useRef<HTMLVideoElement | null>(null);

  // Check support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = 'wakeLock' in navigator;
      setIsSupported(supported);
    }
  }, []);

  // Cleanup fallback video if any
  const stopFallbackVideo = useCallback(() => {
    if (fallbackVideoRef.current) {
      try {
        fallbackVideoRef.current.pause();
        fallbackVideoRef.current.src = '';
        fallbackVideoRef.current.remove();
      } catch {}
      fallbackVideoRef.current = null;
    }
  }, []);

  // Start fallback for older iOS / Android browsers that don't support navigator.wakeLock
  const startFallbackKeepAlive = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (fallbackVideoRef.current) return;

    try {
      // 1x1 invisible blank MP4 encoded in base64
      const blankMp4 =
        'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAADpmcmVlAAAAWG1kYXQAAAAAAAACAAAC' +
        'AAACAAACAAAAAAACAAACAAAAAAACAAACAAAAAAACAAACAAAAAAACAAACAAAAAAACAAACAAAAAAACAAACAA==';

      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.muted = true;
      video.loop = true;
      video.style.position = 'fixed';
      video.style.opacity = '0.001';
      video.style.pointerEvents = 'none';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.top = '-100px';
      video.src = blankMp4;

      document.body.appendChild(video);
      video.play().catch(() => {});
      fallbackVideoRef.current = video;
      setIsLocked(true);
    } catch {}
  }, []);

  // Release wake lock helper
  const releaseLock = useCallback(async () => {
    userWantsLockRef.current = false;
    stopFallbackVideo();

    if (wakeLockSentinelRef.current) {
      try {
        await wakeLockSentinelRef.current.release();
      } catch (err) {
        console.warn('Wake Lock release error:', err);
      } finally {
        wakeLockSentinelRef.current = null;
        setIsLocked(false);
      }
    } else {
      setIsLocked(false);
    }
  }, [stopFallbackVideo]);

  // Request wake lock helper
  const requestLock = useCallback(async (): Promise<boolean> => {
    userWantsLockRef.current = true;
    if (typeof window === 'undefined') return false;

    if ('wakeLock' in navigator) {
      try {
        // If already active, don't duplicate
        if (wakeLockSentinelRef.current && !wakeLockSentinelRef.current.released) {
          setIsLocked(true);
          return true;
        }

        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinelRef.current = sentinel;
        setIsLocked(true);

        sentinel.addEventListener('release', () => {
          wakeLockSentinelRef.current = null;
          // Only mark unlocked if user didn't want it locked
          if (!userWantsLockRef.current) {
            setIsLocked(false);
          }
        });

        return true;
      } catch (err: any) {
        console.warn('Screen Wake Lock request notice (will use fallback):', err?.message || err);
        // Fallback on error (e.g. low power mode)
        startFallbackKeepAlive();
        return true;
      }
    } else {
      // Fallback for browsers without native wakeLock API
      startFallbackKeepAlive();
      return true;
    }
  }, [startFallbackKeepAlive]);

  const toggleLock = useCallback(async () => {
    if (isLocked) {
      await releaseLock();
    } else {
      await requestLock();
    }
  }, [isLocked, releaseLock, requestLock]);

  // Synchronize autoLock prop changes
  useEffect(() => {
    userWantsLockRef.current = autoLock;
    if (autoLock) {
      requestLock();
    } else {
      releaseLock();
    }
  }, [autoLock, requestLock, releaseLock]);

  // Automatically re-acquire wake lock when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userWantsLockRef.current) {
        setTimeout(() => {
          requestLock();
        }, 300);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [requestLock]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopFallbackVideo();
      if (wakeLockSentinelRef.current) {
        wakeLockSentinelRef.current.release().catch(() => {});
        wakeLockSentinelRef.current = null;
      }
    };
  }, [stopFallbackVideo]);

  return {
    isLocked,
    isSupported,
    requestLock,
    releaseLock,
    toggleLock,
  };
}
