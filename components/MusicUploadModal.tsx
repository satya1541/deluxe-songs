'use client';

import React, { useState, useRef, useCallback } from 'react';

interface MusicUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: () => void;
}

interface UploadedFileStatus {
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function MusicUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: MusicUploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileStatuses, setFileStatuses] = useState<UploadedFileStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [globalMessage, setGlobalMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesAdded = useCallback((newFiles: FileList | File[]) => {
    setGlobalMessage(null);
    const addedFiles: File[] = [];
    const rejected: string[] = [];

    Array.from(newFiles).forEach((file) => {
      if (file.name.toLowerCase().endsWith('.mp3')) {
        addedFiles.push(file);
      } else {
        rejected.push(file.name);
      }
    });

    if (rejected.length > 0) {
      setGlobalMessage({
        type: 'error',
        text: `Rejected ${rejected.length} file(s): Only .mp3 format is allowed. (${rejected.slice(0, 2).join(', ')}${rejected.length > 2 ? '...' : ''})`,
      });
    }

    if (addedFiles.length > 0) {
      setFiles((prev) => [...prev, ...addedFiles]);
      setFileStatuses((prev) => [
        ...prev,
        ...addedFiles.map((f) => ({
          name: f.name,
          size: f.size,
          status: 'pending' as const,
        })),
      ]);
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
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    if (isUploading) return;
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileStatuses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);
    setGlobalMessage({
      type: 'info',
      text: `Uploading ${files.length} .mp3 song(s) to AWS S3...`,
    });

    setFileStatuses((prev) =>
      prev.map((item) => ({ ...item, status: 'uploading' }))
    );

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setFileStatuses((prev) =>
          prev.map((item) => ({ ...item, status: 'success' }))
        );
        setGlobalMessage({
          type: 'success',
          text: `🎉 Successfully uploaded ${result.uploadedCount} song(s) directly to AWS S3!`,
        });

        // Clear files list after brief delay
        setTimeout(() => {
          setFiles([]);
          setFileStatuses([]);
          if (onUploadSuccess) onUploadSuccess();
        }, 1200);
      } else {
        setFileStatuses((prev) =>
          prev.map((item) => ({
            ...item,
            status: 'error',
            error: result.error || 'Upload failed',
          }))
        );
        setGlobalMessage({
          type: 'error',
          text: result.error || 'Failed to upload files. Please try again.',
        });
      }
    } catch (err: any) {
      setFileStatuses((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'error',
          error: err?.message || 'Network error',
        }))
      );
      setGlobalMessage({
        type: 'error',
        text: 'Network error occurred while uploading. Please check connection.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  if (!isOpen) return null;

  return (
    <div className="upload-modal-backdrop" onClick={onClose}>
      <div
        className="upload-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
      >
        {/* Header */}
        <div className="upload-modal-header">
          <div className="upload-header-left">
            <div className="upload-icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
            </div>
            <div>
              <h2 id="upload-modal-title" className="upload-title">
                Upload MP3 Music
              </h2>
              <p className="upload-subtitle">
                Add songs directly to <code className="upload-code">AWS S3</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="upload-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Drop Zone */}
        <div
          className={`upload-dropzone ${dragOver ? 'dropzone-active' : ''} ${isUploading ? 'dropzone-disabled' : ''}`}
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
            onChange={handleFileInputChange}
            disabled={isUploading}
          />
          <div className="dropzone-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <div className="dropzone-text">
            <span className="dropzone-main-text">
              Drag & Drop your <span className="highlight-mp3">.mp3</span> songs here
            </span>
            <span className="dropzone-sub-text">
              or click to browse files from your computer
            </span>
          </div>
          <div className="dropzone-badge">Only .MP3 Files Supported</div>
        </div>

        {/* Status Message */}
        {globalMessage && (
          <div className={`upload-alert alert-${globalMessage.type}`}>
            <span>
              {globalMessage.type === 'success' && '✓ '}
              {globalMessage.type === 'error' && '✕ '}
              {globalMessage.type === 'info' && 'ℹ '}
              {globalMessage.text}
            </span>
          </div>
        )}

        {/* Selected Files List */}
        {files.length > 0 && (
          <div className="upload-files-section">
            <div className="upload-files-header">
              <span>Selected Tracks ({files.length})</span>
              <button
                type="button"
                className="clear-all-btn"
                onClick={() => {
                  setFiles([]);
                  setFileStatuses([]);
                  setGlobalMessage(null);
                }}
                disabled={isUploading}
              >
                Clear All
              </button>
            </div>
            <div className="upload-files-list">
              {fileStatuses.map((file, idx) => (
                <div key={idx} className={`file-row file-${file.status}`}>
                  <div className="file-row-left">
                    <span className="file-music-icon">🎵</span>
                    <div className="file-details">
                      <span className="file-name" title={file.name}>
                        {file.name}
                      </span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    </div>
                  </div>

                  <div className="file-row-right">
                    {file.status === 'pending' && (
                      <button
                        type="button"
                        className="file-remove-btn"
                        onClick={() => removeFile(idx)}
                        title="Remove track"
                      >
                        ✕
                      </button>
                    )}
                    {file.status === 'uploading' && (
                      <span className="status-badge status-uploading">
                        <span className="spinner-dots" /> Uploading...
                      </span>
                    )}
                    {file.status === 'success' && (
                      <span className="status-badge status-success">✓ Ready</span>
                    )}
                    {file.status === 'error' && (
                      <span className="status-badge status-error">✕ Error</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="upload-modal-footer">
          <button
            type="button"
            className="modal-cancel-btn"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-upload-btn"
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <span className="upload-spinner" /> Uploading to Library...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
                </svg>
                Upload {files.length > 0 ? `(${files.length})` : ''} to Player
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
