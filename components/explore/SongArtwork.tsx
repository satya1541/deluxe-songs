'use client';

import React, { useState, useEffect } from 'react';

interface SongArtworkProps {
  cover: string;
  name: string;
  songId?: string;
  className?: string;
  priority?: boolean;
}

export default function SongArtwork({
  cover,
  name,
  songId,
  className = 'spotify-card-img',
  priority = false,
}: SongArtworkProps) {
  const cleanYtId = songId?.startsWith('yt_') ? songId.replace(/^yt_/, '') : '';

  const getCleanUrl = (url?: string) => {
    if (!url) {
      return cleanYtId ? `https://i.ytimg.com/vi/${cleanYtId}/hqdefault.jpg` : '';
    }
    let cleaned = url.trim();

    if (cleaned.includes('googleusercontent.com') || cleaned.includes('ggpht.com')) {
      if (/=w\d+-h\d+.*$/.test(cleaned)) {
        cleaned = cleaned.replace(/=w\d+-h\d+.*$/, '=w800-h800-l90-rj');
      } else if (/=s\d+.*$/.test(cleaned)) {
        cleaned = cleaned.replace(/=s\d+.*$/, '=w800-h800-l90-rj');
      } else if (!cleaned.includes('=')) {
        cleaned = `${cleaned}=w800-h800-l90-rj`;
      }
    } else if (cleaned.includes('i.ytimg.com')) {
      cleaned = cleaned.replace(/\/(default|mqdefault|sddefault)\.jpg/, '/hqdefault.jpg');
    } else if (cleaned.includes('saavncdn.com')) {
      cleaned = cleaned
        .replace(/50x50\.jpg/gi, '500x500.jpg')
        .replace(/150x150\.jpg/gi, '500x500.jpg')
        .replace(/250x250\.jpg/gi, '500x500.jpg');
    } else if (cleaned.includes('sndcdn.com')) {
      cleaned = cleaned.replace('-large.', '-t500x500.');
    } else if (cleanYtId && /^[a-zA-Z0-9_-]{11}$/.test(cleanYtId)) {
      return `https://i.ytimg.com/vi/${cleanYtId}/hqdefault.jpg`;
    }
    return cleaned;
  };

  const [currentSrc, setCurrentSrc] = useState<string>(() => getCleanUrl(cover));
  const [errorStep, setErrorStep] = useState<number>(0);

  useEffect(() => {
    setCurrentSrc(getCleanUrl(cover));
    setErrorStep(0);
  }, [cover, cleanYtId]);

  const handleError = () => {
    if (errorStep === 0 && cleanYtId) {
      setErrorStep(1);
      setCurrentSrc(`https://i.ytimg.com/vi/${cleanYtId}/hqdefault.jpg`);
    } else if (errorStep === 1 && cleanYtId) {
      setErrorStep(2);
      setCurrentSrc(`/api/explore/thumbnail?id=${encodeURIComponent(cleanYtId)}&url=${encodeURIComponent(cover || '')}`);
    } else {
      setErrorStep(3);
      setCurrentSrc('https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80');
    }
  };

  return (
    <img
      src={currentSrc}
      alt={name}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      onLoad={(e) => {
        // YouTube returns a 120x90 dummy 3-dot image for missing maxresdefault
        if (e.currentTarget.naturalWidth <= 120 && cleanYtId && errorStep === 0) {
          setErrorStep(1);
          setCurrentSrc(`https://i.ytimg.com/vi/${cleanYtId}/hqdefault.jpg`);
        }
      }}
      onError={handleError}
    />
  );
}
