import { NextResponse } from 'next/server';
import { PartyRoom, LiveReaction } from '@/types/sync';
import { Song } from '@/types/music';

// In-Memory Global Party Rooms Registry
const roomsMap = new Map<string, PartyRoom>();

// Seed a default VIP Public Room so users can test immediately without creating one
if (!roomsMap.has('DELUXE-VIP')) {
  roomsMap.set('DELUXE-VIP', {
    id: 'DELUXE-VIP',
    name: 'Deluxe VIP Lounge 🍸',
    hostId: 'system-dj',
    hostName: 'Deluxe Auto-DJ',
    currentSong: null,
    isPlaying: false,
    positionSec: 0,
    startedAtEpoch: Date.now(),
    lastUpdated: Date.now(),
    listenersCount: 4,
    isPublic: true,
    reactions: [],
  });
}

// Helper to clean up old rooms inactive for > 12 hours
function cleanupOldRooms() {
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  roomsMap.forEach((room, id) => {
    if (id !== 'DELUXE-VIP' && room.lastUpdated < cutoff) {
      roomsMap.delete(id);
    }
  });
}

export async function GET(request: Request) {
  cleanupOldRooms();
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('id') || searchParams.get('roomId');

  if (roomId) {
    const room = roomsMap.get(roomId.toUpperCase());
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Calculate current live position if room is playing
    let currentLivePosition = room.positionSec;
    if (room.isPlaying && room.startedAtEpoch > 0) {
      const elapsedSincePlay = (Date.now() - room.startedAtEpoch) / 1000;
      currentLivePosition = Math.max(0, room.positionSec + elapsedSincePlay);
    }

    return NextResponse.json({
      success: true,
      room: {
        ...room,
        currentLivePosition,
        serverTime: Date.now(),
      },
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }

  // Return list of public active rooms
  const allRooms: PartyRoom[] = [];
  roomsMap.forEach((room) => {
    if (room.isPublic) {
      allRooms.push(room);
    }
  });

  const publicRooms = allRooms
    .sort((a, b) => b.listenersCount - a.listenersCount)
    .slice(0, 20);

  return NextResponse.json({
    success: true,
    rooms: publicRooms,
    serverTime: Date.now(),
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function POST(request: Request) {
  try {
    cleanupOldRooms();
    const body = await request.json().catch(() => ({}));
    const { action, roomId, hostId, hostName, name, isPublic, song, isPlaying, positionSec, emoji, sender } = body;

    const targetRoomId = (roomId || '').trim().toUpperCase();

    // 1. Action: CREATE ROOM
    if (action === 'create') {
      const newId = targetRoomId || `ROOM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      if (roomsMap.has(newId)) {
        return NextResponse.json({ error: 'Room code already exists. Please pick another name.' }, { status: 400 });
      }

      const newRoom: PartyRoom = {
        id: newId,
        name: name || `${hostName || 'User'}'s Party Room 🎵`,
        hostId: hostId || 'host-' + Date.now(),
        hostName: hostName || 'DJ Master',
        currentSong: song || null,
        isPlaying: !!isPlaying,
        positionSec: positionSec || 0,
        startedAtEpoch: isPlaying ? Date.now() : 0,
        lastUpdated: Date.now(),
        listenersCount: 1,
        isPublic: isPublic !== false,
        reactions: [],
      };

      roomsMap.set(newId, newRoom);
      return NextResponse.json({ success: true, room: newRoom });
    }

    // For all other actions, room must exist
    const room = roomsMap.get(targetRoomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // 2. Action: JOIN ROOM
    if (action === 'join') {
      room.listenersCount = Math.max(1, room.listenersCount + 1);
      room.lastUpdated = Date.now();
      return NextResponse.json({ success: true, room });
    }

    // 3. Action: LEAVE ROOM
    if (action === 'leave') {
      room.listenersCount = Math.max(0, room.listenersCount - 1);
      room.lastUpdated = Date.now();
      return NextResponse.json({ success: true });
    }

    // 4. Action: UPDATE PLAYBACK (Play / Pause / Seek / Song Change by DJ or Collaborator)
    if (action === 'update_playback') {
      if (song !== undefined) {
        room.currentSong = song;
      }
      if (isPlaying !== undefined) {
        room.isPlaying = !!isPlaying;
        room.startedAtEpoch = isPlaying ? Date.now() : 0;
      }
      if (positionSec !== undefined) {
        room.positionSec = Math.max(0, positionSec);
        if (room.isPlaying) {
          room.startedAtEpoch = Date.now();
        }
      }
      room.lastUpdated = Date.now();

      return NextResponse.json({
        success: true,
        room: {
          ...room,
          serverTime: Date.now(),
        },
      });
    }

    // 5. Action: REACTION (Floating live emoji)
    if (action === 'reaction') {
      const reaction: LiveReaction = {
        id: `react-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        emoji: emoji || '🔥',
        sender: sender || 'Listener',
        timestamp: Date.now(),
      };

      // Keep only recent 15 reactions
      room.reactions = [...(room.reactions || []).slice(-14), reaction];
      room.lastUpdated = Date.now();

      return NextResponse.json({ success: true, reaction });
    }

    // 6. Action: TRANSFER DJ
    if (action === 'transfer_dj') {
      if (hostId && hostName) {
        room.hostId = hostId;
        room.hostName = hostName;
        room.lastUpdated = Date.now();
      }
      return NextResponse.json({ success: true, room });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to process party room action' }, { status: 500 });
  }
}
