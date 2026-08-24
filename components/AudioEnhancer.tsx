'use client';

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
  aiSmartEq: boolean;
  onToggleAiSmartEq: () => void;
  activeProfile?: AIAcousticProfile | null;
}

export default function AudioEnhancer({
  engine,
  isOpen,
  onClose,
  aiSmartEq,
  onToggleAiSmartEq,
  activeProfile,
}: AudioEnhancerProps) {
  const { state } = engine;

  const handleSelectPreset = (name: string) => {
    if (aiSmartEq) {
      onToggleAiSmartEq();
    }
    engine.setPreset(name);
  };

  const handleSetEqBand = (bandIndex: number, gain: number) => {
    if (aiSmartEq) {
      onToggleAiSmartEq();
    }
    engine.setEqBand(bandIndex, gain);
  };

  const handleResetAll = () => {
    if (aiSmartEq) {
      onToggleAiSmartEq();
    }
    engine.resetToFlat();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="enhancer-backdrop" onClick={onClose} />}

      {/* Panel */}
      <div className={`enhancer-panel ${isOpen ? 'enhancer-open' : ''}`}>
        {/* Drag handle */}
        <div className="enhancer-handle-bar">
          <div className="enhancer-handle" />
        </div>

        {/* Header */}
        <div className="enhancer-header">
          <div className="enhancer-title-row">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <circle cx="4" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="10" r="2" fill="currentColor" />
              <circle cx="20" cy="14" r="2" fill="currentColor" />
            </svg>
            <h3>Audio Enhancer</h3>
          </div>
          <div className="enhancer-header-actions">
            <button
              type="button"
              className="enhancer-reset-btn"
              onClick={handleResetAll}
              title="Reset All EQ & Effects to Flat (0dB)"
            >
              Reset
            </button>
            <button className="enhancer-close-btn" onClick={onClose} aria-label="Close enhancer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="enhancer-content">
          {/* === AI SMART ACOUSTICS (AUTO SPATIAL AUDIO) === */}
          <div className={`ai-smart-eq-card ${aiSmartEq ? 'ai-smart-eq-active' : ''}`}>
            <div className="ai-smart-eq-header">
              <div className="ai-smart-eq-title-wrap">
                <div className="ai-sparkle-icon">✨</div>
                <div>
                  <div className="ai-smart-eq-title">
                    <span>AI Smart Acoustics</span>
                    <span className="ai-smart-eq-badge">{aiSmartEq ? 'AUTO OPTIMIZED' : 'OFF'}</span>
                  </div>
                  <p className="ai-smart-eq-subtitle">
                    Auto-tunes sound & 3D spatial room to match the song vibe
                  </p>
                </div>
              </div>

              <button
                type="button"
                className={`toggle-switch ${aiSmartEq ? 'toggle-on' : ''}`}
                onClick={onToggleAiSmartEq}
                role="switch"
                aria-checked={aiSmartEq}
                aria-label="Toggle AI Smart Acoustics"
              >
                <div className="toggle-knob" />
              </button>
            </div>

            {aiSmartEq && activeProfile && (
              <div className="ai-profile-live-box">
                <div className="ai-profile-meta">
                  <div className="ai-headphone-stage">
                    <span className="ai-profile-icon">{activeProfile.icon}</span>
                    <div className="stage-ring ring-1" />
                    <div className="stage-ring ring-2" />
                  </div>
                  <div className="ai-profile-info">
                    <span className="ai-profile-name">{activeProfile.name}</span>
                    <span className="ai-profile-tagline">{activeProfile.tagline}</span>
                  </div>
                </div>

                {/* Live Section & Intent Telemetry */}
                <div className="ai-intent-grid">
                  <div className="ai-intent-gauge">
                    <span className="ai-intent-label">Warmth</span>
                    <div className="ai-intent-bar">
                      <div
                        className="ai-intent-fill"
                        style={{ width: `${Math.round((activeProfile.intent?.warmth ?? 0.7) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="ai-intent-gauge">
                    <span className="ai-intent-label">Space</span>
                    <div className="ai-intent-bar">
                      <div
                        className="ai-intent-fill"
                        style={{ width: `${Math.round((activeProfile.intent?.space ?? 0.7) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="ai-intent-gauge">
                    <span className="ai-intent-label">Vocals</span>
                    <div className="ai-intent-bar">
                      <div
                        className="ai-intent-fill"
                        style={{ width: `${Math.round((activeProfile.intent?.vocalPresence ?? 0.8) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="ai-intent-gauge">
                    <span className="ai-intent-label">Sub-Bass</span>
                    <div className="ai-intent-bar">
                      <div
                        className="ai-intent-fill"
                        style={{ width: `${Math.round((activeProfile.intent?.subBassDepth ?? 0.7) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="ai-profile-chips">
                  <span className="ai-chip">Bass +{activeProfile.bassBoost}dB</span>
                  <span className="ai-chip">
                    {activeProfile.reverbEnabled ? `Spatial 3D Audio` : 'Studio Clarity'}
                  </span>
                  <span className="ai-chip">
                    {activeProfile.loudnessEnabled ? 'Dynamic Punch' : 'Natural Vocals'}
                  </span>
                  <span className="ai-chip ai-chip-section">
                    ✨ Adaptive 60 FPS
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* === EQ Presets === */}
          <div className="enhancer-section">
            <div className="section-label-row">
              <label className="section-label">EQ Presets</label>
              {aiSmartEq && <span className="section-subhint">(Selecting will switch to Manual Mode)</span>}
            </div>
            <div className="preset-grid">
              {EQ_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  className={`preset-pill ${state.activePreset === preset.name ? 'preset-active' : ''}`}
                  onClick={() => handleSelectPreset(preset.name)}
                >
                  <span className="preset-icon">{preset.icon}</span>
                  <span className="preset-name">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* === 5-Band EQ Sliders === */}
          <div className="enhancer-section">
            <label className="section-label">Equalizer</label>
            <div className="eq-sliders">
              {EQ_BAND_LABELS.map((label, i) => (
                <div key={label} className="eq-band">
                  <span className="eq-value">{state.eqGains[i] > 0 ? '+' : ''}{state.eqGains[i]}dB</span>
                  <div className="eq-slider-track">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={state.eqGains[i]}
                      onChange={(e) => handleSetEqBand(i, parseInt(e.target.value))}
                      className="eq-range-input"
                    />
                  </div>
                  <span className="eq-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* === Toggle Controls === */}
          <div className="enhancer-section">
            <label className="section-label">Audio Enhancements</label>
            <div className="toggle-group">
              {/* Mono Audio */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.7">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM8 11a4 4 0 0 0 8 0h2a6 6 0 0 1-5 5.917V20h3v2H8v-2h3v-3.083A6 6 0 0 1 6 11h2z" />
                  </svg>
                  <span>Mono Audio</span>
                </div>
                <button
                  className={`toggle-switch ${state.isMono ? 'toggle-on' : ''}`}
                  onClick={engine.toggleMono}
                  role="switch"
                  aria-checked={state.isMono}
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              {/* Reverb */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.7">
                    <path d="M2 12A10 10 0 0 0 12 22a10 10 0 0 0 0-20A10 10 0 0 0 2 12zm2 0a8 8 0 0 1 8-8v1a7 7 0 0 0 0 14v1a8 8 0 0 1-8-8zm4 0a4 4 0 0 0 4 4v1a5 5 0 0 1 0-10v1a4 4 0 0 0-4 4zm4-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
                  </svg>
                  <span>Reverb</span>
                </div>
                <button
                  className={`toggle-switch ${state.reverbEnabled ? 'toggle-on' : ''}`}
                  onClick={engine.toggleReverb}
                  role="switch"
                  aria-checked={state.reverbEnabled}
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              {/* Loudness */}
              <div className="toggle-row">
                <div className="toggle-info">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.7">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                  <span>Loudness Enhancer</span>
                </div>
                <button
                  className={`toggle-switch ${state.loudnessEnabled ? 'toggle-on' : ''}`}
                  onClick={engine.toggleLoudness}
                  role="switch"
                  aria-checked={state.loudnessEnabled}
                >
                  <div className="toggle-knob" />
                </button>
              </div>
            </div>
          </div>

          {/* === Sliders === */}
          <div className="enhancer-section">
            <label className="section-label">Controls</label>

            {/* Bass Boost */}
            <div className="slider-row">
              <span className="slider-label">Bass Boost</span>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={state.bassBoost}
                onChange={(e) => engine.setBassBoost(parseInt(e.target.value))}
                className="enhancer-range"
              />
              <span className="slider-value">{state.bassBoost > 0 ? `+${state.bassBoost}` : state.bassBoost}dB</span>
            </div>

            {/* Reverb Mix */}
            <div className={`slider-row ${!state.reverbEnabled ? 'slider-disabled' : ''}`}>
              <span className="slider-label">Reverb Mix</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={state.reverbMix}
                onChange={(e) => engine.setReverbMix(parseInt(e.target.value))}
                className="enhancer-range"
                disabled={!state.reverbEnabled}
              />
              <span className="slider-value">{state.reverbMix}%</span>
            </div>

            {/* Volume */}
            <div className="slider-row">
              <span className="slider-label">Volume</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={state.volume}
                onChange={(e) => engine.setVolume(parseInt(e.target.value))}
                className="enhancer-range"
              />
              <span className="slider-value">{state.volume}%</span>
            </div>

            {/* Speed */}
            <div className="slider-row">
              <span className="slider-label">Speed</span>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={state.speed}
                onChange={(e) => engine.setSpeed(parseFloat(e.target.value))}
                className="enhancer-range"
              />
              <span className="slider-value">{state.speed.toFixed(1)}x</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
