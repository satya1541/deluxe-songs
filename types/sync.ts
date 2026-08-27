import { Song } from './music';

export interface LiveReaction {
  id: string;
  emoji: string;
  sender: string;
  timestamp: number;
}

export interface GlobalRadioState {
  song: Song;
  startedAt: number; // epoch ms
  elapsedSec: number;
  durationSec: number;
  nextSong: Song;
  activeListeners: number;
  serverTime: number; // epoch ms
}

export interface PartyRoom {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  currentSong: Song | null;
  isPlaying: boolean;
  positionSec: number;
  startedAtEpoch: number; // epoch ms when current play started
  lastUpdated: number; // epoch ms
  listenersCount: number;
  isPublic: boolean;
  reactions: LiveReaction[];
}

export type SyncTab = 'global' | 'party';
