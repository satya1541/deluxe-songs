'use client';

import React, { useState } from 'react';
import { PartyRoom } from '@/types/sync';
import { Song } from '@/types/music';

interface PartyRoomControlsProps {
  room: PartyRoom | null;
  publicRooms: PartyRoom[];
  songs: Song[];
  isHost: boolean;
  onSelectSong: (song: Song) => void;
  onCreateRoom: (name: string, customCode?: string) => void;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
}

export default function PartyRoomControls({
  room,
  publicRooms,
  songs,
  isHost,
  onSelectSong,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
}: PartyRoomControlsProps) {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'join' | 'browse'>('create');
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [customRoomCode, setCustomRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [songSearchQuery, setSongSearchQuery] = useState<string>('');
  const [showSongPicker, setShowSongPicker] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const handleCopyShareLink = () => {
    if (!room) return;
    const url = `${window.location.origin}/sync?room=${encodeURIComponent(room.id)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    onCreateRoom(newRoomName.trim(), customRoomCode.trim() || undefined);
    setShowModal(false);
    setNewRoomName('');
    setCustomRoomCode('');
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    onJoinRoom(joinCodeInput.trim());
    setShowModal(false);
    setJoinCodeInput('');
  };

  const filteredSongs = songs.filter(
    (s) =>
      s.name.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(songSearchQuery.toLowerCase())
  );

  return (
    <div className="party-room-controls">
      {/* Top Room Banner Bar */}
      <div className="party-room-header-bar">
        {room ? (
          <div className="party-room-info-group">
            <div className="party-room-title-stack">
              <div className="party-badge-row">
                <span className="party-code-badge">
                  #{room.id}
                </span>
                <span className="party-listeners-badge">
                  👥 {room.listenersCount} Listening Together
                </span>
              </div>
              <h2 className="party-room-name">{room.name}</h2>
              <p className="party-room-dj">
                DJ: <span className="dj-highlight">{room.hostName}</span> {isHost && ' (You)'}
              </p>
            </div>

            <div className="party-room-actions">
              <button
                type="button"
                className={`party-action-btn share-btn ${copiedLink ? 'copied' : ''}`}
                onClick={handleCopyShareLink}
              >
                {copiedLink ? '✅ Link Copied!' : '🔗 Share Party Link'}
              </button>

              {isHost && (
                <button
                  type="button"
                  className="party-action-btn dj-pick-btn"
                  onClick={() => setShowSongPicker((p) => !p)}
                >
                  🎵 Choose Song as DJ
                </button>
              )}

              <button
                type="button"
                className="party-action-btn switch-btn"
                onClick={() => {
                  setModalMode('browse');
                  setShowModal(true);
                }}
              >
                🔄 Switch Room
              </button>
            </div>
          </div>
        ) : (
          <div className="party-room-no-room">
            <div className="no-room-text">
              <h3>No Party Room Connected</h3>
              <p>Create a live room to broadcast music to your friends or join an existing room.</p>
            </div>
            <div className="no-room-actions">
              <button
                type="button"
                className="party-action-btn create-btn"
                onClick={() => {
                  setModalMode('create');
                  setShowModal(true);
                }}
              >
                ✨ Create Party Room
              </button>
              <button
                type="button"
                className="party-action-btn join-btn"
                onClick={() => {
                  setModalMode('join');
                  setShowModal(true);
                }}
              >
                🔑 Join with Code
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DJ Song Picker Modal / Drawer */}
      {showSongPicker && isHost && (
        <div className="dj-song-picker-overlay" onClick={() => setShowSongPicker(false)}>
          <div className="dj-song-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="picker-header">
              <h3>🎵 Select Track to Broadcast</h3>
              <button type="button" className="close-btn" onClick={() => setShowSongPicker(false)}>
                ✕
              </button>
            </div>
            <input
              type="text"
              placeholder="Search song or artist..."
              value={songSearchQuery}
              onChange={(e) => setSongSearchQuery(e.target.value)}
              className="picker-search-input"
              autoFocus
            />
            <div className="picker-song-list">
              {filteredSongs.length > 0 ? (
                filteredSongs.map((s) => (
                  <div
                    key={s.id}
                    className="picker-song-item"
                    onClick={() => {
                      onSelectSong(s);
                      setShowSongPicker(false);
                    }}
                  >
                    <img src={s.cover} alt={s.name} className="picker-song-img" />
                    <div className="picker-song-meta">
                      <span className="picker-song-title">{s.name}</span>
                      <span className="picker-song-artist">{s.artist}</span>
                    </div>
                    <button type="button" className="picker-play-now-btn">
                      Broadcast ▶
                    </button>
                  </div>
                ))
              ) : (
                <div className="picker-empty">No songs found matching your query.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Room Switcher / Create / Join Modal */}
      {showModal && (
        <div className="party-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="party-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="party-modal-tabs">
              <button
                type="button"
                className={`tab-btn ${modalMode === 'browse' ? 'active' : ''}`}
                onClick={() => setModalMode('browse')}
              >
                Browse Public
              </button>
              <button
                type="button"
                className={`tab-btn ${modalMode === 'create' ? 'active' : ''}`}
                onClick={() => setModalMode('create')}
              >
                Create Room
              </button>
              <button
                type="button"
                className={`tab-btn ${modalMode === 'join' ? 'active' : ''}`}
                onClick={() => setModalMode('join')}
              >
                Join by Code
              </button>
            </div>

            {/* Mode 1: Browse Public Rooms */}
            {modalMode === 'browse' && (
              <div className="party-browse-view">
                <h4>Active Public Party Rooms</h4>
                <div className="public-rooms-list">
                  {publicRooms && publicRooms.length > 0 ? (
                    publicRooms.map((r) => (
                      <div
                        key={r.id}
                        className="public-room-card"
                        onClick={() => {
                          onJoinRoom(r.id);
                          setShowModal(false);
                        }}
                      >
                        <div className="public-room-info">
                          <span className="public-room-title">{r.name}</span>
                          <span className="public-room-dj">DJ: {r.hostName}</span>
                        </div>
                        <div className="public-room-right">
                          <span className="public-room-listeners">👥 {r.listenersCount}</span>
                          <button type="button" className="public-room-join-btn">
                            Join ▶
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="public-rooms-empty">No other public rooms active right now.</div>
                  )}
                </div>
              </div>
            )}

            {/* Mode 2: Create New Room */}
            {modalMode === 'create' && (
              <form onSubmit={handleCreateSubmit} className="party-form">
                <h4>Create Your Synchronized Party Room</h4>
                <div className="form-group">
                  <label>Room Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Satya's Friday Vibe 🎵"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Custom Room Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. VIP-BOLLYWOOD"
                    value={customRoomCode}
                    onChange={(e) => setCustomRoomCode(e.target.value.toUpperCase())}
                  />
                </div>
                <button type="submit" className="form-submit-btn">
                  🚀 Launch & Become DJ
                </button>
              </form>
            )}

            {/* Mode 3: Join Room by Code */}
            {modalMode === 'join' && (
              <form onSubmit={handleJoinSubmit} className="party-form">
                <h4>Enter Room Code</h4>
                <div className="form-group">
                  <label>Room Code or Link ID</label>
                  <input
                    type="text"
                    placeholder="e.g. DELUXE-VIP"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <button type="submit" className="form-submit-btn">
                  ⚡ Join Live Room
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
