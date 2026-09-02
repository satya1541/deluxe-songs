'use client';

import React from 'react';
import {
  AudioEngineControls,
  EQ_PRESETS,
  EQ_BAND_LABELS,
  AIAcousticProfile,
} from '@/hooks/useAudioEngine';

interface AudioEnhancerProps {
  engine: AudioEngineControls;
  isOpen: boolean;
  onClose: () => void;
  aiSmartEq?: boolean;
  onToggleAiSmartEq?: () => void;
  activeProfile?: AIAcousticProfile | null;
  hideAi?: boolean;
}

export default function AudioEnhancer({
  engine,
  isOpen,
  onClose,
  aiSmartEq = false,
  onToggleAiSmartEq,
  activeProfile,
  hideAi = true,
}: AudioEnhancerProps) {
  const { state } = engine;

  if (!isOpen) return null;

  const handleSelectPreset = (name: string) => {
    if (aiSmartEq && onToggleAiSmartEq) {
      onToggleAiSmartEq();
    }
    engine.setPreset(name);
  };

  const handleSetEqBand = (bandIndex: number, gain: number) => {
    if (aiSmartEq && onToggleAiSmartEq) {
      onToggleAiSmartEq();
    }
    engine.setEqBand(bandIndex, gain);
  };

  const handleResetAll = () => {
    if (aiSmartEq && onToggleAiSmartEq) {
      onToggleAiSmartEq();
    }
    engine.resetToFlat();
  };

  return (
    <div className="deluxe-eq-overlay" onClick={onClose}>
      <div
        className="deluxe-eq-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Equalizer and Sound Studio"
      >
        {/* Header */}
        <div className="deluxe-eq-header">
          <div className="deluxe-eq-title-wrap">
            <div className="deluxe-eq-icon-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="2" y="14" width="4" height="8" rx="1" />
                <rect x="10" y="6" width="4" height="16" rx="1" />
                <rect x="18" y="10" width="4" height="12" rx="1" />
              </svg>
            </div>
            <div>
              <h3 className="deluxe-eq-title">Sound Studio</h3>
              <p className="deluxe-eq-subtitle">5-Band Equalizer & Acoustic DSP Engine</p>
            </div>
          </div>

          <div className="deluxe-eq-actions">
            <button
              type="button"
              className="deluxe-eq-reset-btn"
              onClick={handleResetAll}
              title="Reset all EQ bands to 0dB Flat"
            >
              Reset Flat
            </button>
            <button
              type="button"
              className="deluxe-eq-close-btn"
              onClick={onClose}
              aria-label="Close Equalizer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="deluxe-eq-body">
          {/* Presets Grid */}
          <div className="deluxe-eq-section">
            <div className="deluxe-eq-section-header">
              <span className="deluxe-eq-section-label">Acoustic Presets</span>
              <span className="deluxe-eq-active-badge">{state.activePreset}</span>
            </div>
            <div className="deluxe-eq-preset-grid">
              {EQ_PRESETS.map((preset) => {
                const isActive = state.activePreset === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    className={`deluxe-eq-preset-pill ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectPreset(preset.name)}
                  >
                    <span className="preset-pill-icon">{preset.icon}</span>
                    <span className="preset-pill-name">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5-Band Equalizer Sliders */}
          <div className="deluxe-eq-section">
            <div className="deluxe-eq-section-header">
              <span className="deluxe-eq-section-label">5-Band Frequency Response</span>
              <span className="deluxe-eq-hint">±12 dB Range</span>
            </div>

            <div className="deluxe-eq-sliders-card">
              <div className="deluxe-eq-sliders-container">
                {EQ_BAND_LABELS.map((label, i) => {
                  const gain = state.eqGains[i] || 0;
                  const isPositive = gain > 0;
                  const isZero = gain === 0;

                  return (
                    <div key={label} className="deluxe-eq-band-col">
                      <span className={`deluxe-eq-gain-label ${isPositive ? 'positive' : isZero ? 'zero' : 'negative'}`}>
                        {isPositive ? `+${gain}` : gain} dB
                      </span>

                      <div className="deluxe-eq-slider-well">
                        {/* 0dB Center reference line */}
                        <div className="deluxe-eq-center-detent" />
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={gain}
                          onChange={(e) => handleSetEqBand(i, parseInt(e.target.value, 10))}
                          className="deluxe-eq-vertical-range"
                          aria-label={label}
                        />
                      </div>

                      <span className="deluxe-eq-freq-label">{label.split(' ')[0]}</span>
                      <span className="deluxe-eq-freq-sub">{label.match(/\((.*?)\)/)?.[1] || ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* DSP Enhancements Section */}
          <div className="deluxe-eq-section">
            <span className="deluxe-eq-section-label">Acoustic Enhancements</span>

            <div className="deluxe-eq-dsp-grid">
              {/* Bass Boost Card */}
              <div className={`deluxe-eq-dsp-card ${state.bassBoost > 0 ? 'active' : ''}`}>
                <div className="deluxe-eq-dsp-top">
                  <div className="deluxe-eq-dsp-icon">🔊</div>
                  <div className="deluxe-eq-dsp-info">
                    <span className="deluxe-eq-dsp-name">Sub Bass Boost</span>
                    <span className="deluxe-eq-dsp-desc">Deep 100Hz punch & low-end weight</span>
                  </div>
                  <span className="deluxe-eq-dsp-val">+{state.bassBoost} dB</span>
                </div>
                <div className="deluxe-eq-slider-row">
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="1"
                    value={state.bassBoost}
                    onChange={(e) => engine.setBassBoost(parseInt(e.target.value, 10))}
                    className="deluxe-eq-horizontal-range"
                  />
                </div>
              </div>

              {/* 3D Spatial Reverb Card */}
              <div className={`deluxe-eq-dsp-card ${state.reverbEnabled ? 'active' : ''}`}>
                <div className="deluxe-eq-dsp-top">
                  <div className="deluxe-eq-dsp-icon">🌌</div>
                  <div className="deluxe-eq-dsp-info">
                    <span className="deluxe-eq-dsp-name">3D Spatial Reverb</span>
                    <span className="deluxe-eq-dsp-desc">Concert hall acoustics & binaural width</span>
                  </div>
                  <button
                    type="button"
                    className={`deluxe-eq-switch ${state.reverbEnabled ? 'on' : ''}`}
                    onClick={engine.toggleReverb}
                    aria-label="Toggle Reverb"
                  >
                    <div className="deluxe-eq-switch-knob" />
                  </button>
                </div>
                {state.reverbEnabled && (
                  <div className="deluxe-eq-slider-row">
                    <span className="deluxe-eq-sub-label">Mix: {state.reverbMix}%</span>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      step="5"
                      value={state.reverbMix}
                      onChange={(e) => engine.setReverbMix(parseInt(e.target.value, 10))}
                      className="deluxe-eq-horizontal-range"
                    />
                  </div>
                )}
              </div>

              {/* Loudness Enhancer Card */}
              <div className={`deluxe-eq-dsp-card ${state.loudnessEnabled ? 'active' : ''}`}>
                <div className="deluxe-eq-dsp-top">
                  <div className="deluxe-eq-dsp-icon">⚡</div>
                  <div className="deluxe-eq-dsp-info">
                    <span className="deluxe-eq-dsp-name">Dynamic Punch</span>
                    <span className="deluxe-eq-dsp-desc">Studio compressor for tight, clear dynamics</span>
                  </div>
                  <button
                    type="button"
                    className={`deluxe-eq-switch ${state.loudnessEnabled ? 'on' : ''}`}
                    onClick={engine.toggleLoudness}
                    aria-label="Toggle Dynamic Punch"
                  >
                    <div className="deluxe-eq-switch-knob" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
