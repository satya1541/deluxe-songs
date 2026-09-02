'use client';

import React from 'react';
import { useGlobalAudio } from '@/contexts/GlobalAudioContext';
import ExplorePlayerDeck from '@/components/explore/ExplorePlayerDeck';

export default function GlobalPlayerWrapper() {
  const {
    currentSong,
    isPlaying,
    upcomingQueue,
    historyStack,
    togglePlay,
    nextSong,
    prevSong,
    playFromQueue,
    closePlayer,
  } = useGlobalAudio();

  return (
    <ExplorePlayerDeck
      currentSong={currentSong}
      isPlaying={isPlaying}
      onTogglePlay={togglePlay}
      onNextSong={nextSong}
      onPrevSong={prevSong}
      hasNext={upcomingQueue.length > 0}
      hasPrev={historyStack.length > 0}
      upcomingQueue={upcomingQueue}
      historyStack={historyStack}
      onSelectFromQueue={playFromQueue}
      onClose={closePlayer}
    />
  );
}
