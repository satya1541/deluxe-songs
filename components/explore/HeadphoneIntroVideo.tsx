'use client';

import React, { useState, useEffect, useRef } from 'react';

interface HeadphoneIntroVideoProps {
  onComplete?: () => void;
}

export default function HeadphoneIntroVideo({ onComplete }: HeadphoneIntroVideoProps) {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Detect mobile vs desktop/tablet view
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Autoplay handler
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to muted autoplay if browser policy restricts unmuted autoplay on initial visit
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }, [isMobile]);

  const handleDismiss = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, 400);
  };

  const handleVideoEnded = () => {
    handleDismiss();
  };

  if (!isVisible) return null;

  const videoSrc = isMobile
    ? '/videos/please-wear-headphone-mobile.mp4'
    : '/videos/please-wear-headphone-desktop.mp4';

  return (
    <div
      className={`headphone-intro-fullscreen ${isFadingOut ? 'fade-out' : ''}`}
      aria-modal="true"
      role="dialog"
    >
      {/* Pure 100% Fullscreen Video - No overlays, no buttons */}
      <video
        ref={videoRef}
        key={videoSrc}
        src={videoSrc}
        autoPlay
        playsInline
        onEnded={handleVideoEnded}
        className="headphone-intro-fullscreen-video"
      />
    </div>
  );
}
