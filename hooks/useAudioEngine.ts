'use client';

import { useRef, useCallback, useState, useEffect, useMemo } from 'react';

// ===== EQ Preset Definitions =====
export interface EQPreset {
  name: string;
  icon: string;
  gains: [number, number, number, number, number]; // [60Hz, 230Hz, 910Hz, 4kHz, 14kHz]
}

export const EQ_PRESETS: EQPreset[] = [
  { name: 'Flat', icon: '🎵', gains: [0, 0, 0, 0, 0] },
  { name: 'Romantic', icon: '💕', gains: [3, 5, -1, 3, 4] },
  { name: 'Bass Boost', icon: '🔊', gains: [8, 6, 0, 0, 0] },
  { name: 'Vocal', icon: '🎤', gains: [-2, 1, 5, 4, 1] },
  { name: 'Pop', icon: '🎶', gains: [1, 3, 2, 4, 3] },
  { name: 'Rock', icon: '🎸', gains: [5, 3, -1, 4, 5] },
  { name: 'Classical', icon: '🎻', gains: [0, 1, 0, -1, 3] },
  { name: 'Night Mode', icon: '🌙', gains: [3, 2, 0, -2, -3] },
];

// ===== 6-Dimensional Normalized Acoustic Intent Vector =====
export interface AcousticIntent {
  warmth: number;        // 0.0 - 1.0 (Low-mid chest body & fullness at 230Hz)
  space: number;         // 0.0 - 1.0 (Reverb depth, decay & spatial staging)
  intensity: number;     // 0.0 - 1.0 (Dynamic punch & compression drive)
  brightness: number;    // 0.0 - 1.0 (Airy highs & presence at 14kHz)
  vocalPresence: number; // 0.0 - 1.0 (Forward vocal clarity & intimacy at 4kHz)
  subBassDepth: number;  // 0.0 - 1.0 (Low-end cinematic weight at 60Hz)
}

// ===== Real-time Audio Feature Vector (Extracted locally via Web Audio AnalyserNode) =====
export interface LiveAudioFeatures {
  rms: number;             // 0.0 - 1.0 (Instantaneous volume energy)
  subBassEnergy: number;   // 0.0 - 1.0 (20Hz - 120Hz sub punch)
  midEnergy: number;       // 0.0 - 1.0 (500Hz - 3kHz vocal presence)
  trebleEnergy: number;    // 0.0 - 1.0 (4kHz - 16kHz air/brilliance)
  spectralCentroid: number;// 0.0 - 1.0 (Live brightness distribution)
  section: 'intro' | 'verse' | 'chorus' | 'outro';
}

// ===== AI Smart Acoustic Profiles (Baseline Master References) =====
export interface AIAcousticProfile {
  name: string;
  badge: string;
  tagline: string;
  icon: string;
  gains: [number, number, number, number, number]; // [60Hz, 230Hz, 910Hz, 4kHz, 14kHz]
  bassBoost: number;
  reverbEnabled: boolean;
  reverbMix: number;
  loudnessEnabled: boolean;
  intent: AcousticIntent;
}

