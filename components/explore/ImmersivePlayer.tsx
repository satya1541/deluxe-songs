import React from 'react';
import { ExploreSong } from '@/types/explore';
import { CaretDown, SkipBack, Play, Pause, SkipForward, Faders, List, SpeakerHigh, SpeakerLow, SpeakerSlash, DotsThree, Heart } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import SourceQualityBadge from '@/components/explore/SourceQualityBadge';

interface ImmersivePlayerProps {
  currentSong: ExploreSong;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextSong?: () => void;
  onPrevSong?: () => void;
  upcomingQueue: ExploreSong[];
  historyStack: ExploreSong[];
  onMinimize: () => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onOpenEnhancer: () => void;
  onToggleQueue?: () => void;
  currentTime: number;
  duration: number;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  isLoadingAudio: boolean;
  formatTime: (secs: number) => string;
}

function getHdImage(url?: string, songId?: string) {
  const cleanId = (songId || '').replace(/^yt_/, '').trim();

  // 1. YouTube Music / Google CDN (always high quality, never 404s)
  if (url && (url.includes('googleusercontent.com') || url.includes('ggpht.com'))) {
    return url.replace(/=w\d+-h\d+[^&]*/g, '=w800-h800-l90-rj').replace(/=s\d+[^&]*/g, '=s800');
  }

  // 2. JioSaavn CDN
  if (url && url.includes('saavncdn.com')) {
    return url.replace(/-(?:50x50|150x150|250x250)\.jpg/g, '-500x500.jpg');
  }

  // 3. YouTube standard video: use hq720 or hqdefault which 100% exists
  if (url && url.includes('ytimg.com')) {
    if (url.includes('maxresdefault.jpg')) {
      return url;
    }
    return url.replace(/(mqdefault|default|sddefault)\.jpg/g, 'hqdefault.jpg');
  }

  // 4. Fallback from cleanId
  if (cleanId && /^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
    return `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`;
  }

  return url || '/default-cover.png';
}

