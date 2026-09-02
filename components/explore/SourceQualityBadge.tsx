'use client';

import React from 'react';
import { SourceBadge, AudioSourcePlatform } from '@/types/explore';

interface SourceQualityBadgeProps {
  source?: AudioSourcePlatform | string;
  sourceBadge?: SourceBadge;
  quality?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export default function SourceQualityBadge({
  source,
  sourceBadge,
  quality,
  size = 'sm',
  className = '',
  showText = true,
}: SourceQualityBadgeProps) {
  const isLossless =
    source === 'jiosaavn' ||
    quality === '320kbps' ||
    sourceBadge?.name?.toLowerCase().includes('saavn') ||
    sourceBadge?.name?.toLowerCase().includes('lossless') ||
    sourceBadge?.logoUrl?.includes('lossless');

  const isOpus =
    source === 'youtube' ||
    quality === '160kbps' ||
    sourceBadge?.name?.toLowerCase().includes('youtube') ||
    sourceBadge?.name?.toLowerCase().includes('opus') ||
    sourceBadge?.logoUrl?.includes('opus');

  const logoSrc = isLossless
    ? '/lossless-logo.jpeg'
    : isOpus
    ? '/opus-logo.jpeg'
    : sourceBadge?.logoUrl;

  const label = isLossless ? 'Lossless' : isOpus ? 'Opus' : sourceBadge?.name || 'HQ';

  const sizeClasses = {
    sm: {
      img: 'h-3.5 w-auto max-w-[40px]',
      container: 'px-2 py-0.5 text-[10px] gap-1.5',
      text: 'text-[10px]',
    },
    md: {
      img: 'h-4 w-auto max-w-[48px]',
      container: 'px-2.5 py-1 text-[11px] gap-1.5',
      text: 'text-[11px]',
    },
    lg: {
      img: 'h-5 w-auto max-w-[60px]',
      container: 'px-3 py-1.5 text-xs gap-2',
      text: 'text-xs',
    },
  }[size];

  const badgeStyle = isLossless
    ? 'bg-[#12281e] text-[#4ade80] border-[#22c55e]/40 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
    : isOpus
    ? 'bg-[#2b1416] text-[#f87171] border-[#ef4444]/40 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
    : 'bg-white/10 text-white/90 border-white/20';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium tracking-wide border transition-all duration-200 select-none ${sizeClasses.container} ${badgeStyle} ${className}`}
      title={`${label} Master Quality`}
    >
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={label}
          className={`${sizeClasses.img} rounded-[2px] object-contain shrink-0`}
          loading="lazy"
        />
      ) : (
        <span>{sourceBadge?.icon || '🎵'}</span>
      )}
      {showText && <span className={`font-semibold ${sizeClasses.text}`}>{label}</span>}
    </span>
  );
}