export const AI_ACOUSTIC_PROFILES: Record<string, AIAcousticProfile> = {
  // 1. Sad Romantic (Rain & Melancholy)
  sad_romantic: {
    name: 'Melancholic Rain Window',
    badge: 'Rain Solitude',
    tagline: 'Enveloping cold space, intimate chest resonance & raindrops',
    icon: '🌧️',
    gains: [4.0, 4.5, 1.0, -1.5, 1.0],
    bassBoost: 4.5,
    reverbEnabled: true,
    reverbMix: 46,
    loudnessEnabled: false,
    intent: { warmth: 0.75, space: 0.80, intensity: 0.35, brightness: 0.30, vocalPresence: 0.85, subBassDepth: 0.70 },
  },

  // 2. Heartbroken Romantic (Severe Devastation)
  heartbroken_romantic: {
    name: 'Shattered Heart Chamber',
    badge: 'Heartbreak Echo',
    tagline: 'Deep sub-bass rumble, scooped mids & distant weeping echo',
    icon: '💔',
    gains: [5.5, 3.5, -2.0, 1.0, 2.5],
    bassBoost: 5.5,
    reverbEnabled: true,
    reverbMix: 40,
    loudnessEnabled: true,
    intent: { warmth: 0.60, space: 0.85, intensity: 0.55, brightness: 0.45, vocalPresence: 0.90, subBassDepth: 0.85 },
  },
  heartbroken: {
    name: 'Shattered Heart Chamber',
    badge: 'Heartbreak Echo',
    tagline: 'Deep sub-bass rumble, scooped mids & distant weeping echo',
    icon: '💔',
    gains: [5.5, 3.5, -2.0, 1.0, 2.5],
    bassBoost: 5.5,
    reverbEnabled: true,
    reverbMix: 40,
    loudnessEnabled: true,
    intent: { warmth: 0.60, space: 0.85, intensity: 0.55, brightness: 0.45, vocalPresence: 0.90, subBassDepth: 0.85 },
  },

  // 3. Yearning Romantic (Longing & Viraha)
  yearning_romantic: {
    name: 'Distant Longing Studio',
    badge: 'Viraha Staging',
    tagline: 'Intimate forward chest vocals & expansive horizon reverb',
    icon: '🫶',
    gains: [2.5, 3.5, 4.5, 3.0, 2.5],
    bassBoost: 3.0,
    reverbEnabled: true,
    reverbMix: 42,
    loudnessEnabled: false,
    intent: { warmth: 0.70, space: 0.80, intensity: 0.40, brightness: 0.50, vocalPresence: 0.95, subBassDepth: 0.55 },
  },

  // 4. Dark Romantic (Obsessive & Haunting)
  dark_romantic: {
    name: 'Obsessive Crimson Dark',
    badge: 'Dramatic Storm',
    tagline: 'Heavy low-end punch, boosted warmth & cinematic string tension',
    icon: '🥀',
    gains: [6.0, 5.0, -1.0, 3.0, 3.0],
    bassBoost: 6.5,
    reverbEnabled: true,
    reverbMix: 26,
    loudnessEnabled: true,
    intent: { warmth: 0.80, space: 0.60, intensity: 0.80, brightness: 0.40, vocalPresence: 0.75, subBassDepth: 0.95 },
  },

  // 5. Sensual Romantic (Chemistry & Fire)
  sensual_romantic: {
    name: 'Crimson Velvet Fire',
    badge: 'Deewaniyat Bass',
    tagline: 'Heavy thumping cinematic sub-bass & seductive vocal presence',
    icon: '🔥',
    gains: [7.0, 5.0, -1.0, 3.5, 3.5],
    bassBoost: 7.0,
    reverbEnabled: true,
    reverbMix: 24,
    loudnessEnabled: true,
    intent: { warmth: 0.90, space: 0.55, intensity: 0.75, brightness: 0.50, vocalPresence: 0.85, subBassDepth: 0.90 },
  },

  // 6. Soft Romantic (Gentle & Sweet Love)
  soft_romantic: {
    name: 'Sunset Sukoon Haven',
    badge: 'Peaceful Bliss',
    tagline: 'Silky smooth balance, zero ear fatigue & natural warmth',
    icon: '🌸',
    gains: [2.0, 2.5, 2.0, 1.5, 1.5],
    bassBoost: 2.0,
    reverbEnabled: true,
    reverbMix: 25,
    loudnessEnabled: false,
    intent: { warmth: 0.65, space: 0.45, intensity: 0.25, brightness: 0.60, vocalPresence: 0.70, subBassDepth: 0.35 },
  },
  content_romantic: {
    name: 'Sunset Sukoon Haven',
    badge: 'Peaceful Bliss',
    tagline: 'Silky smooth balance, zero ear fatigue & natural warmth',
    icon: '😌',
    gains: [2.0, 2.5, 2.0, 1.5, 1.5],
    bassBoost: 2.0,
    reverbEnabled: true,
    reverbMix: 25,
    loudnessEnabled: false,
    intent: { warmth: 0.65, space: 0.45, intensity: 0.25, brightness: 0.60, vocalPresence: 0.70, subBassDepth: 0.35 },
  },

  // 7. Intimate Romantic (Whispers & Tenderness)
  intimate_romantic: {
    name: 'Candlelight Whispers',
    badge: 'Acoustic Intimacy',
    tagline: 'Hyper-detailed vocal air, velvety warmth & subtle room decay',
    icon: '❤️',
    gains: [3.0, 4.0, 3.0, 4.0, 2.0],
    bassBoost: 3.0,
    reverbEnabled: true,
    reverbMix: 28,
    loudnessEnabled: false,
    intent: { warmth: 0.85, space: 0.50, intensity: 0.30, brightness: 0.40, vocalPresence: 0.95, subBassDepth: 0.50 },
  },

  // 8. Happy Romantic (Celebratory & Joyful)
  happy_romantic: {
    name: 'Joyful Radiance Spark',
    badge: 'Euphoric Pop',
    tagline: 'Punchy bouncy sub-kick, shimmering sparkle highs & wide energy',
    icon: '✨',
    gains: [5.0, 3.0, 0.0, 4.0, 4.5],
    bassBoost: 5.0,
    reverbEnabled: true,
    reverbMix: 22,
    loudnessEnabled: true,
    intent: { warmth: 0.50, space: 0.40, intensity: 0.70, brightness: 0.85, vocalPresence: 0.75, subBassDepth: 0.75 },
  },
  adoring_romantic: {
    name: 'Joyful Radiance Spark',
    badge: 'Euphoric Pop',
    tagline: 'Punchy bouncy sub-kick, shimmering sparkle highs & wide energy',
    icon: '🥰',
    gains: [5.0, 3.0, 0.0, 4.0, 4.5],
    bassBoost: 5.0,
    reverbEnabled: true,
    reverbMix: 22,
    loudnessEnabled: true,
    intent: { warmth: 0.50, space: 0.40, intensity: 0.70, brightness: 0.85, vocalPresence: 0.75, subBassDepth: 0.75 },
  },

  // 9. Hopeful Romantic (Morning Sunbeams)
  hopeful_romantic: {
    name: 'Morning Light Ascension',
    badge: 'Uplifting Dawn',
    tagline: 'Ascending airy highs, open acoustic headroom & forward vocals',
    icon: '🕊️',
    gains: [2.5, 3.0, 2.0, 3.5, 4.0],
    bassBoost: 2.5,
    reverbEnabled: true,
    reverbMix: 36,
    loudnessEnabled: false,
    intent: { warmth: 0.60, space: 0.70, intensity: 0.50, brightness: 0.75, vocalPresence: 0.80, subBassDepth: 0.50 },
  },

  // 10. Nostalgic Romantic (90s Vintage Memories)
  nostalgic_romantic: {
    name: 'Vintage 90s Golden Era',
    badge: 'Analog Tape Warmth',
    tagline: 'Rich harmonic saturation, vintage tape roll-off & nostalgic echo',
    icon: '😢',
    gains: [4.5, 5.0, 1.5, 1.0, -1.0],
    bassBoost: 4.0,
    reverbEnabled: true,
    reverbMix: 38,
    loudnessEnabled: true,
    intent: { warmth: 0.85, space: 0.65, intensity: 0.45, brightness: 0.35, vocalPresence: 0.80, subBassDepth: 0.60 },
  },
  bittersweet_romantic: {
    name: 'Vintage 90s Golden Era',
    badge: 'Analog Tape Warmth',
    tagline: 'Rich harmonic saturation, vintage tape roll-off & nostalgic echo',
    icon: '🌅',
    gains: [4.5, 5.0, 1.5, 1.0, -1.0],
    bassBoost: 4.0,
    reverbEnabled: true,
    reverbMix: 38,
    loudnessEnabled: true,
    intent: { warmth: 0.85, space: 0.65, intensity: 0.45, brightness: 0.35, vocalPresence: 0.80, subBassDepth: 0.60 },
  },

  // 11. Devotional Romantic (Sufi & Sacred Ishq)
  devotional_romantic: {
    name: 'Sacred Sufi Sanctuary',
    badge: 'Divine Dome Reverb',
    tagline: 'Massive cathedral spatial tail, radiant harmonium & vocal focus',
    icon: '🙏',
    gains: [3.5, 4.0, 3.5, 4.5, 3.0],
    bassBoost: 3.5,
    reverbEnabled: true,
    reverbMix: 48,
    loudnessEnabled: true,
    intent: { warmth: 0.75, space: 0.90, intensity: 0.60, brightness: 0.65, vocalPresence: 0.90, subBassDepth: 0.70 },
  },

  // 12. Dreamy Romantic (Aurora & Cosmic Starlight)
  dreamy_romantic: {
    name: 'Lofi Aurora Dreamscape',
    badge: 'Cosmic Float',
    tagline: 'Lush floating stereo delay, airy highs & deep spatial cushion',
    icon: '🌙',
    gains: [4.0, 3.0, 2.0, 3.5, 4.5],
    bassBoost: 4.0,
    reverbEnabled: true,
    reverbMix: 44,
    loudnessEnabled: false,
    intent: { warmth: 0.70, space: 0.85, intensity: 0.30, brightness: 0.70, vocalPresence: 0.65, subBassDepth: 0.65 },
  },

  // Extra alias
  lonely_romantic: {
    name: 'Melancholic Rain Window',
    badge: 'Rain Solitude',
    tagline: 'Enveloping cold space, intimate chest resonance & raindrops',
    icon: '🌧️',
    gains: [4.0, 4.5, 1.0, -1.5, 1.0],
    bassBoost: 4.5,
    reverbEnabled: true,
    reverbMix: 46,
    loudnessEnabled: false,
    intent: { warmth: 0.75, space: 0.80, intensity: 0.35, brightness: 0.30, vocalPresence: 0.85, subBassDepth: 0.70 },
  },
};

