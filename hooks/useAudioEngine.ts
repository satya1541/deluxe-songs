'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

// ===== EQ Preset Definitions =====
export interface EQPreset {
  name: string;
  icon: string;
  gains: [number, number, number, number, number]; // [60Hz, 230Hz, 910Hz, 4kHz, 14kHz]
}

export const EQ_PRESETS: EQPreset[] = [
  { name: 'Flat',      icon: '🎵', gains: [0, 0, 0, 0, 0] },
  { name: 'Romantic',  icon: '💕', gains: [3, 5, -1, 3, 4] },
  { name: 'Bass Boost',icon: '🔊', gains: [8, 6, 0, 0, 0] },
  { name: 'Vocal',     icon: '🎤', gains: [-2, 1, 5, 4, 1] },
  { name: 'Pop',       icon: '🎶', gains: [1, 3, 2, 4, 3] },
  { name: 'Rock',      icon: '🎸', gains: [5, 3, -1, 4, 5] },
  { name: 'Classical', icon: '🎻', gains: [0, 1, 0, -1, 3] },
  { name: 'Night Mode',icon: '🌙', gains: [3, 2, 0, -2, -3] },
];

// EQ band frequencies
const EQ_FREQUENCIES = [60, 230, 910, 4000, 14000];
const EQ_BAND_LABELS = ['Sub', 'Bass', 'Mid', 'Presence', 'Brilliance'];

export interface AudioEngineState {
  activePreset: string;
  eqGains: number[];
  bassBoost: number;
  isMono: boolean;
  reverbEnabled: boolean;
  reverbMix: number;
  loudnessEnabled: boolean;
  speed: number;
  volume: number;
}

export interface AudioEngineControls {
  state: AudioEngineState;
  setPreset: (presetName: string) => void;
  setEqBand: (bandIndex: number, gain: number) => void;
  setBassBoost: (value: number) => void;
  toggleMono: () => void;
  toggleReverb: () => void;
  setReverbMix: (value: number) => void;
  toggleLoudness: () => void;
  setSpeed: (value: number) => void;
  setVolume: (value: number) => void;
  initEngine: () => void;
  isInitialized: boolean;
}

// Generate a reverb impulse response procedurally
function createReverbImpulse(ctx: AudioContext, duration: number = 2.5, decay: number = 3): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  return impulse;
}

