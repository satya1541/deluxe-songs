'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface ExistingSong {
  id: string | number;
  name: string;
  artist: string;
  file: string;
  fileName?: string;
  cover: string;
}

interface UploadQueueItem {
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [existingSongs, setExistingSongs] = useState<ExistingSong[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewingSong, setPreviewingSong] = useState<string | null>(null);
  const [songToDelete, setSongToDelete] = useState<ExistingSong | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Fetch current library songs
  const loadExistingSongs = useCallback(async () => {
    try {
      const res = await fetch('/api/songs', { cache: 'no-store' });
      if (res.ok) {
        const data: ExistingSong[] = await res.json();
        setExistingSongs(data);
      }
    } catch (err) {
      console.warn('Failed to load songs:', err);
    }
  }, []);

  useEffect(() => {
    loadExistingSongs();
  }, [loadExistingSongs]);

  const handleFiles = useCallback((incomingFiles: FileList | File[]) => {
    setMessage(null);
    const valid: File[] = [];
    const rejected: string[] = [];

    Array.from(incomingFiles).forEach((f) => {
      if (f.name.toLowerCase().endsWith('.mp3')) {
        valid.push(f);
      } else {
        rejected.push(f.name);
      }
    });

    if (rejected.length > 0) {
      setMessage({
        type: 'error',
        text: `Rejected ${rejected.length} file(s): Only .mp3 format is allowed. (${rejected.slice(0, 2).join(', ')}${rejected.length > 2 ? '...' : ''})`,
      });
    }

    if (valid.length > 0) {
      const newItems: UploadQueueItem[] = valid.map((file) => ({
        file,
        name: file.name,
        size: file.size,
        status: 'pending',
      }));
      setQueue((prev) => [...prev, ...newItems]);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeQueueItem = (idx: number) => {
    if (isUploading) return;
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadAll = async () => {
    const pendingItems = queue.filter((q) => q.status === 'pending');
    if (pendingItems.length === 0 || isUploading) return;

    setIsUploading(true);
    setMessage({
      type: 'info',
      text: `Uploading ${pendingItems.length} .mp3 song(s) directly to AWS S3...`,
    });

    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'pending' ? { ...item, status: 'uploading' } : item
      )
    );

    const formData = new FormData();
    pendingItems.forEach((item) => {
      formData.append('files', item.file);
    });

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setQueue((prev) =>
          prev.map((item) => ({ ...item, status: 'success' }))
        );
        setMessage({
          type: 'success',
          text: `🎉 Successfully uploaded ${data.uploadedCount} song(s) to AWS S3! Zero rebuild required.`,
        });
        loadExistingSongs();
        setTimeout(() => {
          setQueue((prev) => prev.filter((q) => q.status !== 'success'));
        }, 2000);
      } else {
        setQueue((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'error',
            error: data.error || 'Upload failed',
          }))
        );
        setMessage({
          type: 'error',
          text: data.error || 'Upload failed. Please check files and try again.',
        });
      }
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'error',
          error: err?.message || 'Network error',
        }))
      );
      setMessage({
        type: 'error',
        text: 'Network error while uploading. Please check connection.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const togglePreview = (fileUrl: string) => {
    const audio = audioPreviewRef.current;
    if (!audio) return;

    if (previewingSong === fileUrl) {
      audio.pause();
      setPreviewingSong(null);
    } else {
      audio.src = fileUrl;
      audio.play().catch(() => {});
      setPreviewingSong(fileUrl);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!songToDelete || isDeleting) return;
    setIsDeleting(true);

    const targetFileName =
      songToDelete.fileName ||
      songToDelete.file.replace(/^\/api\/music\//, '').replace(/^\/music\//, '');

    try {
      const res = await fetch('/api/songs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: targetFileName }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (previewingSong === songToDelete.file) {
          audioPreviewRef.current?.pause();
          setPreviewingSong(null);
        }
        setMessage({
          type: 'success',
          text: `🗑️ Deleted "${songToDelete.name}" from AWS S3`,
        });
        setSongToDelete(null);
        loadExistingSongs();
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to delete song.',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Network error while deleting song.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return existingSongs;
    const q = searchQuery.toLowerCase();
    return existingSongs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.artist && s.artist.toLowerCase().includes(q))
    );
  }, [existingSongs, searchQuery]);

  return (
    <div className="upload-page-root">
      <audio
        ref={audioPreviewRef}
        onEnded={() => setPreviewingSong(null)}
        onError={() => setPreviewingSong(null)}
      />

      {/* Full-screen Background with Dark Overlay */}
      <div className="background">
        <Image
          src="/background.jpeg"
          alt="Background"
          fill
          className="bg-image"
          priority
          unoptimized
        />
        <div className="bg-overlay" />
      </div>

      {/* Top Navigation */}
      <header className="upload-page-nav">
        <Link href="/" className="nav-back-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          <span>Back to Music Player</span>
        </Link>
        <div className="nav-brand">
          <span className="brand-dot" />
          <span>DELUXE MIX • MUSIC STUDIO</span>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="upload-page-main">
        <div className="upload-page-card">
          {/* Card Header & Stats */}
          <div className="upload-card-header">
            <div className="card-badge-row">
              <span className="card-badge">LIVE EC2 DIRECT INGESTION</span>
              <span className="card-sub-badge">AUTO-DETECT • ZERO REBUILD</span>
            </div>
            <h1 className="card-title">Manage & Upload Songs</h1>
            <p className="card-subtitle">
              Upload new tracks or delete existing ones directly in <code className="upload-path-tag">AWS S3</code>. 
              The player and EC2 server detect changes in real-time.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-label">Library Songs</span>
              <span className="stat-value">{existingSongs.length} Tracks</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Accepted Format</span>
              <span className="stat-value text-orange">.MP3 Audio</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">AI Mood Engine</span>
              <span className="stat-value text-green">100% Automatic</span>
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            className={`page-dropzone ${dragOver ? 'dropzone-active' : ''} ${isUploading ? 'dropzone-disabled' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,audio/mpeg,audio/mp3"
              multiple
              style={{ display: 'none' }}
              onChange={handleInputChange}
              disabled={isUploading}
            />

            <div className="dropzone-large-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
            </div>

            <div className="dropzone-text-group">
              <span className="dropzone-heading">
                Drag & drop your <span className="text-orange">.mp3 music</span> here
              </span>
              <span className="dropzone-sub">
                or click anywhere in this box to browse files from your computer
              </span>
            </div>

            <div className="dropzone-format-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <span>Single or Multi-Track .MP3 Supported</span>
            </div>
          </div>

          {/* Status Alert */}
          {message && (
            <div className={`upload-page-alert alert-${message.type}`}>
              <span>{message.text}</span>
            </div>
          )}

          {/* Upload Queue Section */}
          {queue.length > 0 && (
            <div className="queue-container">
              <div className="queue-header">
                <span>Selected Tracks to Upload ({queue.length})</span>
                <button
                  type="button"
                  className="clear-queue-btn"
                  onClick={() => {
                    setQueue([]);
                    setMessage(null);
                  }}
                  disabled={isUploading}
                >
                  Clear Queue
                </button>
              </div>

              <div className="queue-list">
                {queue.map((item, idx) => (
                  <div key={idx} className={`queue-row row-${item.status}`}>
                    <div className="queue-row-info">
                      <span className="queue-music-icon">🎵</span>
                      <div className="queue-name-box">
                        <span className="queue-file-name" title={item.name}>
                          {item.name}
                        </span>
                        <span className="queue-file-size">
                          {formatSize(item.size)}
                        </span>
                      </div>
                    </div>

                    <div className="queue-row-actions">
                      {item.status === 'pending' && (
                        <button
                          type="button"
                          className="queue-remove-btn"
                          onClick={() => removeQueueItem(idx)}
                          title="Remove file"
                        >
                          ✕
                        </button>
                      )}
                      {item.status === 'uploading' && (
                        <span className="queue-badge badge-uploading">
                          Uploading...
                        </span>
                      )}
                      {item.status === 'success' && (
                        <span className="queue-badge badge-success">✓ Uploaded</span>
                      )}
                      {item.status === 'error' && (
                        <span className="queue-badge badge-error">
                          ✕ {item.error || 'Failed'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload Button */}
              <button
                type="button"
                className="page-upload-action-btn"
                onClick={handleUploadAll}
                disabled={queue.length === 0 || isUploading}
              >
                {isUploading ? (
                  <>
                    <span className="spinner-rotate" />
                    <span>Writing to AWS S3...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
                    </svg>
                    <span>Upload {queue.length} Song(s) to Deluxe Mix</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Existing Library Browser */}
          <div className="existing-library-section">
            <div className="library-header">
              <div className="library-title-group">
                <span className="library-title">Current Songs in Library</span>
                <span className="library-count-badge">
                  {filteredSongs.length} of {existingSongs.length} Tracks
                </span>
              </div>
              <div className="library-search-box">
                <input
                  type="text"
                  placeholder="Search library songs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="library-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="library-grid">
              {filteredSongs.map((s, idx) => {
                const isPlayingThis = previewingSong === s.file;
                return (
                  <div
                    key={s.id || idx}
                    className={`library-card ${isPlayingThis ? 'card-playing' : ''}`}
                  >
                    <div className="library-card-cover">
                      <Image
                        src={s.cover}
                        alt={s.name}
                        width={44}
                        height={44}
                        className="cover-thumb"
                        unoptimized
                      />
                      <button
                        type="button"
                        className="preview-play-btn"
                        onClick={() => togglePreview(s.file)}
                        title={isPlayingThis ? 'Pause preview' : 'Play preview'}
                      >
                        {isPlayingThis ? '❚❚' : '▶'}
                      </button>
                    </div>

                    <div className="library-card-info">
                      <span className="library-song-name" title={s.name}>
                        {s.name}
                      </span>
                      <span className="library-song-artist">
                        {s.artist || 'Deluxe Mix'}
                      </span>
                    </div>

                    {/* Delete Song Button */}
                    <button
                      type="button"
                      className="library-delete-btn"
                      onClick={() => setSongToDelete(s)}
                      title={`Delete "${s.name}" from library`}
                      aria-label="Delete song"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {songToDelete && (
        <div
          className="delete-modal-backdrop"
          onClick={() => !isDeleting && setSongToDelete(null)}
        >
          <div
            className="delete-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="delete-dialog-title"
          >
            <div className="delete-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </div>

            <h2 id="delete-dialog-title" className="delete-modal-title">
              Delete This Song?
            </h2>

            <p className="delete-modal-desc">
              Are you sure you want to permanently delete{' '}
              <strong className="delete-song-highlight">"{songToDelete.name}"</strong>?
              This will remove the file from <code className="upload-code">AWS S3</code>.
            </p>

            <div className="delete-modal-actions">
              <button
                type="button"
                className="delete-btn-cancel"
                onClick={() => setSongToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-btn-confirm"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