// EQ band frequencies
const EQ_FREQUENCIES = [60, 230, 910, 4000, 14000];
const EQ_BAND_LABELS = ['Sub (60Hz)', 'Bass (230Hz)', 'Mid (910Hz)', 'Presence (4kHz)', 'Air (14kHz)'];

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
  liveFeatures: LiveAudioFeatures;
  activeIntent: AcousticIntent | null;
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
  applyAcousticProfile: (profile: AIAcousticProfile, scale?: number) => void;
  applyAcousticIntent: (intent: AcousticIntent, scale?: number) => void;
  resetToFlat: () => void;
  initEngine: () => void;
  isInitialized: boolean;
  getLiveFeatures: () => LiveAudioFeatures;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
}

// Generate a high-fidelity binaural spatial reverb impulse response with early reflections
function createReverbImpulse(ctx: AudioContext, duration: number = 2.5, decay: number = 2.8): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);

  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  // Early discrete spatial reflections (ms) with channel offset for headphone staging
  const earlyReflections = [
    { delayL: 0.012, delayR: 0.016, gainL: 0.65, gainR: 0.55 },
    { delayL: 0.024, delayR: 0.021, gainL: 0.45, gainR: 0.42 },
    { delayL: 0.038, delayR: 0.044, gainL: 0.35, gainR: 0.38 },
    { delayL: 0.055, delayR: 0.062, gainL: 0.25, gainR: 0.28 },
  ];

  earlyReflections.forEach((tap) => {
    const idxL = Math.floor(tap.delayL * sampleRate);
    const idxR = Math.floor(tap.delayR * sampleRate);
    if (idxL < length) left[idxL] += tap.gainL;
    if (idxR < length) right[idxR] += tap.gainR;
  });

  // Diffuse spatial tail with high-frequency air dampening
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.pow(1 - t, decay);
    const damp = Math.exp(-2.5 * t);
    left[i] += (Math.random() * 2 - 1) * env * damp * 0.7;
    right[i] += (Math.random() * 2 - 1) * env * damp * 0.7;
  }

  return impulse;
}