export function useAudioEngine(audioRef: React.RefObject<HTMLAudioElement | null>): AudioEngineControls {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const splitterRef = useRef<ChannelSplitterNode | null>(null);
  const mergerRef = useRef<ChannelMergerNode | null>(null);
  const monoGainLRef = useRef<GainNode | null>(null);
  const monoGainRRef = useRef<GainNode | null>(null);
  const monoBypassRef = useRef<GainNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbDryRef = useRef<GainNode | null>(null);
  const reverbWetRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const compressorBypassRef = useRef<GainNode | null>(null);
  const compressorOutputRef = useRef<GainNode | null>(null);
  const volumeRef = useRef<GainNode | null>(null);
  const initializedRef = useRef(false);

  const [state, setState] = useState<AudioEngineState>({
    activePreset: 'Flat',
    eqGains: [0, 0, 0, 0, 0],
    bassBoost: 0,
    isMono: false,
    reverbEnabled: false,
    reverbMix: 30,
    loudnessEnabled: false,
    speed: 1.0,
    volume: 50,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  const initEngine = useCallback(() => {
    if (initializedRef.current || !audioRef.current) return;

    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;

      // Create source from audio element
      const source = ctx.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      // === 5-Band Parametric EQ ===
      const eqFilters: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        if (i === 0) {
          filter.type = 'lowshelf';
        } else if (i === EQ_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });
      eqFiltersRef.current = eqFilters;

      // Chain EQ filters
      for (let i = 0; i < eqFilters.length - 1; i++) {
        eqFilters[i].connect(eqFilters[i + 1]);
      }

      // === Bass Boost (low-shelf at 100Hz) ===
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 100;
      bassFilter.gain.value = 0;
      bassFilterRef.current = bassFilter;

      // === Mono Merge ===
      const splitter = ctx.createChannelSplitter(2);
      const merger = ctx.createChannelMerger(2);
      const monoGainL = ctx.createGain();
      const monoGainR = ctx.createGain();
      const monoBypass = ctx.createGain();

      monoGainL.gain.value = 0; // Start stereo (bypass active)
      monoGainR.gain.value = 0;
      monoBypass.gain.value = 1;

      splitterRef.current = splitter;
      mergerRef.current = merger;
      monoGainLRef.current = monoGainL;
      monoGainRRef.current = monoGainR;
      monoBypassRef.current = monoBypass;

      // === Reverb ===
      const convolver = ctx.createConvolver();
      convolver.buffer = createReverbImpulse(ctx);
      const reverbDry = ctx.createGain();
      const reverbWet = ctx.createGain();

      reverbDry.gain.value = 1;
      reverbWet.gain.value = 0; // Start disabled

      convolverRef.current = convolver;
      reverbDryRef.current = reverbDry;
      reverbWetRef.current = reverbWet;

      // === Loudness Enhancer (compressor) ===
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      const compressorBypass = ctx.createGain();
      compressorBypass.gain.value = 1; // Start bypassed

      const compressorOutput = ctx.createGain();
      compressorOutput.gain.value = 0; // Start inactive

      compressorRef.current = compressor;
      compressorBypassRef.current = compressorBypass;
      compressorOutputRef.current = compressorOutput;

      // === Volume ===
      const volumeNode = ctx.createGain();
      volumeNode.gain.value = state.volume / 100;
      volumeRef.current = volumeNode;

      // ====== CONNECT THE CHAIN ======
      // Source → EQ chain
      source.connect(eqFilters[0]);

      // EQ → Bass Boost
      eqFilters[eqFilters.length - 1].connect(bassFilter);

      // Bass → Mono section
      // Mono path: bass → splitter → merge L+R → merger
      bassFilter.connect(splitter);
      splitter.connect(monoGainL, 0);
      splitter.connect(monoGainL, 1);
      monoGainL.connect(merger, 0, 0);
      splitter.connect(monoGainR, 0);
      splitter.connect(monoGainR, 1);
      monoGainR.connect(merger, 0, 1);

      // Bypass path: bass → bypass
      bassFilter.connect(monoBypass);

      // Both paths → post-mono
      const postMono = ctx.createGain();
      postMono.gain.value = 1;
      merger.connect(postMono);
      monoBypass.connect(postMono);

      // Post-mono → Reverb dry/wet
      postMono.connect(reverbDry);
      postMono.connect(convolver);
      convolver.connect(reverbWet);

      const postReverb = ctx.createGain();
      postReverb.gain.value = 1;
      reverbDry.connect(postReverb);
      reverbWet.connect(postReverb);

      // Post-reverb → Compressor section
      // Compressor path
      postReverb.connect(compressor);
      const compressorMakeupGain = ctx.createGain();
      compressorMakeupGain.gain.value = 1.5; // Makeup gain
      compressor.connect(compressorMakeupGain);
      compressorMakeupGain.connect(compressorOutput);

      // Bypass path
      postReverb.connect(compressorBypass);

      // Both → pre-volume
      const preVolume = ctx.createGain();
      preVolume.gain.value = 1;
      compressorOutput.connect(preVolume);
      compressorBypass.connect(preVolume);

      preVolume.connect(volumeNode);
      volumeNode.connect(ctx.destination);

      initializedRef.current = true;
      setIsInitialized(true);
    } catch (err) {
      console.error('Failed to initialize audio engine:', err);
    }
  }, [audioRef]);

  // === Control functions ===

  const setPreset = useCallback((presetName: string) => {
    const preset = EQ_PRESETS.find(p => p.name === presetName);
    if (!preset) return;

    eqFiltersRef.current.forEach((filter, i) => {
      filter.gain.setTargetAtTime(preset.gains[i], ctxRef.current?.currentTime ?? 0, 0.05);
    });

    setState(prev => ({
      ...prev,
      activePreset: presetName,
      eqGains: [...preset.gains],
    }));
  }, []);

  const setEqBand = useCallback((bandIndex: number, gain: number) => {
    const filter = eqFiltersRef.current[bandIndex];
    if (filter) {
      filter.gain.setTargetAtTime(gain, ctxRef.current?.currentTime ?? 0, 0.02);
    }

    setState(prev => {
      const newGains = [...prev.eqGains];
      newGains[bandIndex] = gain;
      // Check if matches a preset
      const matchingPreset = EQ_PRESETS.find(p =>
        p.gains.every((g, i) => g === newGains[i])
      );
      return {
        ...prev,
        eqGains: newGains,
        activePreset: matchingPreset?.name ?? 'Custom',
      };
    });
  }, []);

  const setBassBoost = useCallback((value: number) => {
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.setTargetAtTime(value, ctxRef.current?.currentTime ?? 0, 0.05);
    }
    setState(prev => ({ ...prev, bassBoost: value }));
  }, []);

  const toggleMono = useCallback(() => {
    setState(prev => {
      const newMono = !prev.isMono;
      const t = ctxRef.current?.currentTime ?? 0;

      if (newMono) {
        monoGainLRef.current?.gain.setTargetAtTime(0.5, t, 0.02);
        monoGainRRef.current?.gain.setTargetAtTime(0.5, t, 0.02);
        monoBypassRef.current?.gain.setTargetAtTime(0, t, 0.02);
      } else {
        monoGainLRef.current?.gain.setTargetAtTime(0, t, 0.02);
        monoGainRRef.current?.gain.setTargetAtTime(0, t, 0.02);
        monoBypassRef.current?.gain.setTargetAtTime(1, t, 0.02);
      }

      return { ...prev, isMono: newMono };
    });
  }, []);

  const toggleReverb = useCallback(() => {
    setState(prev => {
      const newEnabled = !prev.reverbEnabled;
      const t = ctxRef.current?.currentTime ?? 0;
      const mix = prev.reverbMix / 100;

      if (newEnabled) {
        reverbWetRef.current?.gain.setTargetAtTime(mix, t, 0.05);
        reverbDryRef.current?.gain.setTargetAtTime(1 - mix * 0.5, t, 0.05);
      } else {
        reverbWetRef.current?.gain.setTargetAtTime(0, t, 0.05);
        reverbDryRef.current?.gain.setTargetAtTime(1, t, 0.05);
      }

      return { ...prev, reverbEnabled: newEnabled };
    });
  }, []);

  const setReverbMix = useCallback((value: number) => {
    setState(prev => {
      if (prev.reverbEnabled) {
        const mix = value / 100;
        const t = ctxRef.current?.currentTime ?? 0;
        reverbWetRef.current?.gain.setTargetAtTime(mix, t, 0.05);
        reverbDryRef.current?.gain.setTargetAtTime(1 - mix * 0.5, t, 0.05);
      }
      return { ...prev, reverbMix: value };
    });
  }, []);

  const toggleLoudness = useCallback(() => {
    setState(prev => {
      const newEnabled = !prev.loudnessEnabled;
      const t = ctxRef.current?.currentTime ?? 0;

      if (newEnabled) {
        compressorOutputRef.current?.gain.setTargetAtTime(1, t, 0.02);
        compressorBypassRef.current?.gain.setTargetAtTime(0, t, 0.02);
      } else {
        compressorOutputRef.current?.gain.setTargetAtTime(0, t, 0.02);
        compressorBypassRef.current?.gain.setTargetAtTime(1, t, 0.02);
      }

      return { ...prev, loudnessEnabled: newEnabled };
    });
  }, []);

  const setSpeed = useCallback((value: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = value;
    }
    setState(prev => ({ ...prev, speed: value }));
  }, [audioRef]);

  const setVolume = useCallback((value: number) => {
    if (volumeRef.current) {
      volumeRef.current.gain.setTargetAtTime(value / 100, ctxRef.current?.currentTime ?? 0, 0.02);
    }
    setState(prev => ({ ...prev, volume: value }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    state,
    setPreset,
    setEqBand,
    setBassBoost,
    toggleMono,
    toggleReverb,
    setReverbMix,
    toggleLoudness,
    setSpeed,
    setVolume,
    initEngine,
    isInitialized,
  };
}

export { EQ_BAND_LABELS, EQ_FREQUENCIES };