export default function ImmersivePlayer({
  currentSong,
  isPlaying,
  onTogglePlay,
  onNextSong,
  onPrevSong,
  upcomingQueue,
  historyStack,
  onMinimize,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  onOpenEnhancer,
  onToggleQueue,
  currentTime,
  duration,
  onSeek,
  isLoadingAudio,
  formatTime,
}: ImmersivePlayerProps) {
  const [isLiked, setIsLiked] = React.useState(false);

  // Build the 5-card carousel array: 2 prev, 1 current, 2 next
  const prevItems = historyStack.slice(-2);
  const nextItems = upcomingQueue.slice(0, 2);

  const carouselItems: { offset: number; song: ExploreSong }[] = [];

  // Previous items (offset -2, -1)
  prevItems.forEach((song, i) => {
    carouselItems.push({ offset: -(prevItems.length - i), song });
  });

  // Current item (offset 0)
  carouselItems.push({ offset: 0, song: currentSong });

  // Next items (offset +1, +2)
  nextItems.forEach((song, i) => {
    carouselItems.push({ offset: i + 1, song });
  });

  const displayVolume = isMuted ? 0 : volume;
  const cleanId = (currentSong.id || '').replace(/^yt_/, '').trim();
  const progressPercent = Math.min(100, (currentTime / (duration || currentSong.duration || 240)) * 100);

  const handleCardClick = (offset: number) => {
    if (offset < 0 && onPrevSong) {
      onPrevSong();
    } else if (offset > 0 && onNextSong) {
      onNextSong();
    } else if (offset === 0) {
      onTogglePlay();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 z-[9999] flex flex-col justify-between overflow-hidden text-white font-sans bg-[#090a0f] select-none"
    >
      {/* 100% Opaque Solid Dark Gradient Base */}
      <div className="absolute inset-0 bg-[#090a0f] -z-30 pointer-events-none" />

      {/* Dynamic blurred ambient lighting extracted from album cover */}
      <div
        className="absolute inset-[-20%] bg-cover bg-center -z-20 pointer-events-none transition-all duration-1000 ease-out"
        style={{
          backgroundImage: `url(${getHdImage(currentSong.cover, currentSong.id)})`,
          filter: 'blur(80px) saturate(2) brightness(0.32)',
          transform: 'scale(1.25)',
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/60 to-[#090a0f] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-2 flex items-center justify-between z-10">
        <button
          type="button"
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white transition-all backdrop-blur-md border border-white/10"
          onClick={onMinimize}
          title="Minimize"
        >
          <CaretDown size={22} weight="bold" />
        </button>

        <div className="flex flex-col items-center text-center px-4 min-w-0">
          <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-white/50 uppercase">
            Playing From Search
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-xs mt-0.5">
            {currentSong.artist}
          </span>
        </div>

        <button
          type="button"
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white transition-all backdrop-blur-md border border-white/10"
          onClick={onToggleQueue || onMinimize}
          title="Queue"
        >
          <List size={20} weight="bold" />
        </button>
      </header>

      {/* Main Center Area: Mobile Large Artwork or Desktop 3D Cover Flow */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-6 sm:px-8 min-h-0 py-2">
        
        {/* Mobile View Artwork (< 768px) */}
        <div className="flex md:hidden flex-col items-center justify-center w-full my-auto">
          <motion.div
            key={currentSong.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: isPlaying ? 1 : 0.94, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="w-[72vw] max-w-[310px] aspect-square rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.85)] border border-white/15 relative group"
          >
            <img
              src={getHdImage(currentSong.cover, currentSong.id)}
              alt={currentSong.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const currentSrc = e.currentTarget.src;
                if (currentSrc.includes('maxresdefault.jpg') && cleanId) {
                  e.currentTarget.src = `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`;
                } else if (cleanId) {
                  e.currentTarget.src = `/api/explore/thumbnail?id=${cleanId}&url=${encodeURIComponent(currentSong.cover || '')}`;
                } else {
                  e.currentTarget.src = '/default-cover.png';
                }
              }}
            />
          </motion.div>
        </div>

        {/* Desktop View 3D Coverflow (>= 768px) */}
        <div className="hidden md:flex relative w-full h-[360px] items-center justify-center perspective-[1400px] transform-style-3d">
          <AnimatePresence initial={false}>
            {carouselItems.map(({ offset, song }) => {
              const isActive = offset === 0;
              const absOffset = Math.abs(offset);
              const isPrev = offset < 0;
              const itemCleanId = (song.id || '').replace(/^yt_/, '').trim();

              const targetX = offset === 0 ? 0 : offset === -1 ? '-72%' : offset === -2 ? '-130%' : offset === 1 ? '72%' : '130%';
              const targetZ = offset === 0 ? 80 : absOffset === 1 ? -90 : -220;
              const targetRotateY = offset === 0 ? 0 : isPrev ? (32 + (absOffset * 8)) : -(32 + (absOffset * 8));
              const targetScale = offset === 0 ? 1 : absOffset === 1 ? 0.86 : 0.72;
              const targetOpacity = offset === 0 ? 1 : absOffset === 1 ? 0.75 : 0.35;
              const targetBrightness = offset === 0 ? 1 : absOffset === 1 ? 0.7 : 0.45;
              const zIndex = 20 - absOffset * 5;

              return (
                <motion.div
                  key={song.id}
                  initial={{
                    x: offset < 0 ? '-140%' : offset > 0 ? '140%' : 0,
                    z: -260,
                    rotateY: offset < 0 ? 55 : offset > 0 ? -55 : 0,
                    scale: 0.65,
                    opacity: 0,
                  }}
                  animate={{
                    x: targetX,
                    z: targetZ,
                    rotateY: targetRotateY,
                    scale: targetScale,
                    opacity: targetOpacity,
                    filter: `brightness(${targetBrightness})`,
                  }}
                  exit={{
                    x: isPrev ? '-140%' : '140%',
                    z: -260,
                    rotateY: isPrev ? 55 : -55,
                    scale: 0.65,
                    opacity: 0,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 210,
                    damping: 24,
                    mass: 0.8,
                  }}
                  className={cn(
                    "absolute w-[280px] lg:w-[320px] flex flex-col cursor-pointer double-bezel-shell group",
                    isActive ? "border-white/30 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85),0_0_35px_rgba(255,255,255,0.1)]" : "hover:brightness-110"
                  )}
                  style={{
                    zIndex,
                    transformStyle: 'preserve-3d',
                    willChange: 'transform, opacity, filter',
                  }}
                  onClick={() => handleCardClick(offset)}
                >
                  <div className="double-bezel-core flex flex-col h-full rounded-[calc(2rem-0.375rem)] overflow-hidden">
                    <div className="relative w-full aspect-square bg-[#0e1017] overflow-hidden">
                      <img
                        src={getHdImage(song.cover, song.id)}
                        alt={song.name}
                        className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                        onError={(e) => {
                          const currentSrc = e.currentTarget.src;
                          if (currentSrc.includes('maxresdefault.jpg') && itemCleanId) {
                            e.currentTarget.src = `https://i.ytimg.com/vi/${itemCleanId}/hqdefault.jpg`;
                          } else if (itemCleanId) {
                            e.currentTarget.src = `/api/explore/thumbnail?id=${itemCleanId}&url=${encodeURIComponent(song.cover || '')}`;
                          } else {
                            e.currentTarget.src = '/default-cover.png';
                          }
                        }}
                      />
                      {isActive && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-12 h-12 rounded-full bg-white/95 text-black flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.45)] scale-90 group-hover:scale-100 transition-transform duration-300">
                            {isPlaying ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" className="ml-1" />}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

      </div>

      {/* Bottom Controls Area (Apple Music & Spotify Mobile Architecture) */}
      <div className="w-full max-w-2xl mx-auto px-6 sm:px-8 pb-8 sm:pb-12 pt-2 flex flex-col gap-4 z-20">
        
        {/* Track Title, Artist, Badge, and Favorite */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight truncate" title={currentSong.name}>
              {currentSong.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/60 text-xs sm:text-sm font-medium truncate" title={currentSong.artist}>
                {currentSong.artist}
              </span>
              <SourceQualityBadge
                source={currentSong.source}
                sourceBadge={currentSong.sourceBadge}
                quality={currentSong.quality}
                size="sm"
              />
            </div>
          </div>

          <button
            type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-all shrink-0"
            onClick={() => setIsLiked(!isLiked)}
            title={isLiked ? "Liked" : "Like"}
          >
            <Heart size={24} weight={isLiked ? "fill" : "regular"} className={isLiked ? "text-[#1db954]" : ""} />
          </button>
        </div>

        {/* Scrubber Bar */}
        <div className="flex flex-col gap-1.5 w-full">
          <div
            className="w-full h-1.5 hover:h-2.5 bg-white/15 rounded-full cursor-pointer relative overflow-hidden transition-all group"
            onClick={onSeek}
          >
            <div
              className="absolute top-0 left-0 bottom-0 bg-white group-hover:bg-[#1db954] rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] sm:text-xs text-white/50 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration || currentSong.duration || 240)}</span>
          </div>
        </div>

        {/* Main Transport Buttons */}
        <div className="flex items-center justify-between sm:justify-center sm:gap-12 px-2">
          <button
            type="button"
            className="text-white/60 hover:text-white active:scale-90 transition-all p-2"
            onClick={onOpenEnhancer}
            title="Sound Studio EQ"
          >
            <Faders size={22} weight="light" />
          </button>

          <div className="flex items-center gap-6 sm:gap-8">
            <button
              type="button"
              className="text-white/80 hover:text-white active:scale-90 transition-all p-2"
              onClick={onPrevSong}
              title="Previous Track"
            >
              <SkipBack size={28} weight="fill" />
            </button>

            <button
              type="button"
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white text-black flex items-center justify-center shadow-[0_8px_32px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 transition-all"
              onClick={onTogglePlay}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isLoadingAudio ? (
                <div className="w-6 h-6 border-3 border-black border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause size={28} weight="fill" />
              ) : (
                <Play size={28} weight="fill" className="ml-1" />
              )}
            </button>

            <button
              type="button"
              className="text-white/80 hover:text-white active:scale-90 transition-all p-2"
              onClick={onNextSong}
              title="Next Track"
            >
              <SkipForward size={28} weight="fill" />
            </button>
          </div>

          <button
            type="button"
            className="text-white/60 hover:text-white active:scale-90 transition-all p-2"
            onClick={onToggleMute}
            title={isMuted || displayVolume === 0 ? "Unmute" : `Volume: ${displayVolume}%`}
          >
            {isMuted || displayVolume === 0 ? (
              <SpeakerSlash size={22} weight="light" className="text-red-400" />
            ) : displayVolume < 50 ? (
              <SpeakerLow size={22} weight="light" />
            ) : (
              <SpeakerHigh size={22} weight="light" />
            )}
          </button>
        </div>

      </div>
    </motion.div>
  );
}