export function useAudioEngine(audioRef: React.RefObject<HTMLAudioElement | null>): AudioEngineControls {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
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

  // Live audio analysis buffers
  const liveFeaturesRef = useRef<LiveAudioFeatures>({
    rms: 0,
    subBassEnergy: 0,
    midEnergy: 0,
    trebleEnergy: 0,
    spectralCentroid: 0.5,
    section: 'intro',
  });
  const activeIntentRef = useRef<AcousticIntent | null>(null);
  const isAdaptiveModeRef = useRef<boolean>(false);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const timeDataRef = useRef<Uint8Array | null>(null);

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
    liveFeatures: liveFeaturesRef.current,
    activeIntent: null,
  });

  const [isInitialized, setIsInitialized] = useState(false);

  const initEngine = useCallback(() => {
    if (initializedRef.current) {
      if (ctxRef.current && ctxRef.current.state === 'suspended') {
        ctxRef.current.resume().catch(() => {});
      }
      return;
    }
    if (!audioRef.current) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Ensure HTML5 media element delivers unity gain into Web Audio graph
      if (audioRef.current) {
        audioRef.current.volume = 1.0;
      }

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

      monoGainL.gain.value = 0;
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
      reverbWet.gain.value = 0;

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
      compressorBypass.gain.value = 1;

      const compressorOutput = ctx.createGain();
      compressorOutput.gain.value = 0;

      compressorRef.current = compressor;
      compressorBypassRef.current = compressorBypass;
      compressorOutputRef.current = compressorOutput;

      // === Web Audio Real-Time AnalyserNode ===
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      timeDataRef.current = new Uint8Array(analyser.fftSize);

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
      bassFilter.connect(splitter);
      splitter.connect(monoGainL, 0);
      splitter.connect(monoGainL, 1);
      monoGainL.connect(merger, 0, 0);
      splitter.connect(monoGainR, 0);
      splitter.connect(monoGainR, 1);
      monoGainR.connect(merger, 0, 1);

      bassFilter.connect(monoBypass);

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
      postReverb.connect(compressor);
      const compressorMakeupGain = ctx.createGain();
      compressorMakeupGain.gain.value = 1.5;
      compressor.connect(compressorMakeupGain);
      compressorMakeupGain.connect(compressorOutput);

      postReverb.connect(compressorBypass);

      const preVolume = ctx.createGain();
      preVolume.gain.value = 1;
      compressorOutput.connect(preVolume);
      compressorBypass.connect(preVolume);

      // Connect into Analyser for live feature extraction
      preVolume.connect(analyser);
      analyser.connect(volumeNode);
      volumeNode.connect(ctx.destination);

      initializedRef.current = true;
      setIsInitialized(true);
    } catch (err) {
      console.error('Failed to initialize audio engine:', err);
    }
  }, [audioRef, state.volume]);

  // Live Feature Extraction Function (0ms overhead)
  const getLiveFeatures = useCallback((): LiveAudioFeatures => {
    const analyser = analyserRef.current;
    if (!analyser || !dataArrayRef.current || !timeDataRef.current) {
      return liveFeaturesRef.current;
    }

    const freqData = dataArrayRef.current;
    const timeData = timeDataRef.current;
    (analyser as any).getByteFrequencyData(freqData);
    (analyser as any).getByteTimeDomainData(timeData);

    // 1. RMS Energy Calculation
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.min(1.0, Math.sqrt(sumSquares / timeData.length) * 2.2);

    // 2. Frequency Band Energies
    // Sub-bass: bins 0 to 3 (~0Hz to 250Hz)
    let subSum = 0;
    for (let i = 0; i < 4; i++) subSum += freqData[i];
    const subBassEnergy = Math.min(1.0, (subSum / (4 * 255)) * 1.5);

    // Mids (Vocals): bins 6 to 35 (~500Hz to 3000Hz)
    let midSum = 0;
    for (let i = 6; i < 36; i++) midSum += freqData[i];
    const midEnergy = Math.min(1.0, (midSum / (30 * 255)) * 1.4);

    // Treble: bins 45 to 140 (~4kHz to 12kHz)
    let trebSum = 0;
    for (let i = 45; i < 140; i++) trebSum += freqData[i];
    const trebleEnergy = Math.min(1.0, (trebSum / (95 * 255)) * 1.6);

    // 3. Spectral Centroid (Live Brightness)
    let weightedSum = 0;
    let totalMagnitude = 0;
    for (let i = 0; i < freqData.length; i++) {
      const mag = freqData[i];
      weightedSum += i * mag;
      totalMagnitude += mag;
    }
    const centroidNorm = totalMagnitude > 0 ? Math.min(1.0, (weightedSum / totalMagnitude) / 120) : 0.5;

    // 4. Dynamic Section Detection
    const curTime = audioRef.current?.currentTime ?? 0;
    const dur = audioRef.current?.duration ?? 0;

    let section: 'intro' | 'verse' | 'chorus' | 'outro' = 'verse';
    if (dur > 0 && curTime > dur - 15) {
      section = 'outro';
    } else if (curTime < 14 && rms < 0.35) {
      section = 'intro';
    } else if (subBassEnergy > 0.55 && rms > 0.45) {
      section = 'chorus';
    } else {
      section = 'verse';
    }

    const features: LiveAudioFeatures = {
      rms,
      subBassEnergy,
      midEnergy,
      trebleEnergy,
      spectralCentroid: centroidNorm,
      section,
    };

    liveFeaturesRef.current = features;
    return features;
  }, [audioRef]);

  // Continuous Adaptive DSP Modulation Loop (Runs at 25Hz when Smart AI is active)
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      const features = getLiveFeatures();
      const intent = activeIntentRef.current;
      const ctx = ctxRef.current;

      if (isAdaptiveModeRef.current && intent && ctx && ctx.state === 'running') {
        const t = ctx.currentTime;

        // 1. Adaptive Sub-Bass & Low-Shelf (Punch on chorus & beat drops)
        const baseSub = (intent.subBassDepth * 5.0) - 0.5;
        const liveSubKick = (features.section === 'chorus' || features.subBassEnergy > 0.6) ? 1.4 : 0;
        const targetSub = Math.min(6.5, baseSub + liveSubKick);
        if (eqFiltersRef.current[0]) {
          eqFiltersRef.current[0].gain.setTargetAtTime(targetSub, t, 0.08);
        }

        // 2. Warmth / Chest (230Hz)
        const targetWarmth = (intent.warmth - 0.5) * 5.5;
        if (eqFiltersRef.current[1]) {
          eqFiltersRef.current[1].gain.setTargetAtTime(targetWarmth, t, 0.08);
        }

        // 3. Body / Low-Mids (910Hz)
        const targetMids = (intent.warmth * 0.4 - 0.2) * 3.0;
        if (eqFiltersRef.current[2]) {
          eqFiltersRef.current[2].gain.setTargetAtTime(targetMids, t, 0.08);
        }

        // 4. Vocal Presence & Intimacy Focus (4kHz)
        const basePresence = (intent.vocalPresence * 4.2) - 0.5;
        const verseVocalLift = features.section === 'verse' ? 0.8 : 0;
        const targetPresence = Math.min(4.5, basePresence + verseVocalLift);
        if (eqFiltersRef.current[3]) {
          eqFiltersRef.current[3].gain.setTargetAtTime(targetPresence, t, 0.08);
        }

        // 5. Brilliance & Air (14kHz)
        const targetBrilliance = (intent.brightness - 0.45) * 5.0;
        if (eqFiltersRef.current[4]) {
          eqFiltersRef.current[4].gain.setTargetAtTime(targetBrilliance, t, 0.08);
        }

        // 6. Bass Boost (100Hz low-shelf)
        const targetBass = Math.min(7.0, (intent.subBassDepth * 5.0) + (features.section === 'chorus' ? 1.5 : 0));
        if (bassFilterRef.current) {
          bassFilterRef.current.gain.setTargetAtTime(targetBass, t, 0.08);
        }

        // 7. Dynamic Reverb Staging (Expansive intro/outro, focused verse)
        const baseReverbMix = (intent.space * 42) / 100;
        let reverbScale = 1.0;
        if (features.section === 'intro' || features.section === 'outro') reverbScale = 1.25;
        else if (features.section === 'verse') reverbScale = 0.75;
        else if (features.section === 'chorus') reverbScale = 1.05;

        const liveReverb = Math.min(0.48, Math.max(0, baseReverbMix * reverbScale));
        if (reverbWetRef.current && reverbDryRef.current) {
          reverbWetRef.current.gain.setTargetAtTime(liveReverb, t, 0.08);
          reverbDryRef.current.gain.setTargetAtTime(1 - liveReverb * 0.45, t, 0.08);
        }
      }
    }, 45);

    return () => clearInterval(interval);
  }, [isInitialized, getLiveFeatures]);

  // === Control functions ===

  const setPreset = useCallback((presetName: string) => {
    isAdaptiveModeRef.current = false;
    const preset = EQ_PRESETS.find(p => p.name === presetName);
    if (!preset) return;

    eqFiltersRef.current.forEach((filter, i) => {
      filter.gain.setTargetAtTime(preset.gains[i], ctxRef.current?.currentTime ?? 0, 0.05);
    });

    setState(prev => ({
      ...prev,
      activePreset: presetName,
      eqGains: [...preset.gains],
      activeIntent: null,
    }));
  }, []);

  const setEqBand = useCallback((bandIndex: number, gain: number) => {
    isAdaptiveModeRef.current = false;
    const filter = eqFiltersRef.current[bandIndex];
    if (filter) {
      filter.gain.setTargetAtTime(gain, ctxRef.current?.currentTime ?? 0, 0.02);
    }

    setState(prev => {
      const newGains = [...prev.eqGains];
      newGains[bandIndex] = gain;
      const matchingPreset = EQ_PRESETS.find(p =>
        p.gains.every((g, i) => g === newGains[i])
      );
      return {
        ...prev,
        eqGains: newGains,
        activePreset: matchingPreset?.name ?? 'Custom',
        activeIntent: null,
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
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    if (volumeRef.current) {
      volumeRef.current.gain.setTargetAtTime(clamped / 100, ctxRef.current?.currentTime ?? 0, 0.02);
    } else if (audioRef.current) {
      audioRef.current.volume = clamped / 100;
    }
    setState(prev => ({ ...prev, volume: clamped }));
  }, [audioRef]);

  // Apply Acoustic Intent (6D Vector from AI)
  const applyAcousticIntent = useCallback((intent: AcousticIntent, scale: number = 1.0) => {
    initEngine();
    activeIntentRef.current = intent;
    isAdaptiveModeRef.current = true;
    const t = ctxRef.current?.currentTime ?? 0;
    const clampedScale = Math.max(0.2, Math.min(1.0, scale));

    // Calculate baseline EQ from intent
    const sub = Math.round(((intent.subBassDepth * 5.0) - 0.5) * clampedScale * 10) / 10;
    const warmth = Math.round(((intent.warmth - 0.5) * 5.5) * clampedScale * 10) / 10;
    const mids = Math.round(((intent.warmth * 0.4 - 0.2) * 3.0) * clampedScale * 10) / 10;
    const presence = Math.round(((intent.vocalPresence * 4.2) - 0.5) * clampedScale * 10) / 10;
    const brilliance = Math.round(((intent.brightness - 0.45) * 5.0) * clampedScale * 10) / 10;
    const calculatedGains: [number, number, number, number, number] = [sub, warmth, mids, presence, brilliance];

    calculatedGains.forEach((gain, i) => {
      if (eqFiltersRef.current[i]) {
        eqFiltersRef.current[i].gain.setTargetAtTime(gain, t, 0.08);
      }
    });

    const bass = Math.round((intent.subBassDepth * 5.0) * clampedScale * 10) / 10;
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.setTargetAtTime(bass, t, 0.08);
    }

    const reverbMix = Math.round((intent.space * 42) * clampedScale);
    if (intent.space > 0.2) {
      const mix = reverbMix / 100;
      reverbWetRef.current?.gain.setTargetAtTime(mix, t, 0.08);
      reverbDryRef.current?.gain.setTargetAtTime(1 - mix * 0.45, t, 0.08);
    } else {
      reverbWetRef.current?.gain.setTargetAtTime(0, t, 0.08);
      reverbDryRef.current?.gain.setTargetAtTime(1, t, 0.08);
    }

    const loudness = intent.intensity > 0.45;
    if (loudness) {
      compressorOutputRef.current?.gain.setTargetAtTime(1, t, 0.03);
      compressorBypassRef.current?.gain.setTargetAtTime(0, t, 0.03);
    } else {
      compressorOutputRef.current?.gain.setTargetAtTime(0, t, 0.03);
      compressorBypassRef.current?.gain.setTargetAtTime(1, t, 0.03);
    }

    setState(prev => {
      if (prev.activePreset === '✨ AI Adaptive Acoustics' && prev.activeIntent === intent) {
        return prev;
      }
      return {
        ...prev,
        activePreset: '✨ AI Adaptive Acoustics',
        eqGains: [...calculatedGains],
        bassBoost: bass,
        reverbEnabled: intent.space > 0.2,
        reverbMix,
        loudnessEnabled: loudness,
        activeIntent: intent,
      };
    });
  }, [initEngine]);

  const applyAcousticProfile = useCallback((profile: AIAcousticProfile, scale: number = 1.0) => {
    if (profile.intent) {
      applyAcousticIntent(profile.intent, scale);
      setState(prev => ({ ...prev, activePreset: profile.name }));
      return;
    }

    initEngine();
    isAdaptiveModeRef.current = true;
    const t = ctxRef.current?.currentTime ?? 0;
    const clampedScale = Math.max(0.2, Math.min(1.0, scale));

    const scaledGains = profile.gains.map(g => Math.round(g * clampedScale * 10) / 10) as [number, number, number, number, number];
    scaledGains.forEach((gain, i) => {
      if (eqFiltersRef.current[i]) {
        eqFiltersRef.current[i].gain.setTargetAtTime(gain, t, 0.08);
      }
    });

    const scaledBass = Math.round(profile.bassBoost * clampedScale * 10) / 10;
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.setTargetAtTime(scaledBass, t, 0.08);
    }

    if (profile.reverbEnabled) {
      const mix = (profile.reverbMix * clampedScale) / 100;
      reverbWetRef.current?.gain.setTargetAtTime(mix, t, 0.08);
      reverbDryRef.current?.gain.setTargetAtTime(1 - mix * 0.45, t, 0.08);
    } else {
      reverbWetRef.current?.gain.setTargetAtTime(0, t, 0.08);
      reverbDryRef.current?.gain.setTargetAtTime(1, t, 0.08);
    }

    if (profile.loudnessEnabled) {
      compressorOutputRef.current?.gain.setTargetAtTime(1, t, 0.03);
      compressorBypassRef.current?.gain.setTargetAtTime(0, t, 0.03);
    } else {
      compressorOutputRef.current?.gain.setTargetAtTime(0, t, 0.03);
      compressorBypassRef.current?.gain.setTargetAtTime(1, t, 0.03);
    }

    setState(prev => ({
      ...prev,
      activePreset: profile.name,
      eqGains: [...scaledGains],
      bassBoost: scaledBass,
      reverbEnabled: profile.reverbEnabled,
      reverbMix: Math.round(profile.reverbMix * clampedScale),
      loudnessEnabled: profile.loudnessEnabled,
      activeIntent: profile.intent || null,
    }));
  }, [initEngine, applyAcousticIntent]);

  const resetToFlat = useCallback(() => {
    initEngine();
    isAdaptiveModeRef.current = false;
    activeIntentRef.current = null;
    const t = ctxRef.current?.currentTime ?? 0;

    eqFiltersRef.current.forEach((filter) => {
      filter.gain.setTargetAtTime(0, t, 0.05);
    });

    if (bassFilterRef.current) {
      bassFilterRef.current.gain.setTargetAtTime(0, t, 0.05);
    }

    if (reverbWetRef.current && reverbDryRef.current) {
      reverbWetRef.current.gain.setTargetAtTime(0, t, 0.05);
      reverbDryRef.current.gain.setTargetAtTime(1, t, 0.05);
    }

    if (compressorOutputRef.current && compressorBypassRef.current) {
      compressorOutputRef.current.gain.setTargetAtTime(0, t, 0.02);
      compressorBypassRef.current.gain.setTargetAtTime(1, t, 0.02);
    }

    setState((prev) => ({
      ...prev,
      activePreset: 'Flat',
      eqGains: [0, 0, 0, 0, 0],
      bassBoost: 0,
      reverbEnabled: false,
      reverbMix: 30,
      loudnessEnabled: false,
      activeIntent: null,
    }));
  }, [initEngine]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (ctxRef.current && ctxRef.current.state !== 'closed') {
        ctxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return useMemo(() => ({
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
    applyAcousticProfile,
    applyAcousticIntent,
    resetToFlat,
    initEngine,
    isInitialized,
    getLiveFeatures,
    analyserRef,
  }), [
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
    applyAcousticProfile,
    applyAcousticIntent,
    resetToFlat,
    initEngine,
    isInitialized,
    getLiveFeatures,
    analyserRef,
  ]);
}

export { EQ_BAND_LABELS, EQ_FREQUENCIES };
