'use client';

import React, { useState, useEffect } from 'react';
import { LiveReaction } from '@/types/sync';

interface LiveReactionsOverlayProps {
  reactions: LiveReaction[];
  onSendReaction: (emoji: string) => void;
}

interface FloatingParticle extends LiveReaction {
  leftPercent: number;
  rotation: number;
  scale: number;
}

const AVAILABLE_EMOJIS = ['🔥', '❤️', '🎵', '👏', '✨', '🚀', '😍', '🙌'];

export default function LiveReactionsOverlay({ reactions, onSendReaction }: LiveReactionsOverlayProps) {
  const [particles, setParticles] = useState<FloatingParticle[]>([]);

  useEffect(() => {
    if (!reactions || reactions.length === 0) return;

    // Grab the latest reactions
    const latest = reactions[reactions.length - 1];
    if (!latest) return;

    const newParticle: FloatingParticle = {
      ...latest,
      id: `${latest.id}-${Math.random()}`,
      leftPercent: 15 + Math.random() * 70, // 15% to 85% width
      rotation: (Math.random() - 0.5) * 40,
      scale: 0.85 + Math.random() * 0.45,
    };

    setParticles((prev) => [...prev.slice(-20), newParticle]);

    // Remove particle after 3.2s
    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
    }, 3200);

    return () => clearTimeout(timer);
  }, [reactions]);

  return (
    <div className="sync-reactions-container pointer-events-none">
      {/* Floating Particles Area */}
      <div className="sync-particles-stage">
        {particles.map((p) => (
          <div
            key={p.id}
            className="sync-floating-emoji"
            style={{
              left: `${p.leftPercent}%`,
              transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            }}
          >
            <span className="emoji-char">{p.emoji}</span>
            {p.sender && <span className="emoji-sender">{p.sender}</span>}
          </div>
        ))}
      </div>

      {/* Floating Reaction Bar (Interactive) */}
      <div className="sync-reactions-dock pointer-events-auto">
        <div className="sync-reactions-bar">
          {AVAILABLE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="sync-emoji-btn"
              onClick={() => onSendReaction(emoji)}
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
