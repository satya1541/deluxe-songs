'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type EmotionType =
  | 'sad_romantic'         // 🌧️ Rain on glass (Tympanus style with full physics)
  | 'dark_romantic'        // 🥀 Dark crimson passion with swirling mist, embers & rose petals
  | 'soft_romantic'        // 🌸 Soft & sweet love with 3D rose petals & acoustic heartbeat
  | 'happy_romantic'       // ✨ Joyful & peppy love with golden sunburst & celebration glitter
  | 'devotional_romantic'  // 🙏 Sufi & divine sacred love with celestial rays & floating diyas
  | 'dreamy_romantic'      // 🌙 Dreamy & serene night with aurora borealis & starry cosmos
  | null;

interface EmotionData {
  emotion: EmotionType;
  color: string;
  secondary: string;
  label: string;
  icon: string;
  themeDescription?: string;
}

export interface EmotionOverlayProps {
  songName: string;
  songArtist: string;
  isPlaying: boolean;
  playlist?: { name: string; artist?: string }[];
}

export const ALL_ROMANTIC_THEMES: {
  type: EmotionType;
  label: string;
  shortLabel: string;
  icon: string;
  desc: string;
}[] = [
  {
    type: 'sad_romantic',
    label: 'Sad & Melancholic (Rain)',
    shortLabel: 'Sad Romantic',
    icon: '🌧️',
    desc: 'Fully animated Tympanus rain on glass with droplet merging, sliding trails & storm flashes',
  },
  {
    type: 'dark_romantic',
    label: 'Dark & Passionate (Crimson)',
    shortLabel: 'Dark Romantic',
    icon: '🥀',
    desc: 'Cloudy dark red mist, burning ember sparks, velvet rose petals & haunting intensity',
  },
  {
    type: 'soft_romantic',
    label: 'Soft & Sweet Love (Petals)',
    shortLabel: 'Soft Romance',
    icon: '🌸',
    desc: '3D floating rose petals, organic rotation, acoustic heartbeat pulse & gentle warmth',
  },
  {
    type: 'happy_romantic',
    label: 'Joyful & Peppy Love (Sunburst)',
    shortLabel: 'Happy Romantic',
    icon: '✨',
    desc: 'Radiant golden sunbeams, celebratory rising glitter stars & sparkling bokeh',
  },
  {
    type: 'devotional_romantic',
    label: 'Sufi & Divine Love (Sacred)',
    shortLabel: 'Sufi Divine',
    icon: '🙏',
    desc: 'Rotating divine celestial rays, sacred glowing halos & floating diya lanterns',
  },
  {
    type: 'dreamy_romantic',
    label: 'Dreamy & Serene Night (Aurora)',
    shortLabel: 'Dreamy Lofi',
    icon: '🌙',
    desc: 'Deep starry midnight cosmos, twinkling constellations & shifting northern lights aurora',
  },
];

export function getInstantEmotion(name: string, artist?: string): EmotionData {
  const text = `${name || ''} ${artist || ''}`.toLowerCase();

  let emotion: EmotionType = 'soft_romantic';

  if (
    text.includes('mushkil') ||
    text.includes('sawan') ||
    text.includes('galliyan') ||
    text.includes('wajah tum ho') ||
    text.includes('tera mera rishta') ||
    text.includes('tere bina') ||
    text.includes('tumse bhi zyada') ||
    text.includes('main agar saamne') ||
    text.includes('judai') ||
    text.includes('alvida') ||
    text.includes('tanha') ||
    text.includes('roya') ||
    text.includes('aansu') ||
    text.includes('dard') ||
    text.includes('kho gaya') ||
    text.includes('bewafa') ||
    text.includes('rula') ||
    text.includes('rain') ||
    text.includes('baarish')
  ) {
    emotion = 'sad_romantic';
  } else if (
    text.includes('deewana') ||
    text.includes('deewaniyat') ||
    text.includes('mera hua') ||
    text.includes('tum mere ho') ||
    text.includes('terre pyaar mein') ||
    text.includes('tu jo hain') ||
    text.includes('tum ho mera pyar') ||
    text.includes('hate story') ||
    text.includes('raaz') ||
    text.includes('danger') ||
    text.includes('fire') ||
    text.includes('passion')
  ) {
    emotion = 'dark_romantic';
  } else if (
    text.includes('rab ka shukrana') ||
    text.includes('tu hi rab') ||
    text.includes('is qadar') ||
    text.includes('tujhe sochta') ||
    text.includes('allah') ||
    text.includes('rab') ||
    text.includes('khuda') ||
    text.includes('dua') ||
    text.includes('shukr') ||
    text.includes('sufi') ||
    text.includes('sajda')
  ) {
    emotion = 'devotional_romantic';
  } else if (
    text.includes('akhiyaan gulaab') ||
    text.includes('chaleya') ||
    text.includes('dil cheez') ||
    text.includes('mere rashke qamar') ||
    text.includes('pardesiya') ||
    text.includes('nazar na lag jaaye') ||
    text.includes('jeena haraam') ||
    text.includes('dance') ||
    text.includes('party') ||
    text.includes('masti') ||
    text.includes('dhoom') ||
    text.includes('swag')
  ) {
    emotion = 'happy_romantic';
  } else if (
    text.includes('besabriyaan') ||
    text.includes('lo safar') ||
    text.includes('sitaare') ||
    text.includes('tum hardafa') ||
    text.includes('jeena marna') ||
    text.includes('night') ||
    text.includes('chand') ||
    text.includes('neend') ||
    text.includes('calm') ||
    text.includes('safar')
  ) {
    emotion = 'dreamy_romantic';
  } else {
    emotion = 'soft_romantic';
  }

  const themeInfo = ALL_ROMANTIC_THEMES.find((t) => t.type === emotion) || ALL_ROMANTIC_THEMES[0];
  return {
    emotion,
    color: '#1a237e',
    secondary: '#42a5f5',
    label: themeInfo.label.split('(')[0].trim(),
    icon: themeInfo.icon,
    themeDescription: themeInfo.desc,
  };
}

// Persistent Browser LocalStorage Key
const STORAGE_KEY = 'deluxe_ai_emotions_v1';

// Global in-memory cache (RAM) for fastest frame-0 lookup
const clientEmotionCache = new Map<string, EmotionData>();

function getLocalStoredEmotion(key: string): EmotionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed[key] || null;
  } catch {
    return null;
  }
}

function saveLocalStoredEmotion(key: string, data: EmotionData) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[key] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.warn('LocalStorage save notice:', e);
  }
}

function getCachedEmotion(name: string, artist?: string): EmotionData | null {
  if (!name) return null;
  const cacheKey = `${name.toLowerCase()}::${(artist || '').toLowerCase()}`;
  
  // 1. RAM in-memory cache
  if (clientEmotionCache.has(cacheKey)) {
    return clientEmotionCache.get(cacheKey)!;
  }
  
  // 2. Persistent browser localStorage (persists across refreshes and sessions)
  const stored = getLocalStoredEmotion(cacheKey);
  if (stored) {
    clientEmotionCache.set(cacheKey, stored);
    return stored;
  }
  
  return null;
}

export default function EmotionOverlay({
  songName,
  songArtist,
  isPlaying,
}: EmotionOverlayProps) {
  const [emotionData, setEmotionData] = useState<EmotionData>(() =>
    getCachedEmotion(songName, songArtist) || getInstantEmotion(songName, songArtist)
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const prevSongRef = useRef<string>('');
  const abortCtrlRef = useRef<AbortController | null>(null);

  // Engine references for persistent physical simulation
  const rainEngineRef = useRef<RainEngineState>({
    drops: [],
    staticDrops: [],
    rainStreaksBg: [],
    rainStreaksFg: [],
    ripples: [],
    lightning: { active: false, timer: 15, intensity: 0 },
    spawnTimer: 0,
    wipeTrails: [],
  });

  const petalsRef = useRef<Petal[]>([]);
  const embersRef = useRef<Ember[]>([]);
  const starsRef = useRef<Star[]>([]);
  const lightsRef = useRef<DivineLight[]>([]);
  const cloudsRef = useRef<CloudLayer[]>([]);

  // Fetch song emotion ONLY for the single active song (checks browser cache first)
  const fetchEmotionForCurrentSong = useCallback(async (name: string, artist: string) => {
    if (!name) return;
    const cacheKey = `${name.toLowerCase()}::${(artist || '').toLowerCase()}`;
    
    // If already cached in Browser LocalStorage or Memory, skip network call completely!
    const cached = getCachedEmotion(name, artist);
    if (cached) {
      setEmotionData(cached);
      return;
    }

    // Cancel any previous pending request
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    const controller = new AbortController();
    abortCtrlRef.current = controller;

    try {
      const res = await fetch('/api/emotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, artist }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data: EmotionData = await res.json();
        // Save to in-memory cache AND persistent browser localStorage
        clientEmotionCache.set(cacheKey, data);
        saveLocalStoredEmotion(cacheKey, data);
        setEmotionData(data);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('AI emotion fetch notice:', err?.message || err);
      }
    }
  }, []);

  // When active song changes, switch mood INSTANTLY in 0ms (no lag, zero API spam)
  useEffect(() => {
    if (!songName) return;
    const songKey = `${songName}::${songArtist}`;
    if (songKey === prevSongRef.current) return;
    prevSongRef.current = songKey;

    const instantData = getCachedEmotion(songName, songArtist) || getInstantEmotion(songName, songArtist);

    // 1. INSTANT zero-lag mood switch (badge & canvas update immediately)
    setEmotionData(instantData);
    setIsTransitioning(true);

    // 2. Fetch/Confirm with Gemini AI only if not cached in browser
    fetchEmotionForCurrentSong(songName, songArtist);

    const timeout = setTimeout(() => {
      setIsTransitioning(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [songName, songArtist, fetchEmotionForCurrentSong]);

  const activeEmotion: EmotionType = emotionData?.emotion || 'sad_romantic';

  // Initialize simulation elements when active emotion or canvas dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    initScene(activeEmotion, W, H, {
      rainEngine: rainEngineRef,
      petals: petalsRef,
      embers: embersRef,
      stars: starsRef,
      lights: lightsRef,
      clouds: cloudsRef,
    });
  }, [activeEmotion]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initScene(activeEmotion, canvas.width, canvas.height, {
        rainEngine: rainEngineRef,
        petals: petalsRef,
        embers: embersRef,
        stars: starsRef,
        lights: lightsRef,
        clouds: cloudsRef,
      });
    };

    // Interactive mouse / touch wipe on glass
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (activeEmotion !== 'sad_romantic') return;
      const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;
      if (clientX === undefined || clientY === undefined) return;

      const engine = rainEngineRef.current;
      // Clear condensation along mouse path & spawn sliding liquid droplet
      engine.wipeTrails.push({ x: clientX, y: clientY, r: 24, alpha: 0.9 });
      if (engine.wipeTrails.length > 40) engine.wipeTrails.shift();

      if (Math.random() < 0.3) {
        engine.drops.push({
          x: clientX + (Math.random() - 0.5) * 16,
          y: clientY,
          r: 3.5 + Math.random() * 5,
          vy: 1.5 + Math.random() * 3,
          vx: (Math.random() - 0.5) * 0.5,
          mass: 1.5 + Math.random() * 2,
          state: 'sliding',
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.08,
          wobbleAmp: 0.3,
          trail: [],
          trailTimer: 0,
          stickTimer: 0,
          isUserDrop: true,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 16.67, 2.5);
      lastTime = time;

      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // 1. Dynamic atmospheric background clouds & mist
      drawClouds(ctx, cloudsRef.current, W, H, activeEmotion, time, isPlaying);

      // 2. Specialized rendering for active romantic subtype
      switch (activeEmotion) {
        case 'sad_romantic':
          // 🌧️ Authentic Tympanus Rain Simulator with fluid coalescence, sliding & ripples
          updateAndDrawTympanusRain(ctx, rainEngineRef.current, W, H, dt, time, isPlaying);
          break;

        case 'dark_romantic':
          // 🥀 Rolling dark crimson storm with rising embers & 3D velvet rose petals
          drawDarkRedAtmosphere(ctx, W, H, time, isPlaying);
          drawRosePetals(ctx, petalsRef.current, W, H, dt, time, 'dark', isPlaying);
          drawEmbers(ctx, embersRef.current, W, H, dt, time, 'crimson', isPlaying);
          break;

        case 'soft_romantic':
          // 🌸 Soft pink & crimson 3D rose petals with warm acoustic heartbeat glow
          drawSoftRomanticAtmosphere(ctx, W, H, time, isPlaying);
          drawRosePetals(ctx, petalsRef.current, W, H, dt, time, 'soft', isPlaying);
          drawEmbers(ctx, embersRef.current, W, H, dt, time, 'soft_gold', isPlaying);
          break;

        case 'happy_romantic':
          // ✨ Golden sunburst rays, celebratory sparkles & bokeh bubbles
          drawHappySunburst(ctx, W, H, time, isPlaying);
          drawSparkles(ctx, embersRef.current, W, H, dt, time, isPlaying);
          break;

        case 'devotional_romantic':
          // 🙏 Rotating divine golden rays & floating diya lanterns
          drawDevotionalRays(ctx, W, H, time, isPlaying);
          drawDivineLights(ctx, lightsRef.current, W, H, dt, time, isPlaying);
          break;

        case 'dreamy_romantic':
          // 🌙 Starry cosmos, constellations & northern lights aurora
          drawAurora(ctx, W, H, time, isPlaying);
          drawStars(ctx, starsRef.current, W, H, time);
          break;
      }

      // 3. Cinematic Vignette
      drawVignette(ctx, W, H, activeEmotion);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
    };
  }, [isPlaying, activeEmotion]);

  const currentThemeInfo = ALL_ROMANTIC_THEMES.find((t) => t.type === activeEmotion) || ALL_ROMANTIC_THEMES[0];

  return (
    <>
      {/* 60FPS WebGL/Canvas Physical Layer */}
      <canvas
        ref={canvasRef}
        className={`emotion-canvas ${isPlaying ? 'emotion-canvas-active' : 'emotion-canvas-dimmed'}`}
        aria-hidden="true"
      />

      {/* Deep CSS atmospheric gradient */}
      <div
        className={`emotion-overlay emotion-${activeEmotion} ${isPlaying ? 'emotion-active' : 'emotion-paused'} ${isTransitioning ? 'emotion-transitioning' : ''}`}
        aria-hidden="true"
      >
        <div className="emotion-gradient" />
      </div>

      {/* Sleek Automatic AI Mood Badge */}
      <div className="emotion-badge-container">
        <div
          className="emotion-badge-pill"
          title={`AI Romantic Subtype: ${emotionData?.label || currentThemeInfo.shortLabel}`}
        >
          <span className="emotion-badge-icon">{currentThemeInfo.icon}</span>
          <span className="emotion-badge-label">
            {emotionData?.label || currentThemeInfo.shortLabel}
          </span>
        </div>
      </div>
    </>
  );
}

// ===================================================================
// DATA STRUCTURES
// ===================================================================

interface GlassDrop {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  mass: number;
  state: 'resting' | 'sliding' | 'accelerating';
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  trail: { x: number; y: number; r: number; alpha: number }[];
  trailTimer: number;
  stickTimer: number;
  isUserDrop?: boolean;
}

interface StaticDrop {
  x: number;
  y: number;
  r: number;
  alpha: number;
  phase: number;
  speed: number;
}

interface RainStreak {
  x: number;
  y: number;
  l: number;
  vy: number;
  vx: number;
  alpha: number;
  width: number;
}

interface SplashRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  dr: number;
}

interface WipeTrail {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

interface LightningState {
  active: boolean;
  timer: number;
  intensity: number;
}

interface RainEngineState {
  drops: GlassDrop[];
  staticDrops: StaticDrop[];
  rainStreaksBg: RainStreak[];
  rainStreaksFg: RainStreak[];
  ripples: SplashRipple[];
  lightning: LightningState;
  spawnTimer: number;
  wipeTrails: WipeTrail[];
}

interface Petal {
  x: number;
  y: number;
  z: number;
  size: number;
  vx: number;
  vy: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  alpha: number;
}

interface Ember {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  life: number;
  maxLife: number;
  hue: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
  phase: number;
}

interface DivineLight {
  x: number;
  y: number;
  targetY: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  pulsePhase: number;
}

interface CloudLayer {
  x: number;
  y: number;
  radius: number;
  vx: number;
  alpha: number;
}

// ===================================================================
// INITIALIZATION
// ===================================================================

function initScene(
  emotion: EmotionType,
  W: number,
  H: number,
  refs: {
    rainEngine: React.MutableRefObject<RainEngineState>;
    petals: React.MutableRefObject<Petal[]>;
    embers: React.MutableRefObject<Ember[]>;
    stars: React.MutableRefObject<Star[]>;
    lights: React.MutableRefObject<DivineLight[]>;
    clouds: React.MutableRefObject<CloudLayer[]>;
  }
) {
  // 1. Storm / Ambient Cloud Layers
  refs.clouds.current = [];
  for (let i = 0; i < 7; i++) {
    refs.clouds.current.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.75,
      radius: Math.min(W, H) * (0.35 + Math.random() * 0.45),
      vx: (Math.random() - 0.5) * 0.18,
      alpha: 0.14 + Math.random() * 0.16,
    });
  }

  // 2. 🌧️ Tympanus Physical Rain Engine (for Sad Romantic)
  if (emotion === 'sad_romantic') {
    const engine = refs.rainEngine.current;
    engine.drops = [];
    engine.staticDrops = [];
    engine.rainStreaksBg = [];
    engine.rainStreaksFg = [];
    engine.ripples = [];
    engine.wipeTrails = [];
    engine.lightning = { active: false, timer: 8 + Math.random() * 12, intensity: 0 };
    engine.spawnTimer = 0;

    // A. 250 micro-condensation droplets on glass
    for (let i = 0; i < 250; i++) {
      engine.staticDrops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.8 + Math.random() * 2.8,
        alpha: 0.2 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        speed: 0.001 + Math.random() * 0.002,
      });
    }

    // B. 35 dynamic liquid raindrops that slide, stick, merge & leave trails
    for (let i = 0; i < 35; i++) {
      const isLarge = Math.random() < 0.35;
      engine.drops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: isLarge ? 5 + Math.random() * 6 : 2.5 + Math.random() * 3,
        vy: 0,
        vx: 0,
        mass: isLarge ? 3 + Math.random() * 3 : 1 + Math.random() * 1.5,
        state: Math.random() < 0.25 ? 'sliding' : 'resting',
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.04 + Math.random() * 0.06,
        wobbleAmp: 0.15 + Math.random() * 0.2,
        trail: [],
        trailTimer: 0,
        stickTimer: Math.random() * 180,
      });
    }

    // C. Background & Foreground parallax falling storm sheets
    for (let i = 0; i < 80; i++) {
      engine.rainStreaksBg.push({
        x: Math.random() * W,
        y: Math.random() * H,
        l: 18 + Math.random() * 35,
        vy: 16 + Math.random() * 10,
        vx: -2.8 - Math.random() * 1.5,
        alpha: 0.15 + Math.random() * 0.25,
        width: 0.9,
      });
    }

    for (let i = 0; i < 40; i++) {
      engine.rainStreaksFg.push({
        x: Math.random() * W,
        y: Math.random() * H,
        l: 30 + Math.random() * 50,
        vy: 24 + Math.random() * 14,
        vx: -3.5 - Math.random() * 1.8,
        alpha: 0.25 + Math.random() * 0.35,
        width: 1.5,
      });
    }
  }

  // 3. 🥀 Rose Petals (for Soft & Dark Romantic)
  if (emotion === 'soft_romantic' || emotion === 'dark_romantic') {
    refs.petals.current = [];
    const count = emotion === 'soft_romantic' ? 42 : 30;
    for (let i = 0; i < count; i++) {
      refs.petals.current.push(createPetal(W, H, true));
    }
  }

  // 4. 🔥 Embers & Floating Micro Sparks
  if (
    emotion === 'dark_romantic' ||
    emotion === 'soft_romantic' ||
    emotion === 'happy_romantic'
  ) {
    refs.embers.current = [];
    const count = emotion === 'dark_romantic' ? 50 : emotion === 'happy_romantic' ? 45 : 28;
    for (let i = 0; i < count; i++) {
      refs.embers.current.push(createEmber(W, H, true));
    }
  }

  // 5. 🌙 Stars for Dreamy Romantic
  if (emotion === 'dreamy_romantic') {
    refs.stars.current = [];
    for (let i = 0; i < 125; i++) {
      refs.stars.current.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.82,
        size: 1 + Math.random() * 3.2,
        alpha: 0.25 + Math.random() * 0.75,
        speed: 0.002 + Math.random() * 0.004,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  // 6. 🙏 Devotional Divine Diya Lights
  if (emotion === 'devotional_romantic') {
    refs.lights.current = [];
    for (let i = 0; i < 26; i++) {
      refs.lights.current.push({
        x: Math.random() * W,
        y: H * 0.5 + Math.random() * (H * 0.45),
        targetY: H * 0.1 + Math.random() * (H * 0.5),
        size: 6 + Math.random() * 15,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.4 + Math.random() * 0.8),
        alpha: 0.4 + Math.random() * 0.5,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }
}

function createPetal(W: number, H: number, scatter = false): Petal {
  return {
    x: Math.random() * (W + 120) - 60,
    y: scatter ? Math.random() * H : -40,
    z: 0.5 + Math.random() * 1.5,
    size: 11 + Math.random() * 15,
    vx: -0.6 + Math.random() * 1.6,
    vy: 0.9 + Math.random() * 1.9,
    rotX: Math.random() * Math.PI * 2,
    rotY: Math.random() * Math.PI * 2,
    rotZ: Math.random() * Math.PI * 2,
    vRotX: (Math.random() - 0.5) * 0.035,
    vRotY: (Math.random() - 0.5) * 0.035,
    vRotZ: (Math.random() - 0.5) * 0.025,
    alpha: 0.65 + Math.random() * 0.35,
  };
}

function createEmber(W: number, H: number, scatter = false): Ember {
  return {
    x: Math.random() * W,
    y: scatter ? Math.random() * H : H + 12,
    size: 2 + Math.random() * 4.5,
    vx: (Math.random() - 0.5) * 1.6,
    vy: -(1.3 + Math.random() * 2.7),
    alpha: 0.65 + Math.random() * 0.35,
    life: 0,
    maxLife: 160 + Math.random() * 260,
    hue: Math.random() * 30,
  };
}

// ===================================================================
// ATMOSPHERIC BACKGROUND CLOUDS
// ===================================================================

function drawClouds(
  ctx: CanvasRenderingContext2D,
  clouds: CloudLayer[],
  W: number,
  H: number,
  emotion: EmotionType,
  time: number,
  isPlaying: boolean
) {
  let col1 = 'rgba(18, 28, 52, 0.6)';
  let col2 = 'rgba(5, 12, 26, 0)';

  if (emotion === 'sad_romantic') {
    col1 = 'rgba(16, 26, 50, 0.65)';
    col2 = 'rgba(4, 10, 22, 0)';
  } else if (emotion === 'dark_romantic') {
    col1 = 'rgba(110, 8, 24, 0.6)';
    col2 = 'rgba(45, 2, 8, 0)';
  } else if (emotion === 'soft_romantic') {
    col1 = 'rgba(85, 12, 35, 0.42)';
    col2 = 'rgba(35, 3, 12, 0)';
  } else if (emotion === 'happy_romantic') {
    col1 = 'rgba(95, 55, 0, 0.38)';
    col2 = 'rgba(35, 15, 0, 0)';
  } else if (emotion === 'devotional_romantic') {
    col1 = 'rgba(100, 48, 0, 0.48)';
    col2 = 'rgba(32, 10, 0, 0)';
  } else if (emotion === 'dreamy_romantic') {
    col1 = 'rgba(22, 10, 60, 0.48)';
    col2 = 'rgba(6, 26, 38, 0)';
  }

  const speedMult = isPlaying ? 1 : 0.4;

  for (const c of clouds) {
    c.x += c.vx * speedMult;
    if (c.x < -c.radius) c.x = W + c.radius;
    if (c.x > W + c.radius) c.x = -c.radius;

    const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius);
    grd.addColorStop(0, col1);
    grd.addColorStop(1, col2);

    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===================================================================
// 🌧️ SAD ROMANTIC — FULL TYMPANUS PHYSICAL RAIN SIMULATOR
// ===================================================================

function updateAndDrawTympanusRain(
  ctx: CanvasRenderingContext2D,
  engine: RainEngineState,
  W: number,
  H: number,
  dt: number,
  time: number,
  isPlaying: boolean
) {
  const speed = isPlaying ? 1 : 0.4;

  // 1. Distant Storm Lightning & Thunder Flash
  engine.lightning.timer -= (dt * speed) / 60;
  if (engine.lightning.timer <= 0) {
    engine.lightning.active = true;
    engine.lightning.intensity = 0.65 + Math.random() * 0.3;
    engine.lightning.timer = 12 + Math.random() * 20;
  }

  if (engine.lightning.active) {
    engine.lightning.intensity -= 0.04 * dt;
    if (engine.lightning.intensity <= 0) {
      engine.lightning.active = false;
      engine.lightning.intensity = 0;
    } else {
      ctx.fillStyle = `rgba(220, 240, 255, ${engine.lightning.intensity * 0.28})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // 2. Parallax Falling Rain Streaks (Background Storm Sheet)
  ctx.strokeStyle = 'rgba(160, 205, 255, 0.22)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const s of engine.rainStreaksBg) {
    s.y += s.vy * dt * speed;
    s.x += s.vx * dt * speed;
    if (s.y > H + s.l) {
      s.y = -s.l;
      s.x = Math.random() * (W + 200);
    }
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.vx * 1.4, s.y + s.l);
  }
  ctx.stroke();

  // 3. Parallax Falling Rain Streaks (Foreground Heavy Rain)
  ctx.strokeStyle = 'rgba(210, 235, 255, 0.38)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const s of engine.rainStreaksFg) {
    s.y += s.vy * dt * speed;
    s.x += s.vx * dt * speed;
    if (s.y > H + s.l) {
      s.y = -s.l;
      s.x = Math.random() * (W + 200);

      // Glass impact: spawn a splash ripple occasionally
      if (Math.random() < 0.25) {
        engine.ripples.push({
          x: s.x,
          y: Math.random() * H,
          r: 2,
          maxR: 12 + Math.random() * 18,
          alpha: 0.55,
          dr: 0.7 + Math.random() * 0.8,
        });
      }
    }
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.vx * 1.5, s.y + s.l);
  }
  ctx.stroke();

  // 4. Expanding Splash Ripples on Glass
  for (let i = engine.ripples.length - 1; i >= 0; i--) {
    const rip = engine.ripples[i];
    rip.r += rip.dr * dt * speed;
    rip.alpha -= 0.015 * dt * speed;

    if (rip.alpha <= 0 || rip.r >= rip.maxR) {
      engine.ripples.splice(i, 1);
      continue;
    }

    ctx.strokeStyle = `rgba(200, 230, 255, ${rip.alpha * 0.45})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 5. Interactive Wipe Trails (from mouse / finger)
  for (let i = engine.wipeTrails.length - 1; i >= 0; i--) {
    const wt = engine.wipeTrails[i];
    wt.alpha -= 0.004 * dt;
    if (wt.alpha <= 0) {
      engine.wipeTrails.splice(i, 1);
      continue;
    }
    const wipeGrd = ctx.createRadialGradient(wt.x, wt.y, 0, wt.x, wt.y, wt.r);
    wipeGrd.addColorStop(0, `rgba(180, 220, 255, ${wt.alpha * 0.15})`);
    wipeGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = wipeGrd;
    ctx.beginPath();
    ctx.arc(wt.x, wt.y, wt.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. 250 Micro-condensation droplets on glass (with subtle pulsing shimmer)
  for (const sd of engine.staticDrops) {
    sd.phase += sd.speed * dt;
    const pulse = Math.sin(sd.phase) * 0.12 + 0.88;
    const r = sd.r * pulse;

    // Refraction Body
    ctx.beginPath();
    ctx.arc(sd.x, sd.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(190, 225, 255, ${sd.alpha * 0.55})`;
    ctx.fill();

    // Top-left glossy glint
    ctx.beginPath();
    ctx.arc(sd.x - r * 0.35, sd.y - r * 0.35, Math.max(0.5, r * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${sd.alpha * 0.85})`;
    ctx.fill();
  }

  // 7. Dynamic Drop Spawning (continuous lifecycle so scene is never empty/static)
  engine.spawnTimer += dt * speed;
  if (engine.spawnTimer > 45 && engine.drops.length < 45) {
    engine.spawnTimer = 0;
    const isLarge = Math.random() < 0.4;
    engine.drops.push({
      x: Math.random() * W,
      y: -20,
      r: isLarge ? 5 + Math.random() * 6 : 2.5 + Math.random() * 3,
      vy: 1.5 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 0.4,
      mass: isLarge ? 3 + Math.random() * 3 : 1 + Math.random() * 1.5,
      state: 'sliding',
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.06,
      wobbleAmp: 0.25,
      trail: [],
      trailTimer: 0,
      stickTimer: 0,
    });
  }

  // 8. Dynamic Liquid Droplets Simulation with Coalescence (Merging) Physics
  for (let i = engine.drops.length - 1; i >= 0; i--) {
    const d = engine.drops[i];

    // Physics Update
    d.wobblePhase += d.wobbleSpeed * dt;
    const wobble = Math.sin(d.wobblePhase) * d.wobbleAmp;

    if (isPlaying) {
      if (d.state === 'resting') {
        d.stickTimer -= dt;
        // Natural surface tension slip-and-stick
        if (d.stickTimer <= 0 || d.mass > 3.5) {
          d.state = 'sliding';
          d.vy = 0.8 + d.mass * 0.6 + Math.random() * 2;
          d.stickTimer = 40 + Math.random() * 120;
        }
      } else {
        // Sliding state
        d.vy += (0.05 + d.mass * 0.02) * dt;
        d.y += d.vy * dt * speed;
        d.x += (Math.sin(d.y * 0.015) * 0.8 + d.vx) * dt * speed;

        // Leave wet trail droplets behind in the wake
        d.trailTimer -= dt;
        if (d.trailTimer <= 0) {
          d.trail.push({
            x: d.x + (Math.random() - 0.5) * 2,
            y: d.y,
            r: d.r * (0.22 + Math.random() * 0.28),
            alpha: 0.75,
          });
          d.trailTimer = 3 + Math.random() * 5;
          if (d.trail.length > 32) d.trail.shift();
        }

        // Stick-slip pause mechanic (occasionally slows down when hitting friction)
        d.stickTimer -= dt;
        if (d.stickTimer <= 0 && Math.random() < 0.15 && !d.isUserDrop) {
          d.state = 'resting';
          d.vy = 0;
          d.stickTimer = 30 + Math.random() * 90;
        }
      }
    }

    // Coalescence (Merging) Physics: Eat nearby resting drops and micro-droplets
    if (d.state === 'sliding' && isPlaying) {
      // Absorb nearby static condensation droplets
      for (const s of engine.staticDrops) {
        const dx = s.x - d.x;
        const dy = s.y - d.y;
        if (Math.abs(dx) < d.r * 1.5 && Math.abs(dy) < d.r * 1.5) {
          s.x = Math.random() * W;
          s.y = Math.random() * H;
          d.r = Math.min(d.r + 0.06, 17);
          d.mass += 0.1;
          d.vy += 0.05;
        }
      }

      // Merge with other liquid drops if colliding
      for (let j = 0; j < engine.drops.length; j++) {
        if (i === j) continue;
        const other = engine.drops[j];
        const dist = Math.hypot(other.x - d.x, other.y - d.y);
        if (dist < (d.r + other.r) * 0.9) {
          // Merge 'other' into 'd'
          d.r = Math.sqrt(d.r * d.r + other.r * other.r);
          d.mass += other.mass;
          d.vy += 0.3;
          d.wobbleAmp = 0.45; // collision wobble!
          engine.ripples.push({
            x: d.x,
            y: d.y,
            r: 3,
            maxR: d.r * 2.5,
            alpha: 0.6,
            dr: 0.6,
          });
          engine.drops.splice(j, 1);
          break;
        }
      }
    }

    // Respawn when falling off the bottom
    if (d.y > H + d.r + 30) {
      engine.drops.splice(i, 1);
      continue;
    }

    // A. Render Droplet Water Trail
    for (const t of d.trail) {
      t.alpha = Math.max(0, t.alpha - 0.002 * dt);
      if (t.alpha <= 0) continue;

      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 220, 255, ${t.alpha * 0.45})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, Math.max(0.4, t.r * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${t.alpha * 0.75})`;
      ctx.fill();
    }

    // B. Render 3D Liquid Drop
    const curR = d.r * (1 + wobble * 0.15);

    // 1. Dark Caustic Shadow (Depth against background glass)
    ctx.beginPath();
    ctx.arc(d.x + curR * 0.25, d.y + curR * 0.3, curR * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // 2. Liquid Body (Convex refraction lens gradient)
    const dropGrd = ctx.createRadialGradient(
      d.x - curR * 0.35,
      d.y - curR * 0.35,
      0,
      d.x,
      d.y,
      curR
    );
    dropGrd.addColorStop(0, 'rgba(235, 248, 255, 0.88)');
    dropGrd.addColorStop(0.35, 'rgba(160, 205, 245, 0.5)');
    dropGrd.addColorStop(0.8, 'rgba(75, 120, 180, 0.3)');
    dropGrd.addColorStop(1, 'rgba(15, 45, 85, 0.7)');

    ctx.save();
    ctx.translate(d.x, d.y);
    if (d.state === 'sliding' && d.vy > 1.5) {
      // Teardrop elongation in motion
      ctx.scale(1 - wobble * 0.1, 1 + Math.min(d.vy * 0.08, 0.4));
    }
    ctx.beginPath();
    ctx.arc(0, 0, curR, 0, Math.PI * 2);
    ctx.fillStyle = dropGrd;
    ctx.fill();

    // 3. Primary Specular Highlight Glint (Top-Left Curved Crescent)
    ctx.beginPath();
    ctx.ellipse(
      -curR * 0.35,
      -curR * 0.35,
      curR * 0.45,
      curR * 0.25,
      -Math.PI / 4,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fill();

    // 4. Secondary Ground Reflection Highlight (Bottom-Right)
    ctx.beginPath();
    ctx.arc(curR * 0.35, curR * 0.35, curR * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220, 245, 255, 0.55)';
    ctx.fill();

    ctx.restore();
  }
}

// ===================================================================
// 🥀 DARK ROMANTIC — CRIMSON HAZE & EMBERS
// ===================================================================

function drawDarkRedAtmosphere(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  time: number,
  isPlaying: boolean
) {
  const pulse = isPlaying ? Math.sin(time * 0.003) * 0.08 + 0.25 : 0.15;
  const grd = ctx.createRadialGradient(W * 0.5, H * 0.7, 0, W * 0.5, H * 0.7, H * 0.85);
  grd.addColorStop(0, `rgba(180, 10, 30, ${pulse + 0.15})`);
  grd.addColorStop(0.5, `rgba(90, 0, 18, ${pulse})`);
  grd.addColorStop(1, 'transparent');

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

// ===================================================================
// 🌸 SOFT ROMANTIC — 3D ROSE PETALS & HEARTBEAT
// ===================================================================

function drawSoftRomanticAtmosphere(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  time: number,
  isPlaying: boolean
) {
  const heartBeat = isPlaying
    ? Math.pow(Math.sin(time * 0.0035), 4) * 0.18 + 0.12
    : 0.08;

  const grd = ctx.createRadialGradient(W * 0.5, H * 0.65, 0, W * 0.5, H * 0.65, H * 0.8);
  grd.addColorStop(0, `rgba(215, 45, 90, ${heartBeat + 0.12})`);
  grd.addColorStop(0.5, `rgba(110, 15, 40, ${heartBeat})`);
  grd.addColorStop(1, 'transparent');

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

function drawRosePetals(
  ctx: CanvasRenderingContext2D,
  petals: Petal[],
  W: number,
  H: number,
  dt: number,
  time: number,
  mode: 'soft' | 'dark',
  isPlaying: boolean
) {
  const speed = isPlaying ? 1 : 0.3;

  for (const p of petals) {
    p.y += p.vy * dt * speed;
    p.x += (p.vx + Math.sin(time * 0.002 + p.y * 0.01) * 0.8) * dt * speed;

    p.rotX += p.vRotX * dt * speed;
    p.rotY += p.vRotY * dt * speed;
    p.rotZ += p.vRotZ * dt * speed;

    if (p.y > H + 40) {
      Object.assign(p, createPetal(W, H, false));
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotZ);
    const scaleX = Math.cos(p.rotX) * p.z;
    const scaleY = Math.cos(p.rotY) * p.z;
    ctx.scale(Math.abs(scaleX) + 0.2, Math.abs(scaleY) + 0.2);

    const s = p.size;

    // Petal shadow
    ctx.beginPath();
    ctx.ellipse(3, 5, s * 0.7, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();

    // Curved Organic Rose Petal Shape
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.8, -s * 0.7, s * 1.1, s * 0.2, 0, s);
    ctx.bezierCurveTo(-s * 1.1, s * 0.2, -s * 0.8, -s * 0.7, 0, -s);

    const petalGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
    if (mode === 'dark') {
      petalGrd.addColorStop(0, `rgba(235, 30, 60, ${p.alpha})`);
      petalGrd.addColorStop(0.55, `rgba(160, 5, 25, ${p.alpha * 0.95})`);
      petalGrd.addColorStop(0.9, `rgba(80, 0, 15, ${p.alpha * 0.85})`);
      petalGrd.addColorStop(1, `rgba(40, 0, 8, ${p.alpha * 0.6})`);
    } else {
      petalGrd.addColorStop(0, `rgba(255, 110, 145, ${p.alpha})`);
      petalGrd.addColorStop(0.55, `rgba(215, 35, 75, ${p.alpha * 0.95})`);
      petalGrd.addColorStop(0.9, `rgba(140, 10, 45, ${p.alpha * 0.85})`);
      petalGrd.addColorStop(1, `rgba(80, 5, 25, ${p.alpha * 0.6})`);
    }

    ctx.fillStyle = petalGrd;
    ctx.fill();

    ctx.strokeStyle =
      mode === 'dark'
        ? `rgba(255, 100, 130, ${p.alpha * 0.3})`
        : `rgba(255, 180, 200, ${p.alpha * 0.4})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.quadraticCurveTo(s * 0.1, 0, 0, s * 0.8);
    ctx.stroke();

    ctx.restore();
  }
}

function drawEmbers(
  ctx: CanvasRenderingContext2D,
  embers: Ember[],
  W: number,
  H: number,
  dt: number,
  time: number,
  theme: 'crimson' | 'soft_gold',
  isPlaying: boolean
) {
  const speed = isPlaying ? 1 : 0.3;

  for (const e of embers) {
    e.life += dt * speed;
    e.y += e.vy * dt * speed;
    e.x += (e.vx + Math.sin(time * 0.003 + e.y * 0.02) * 0.6) * dt * speed;

    const progress = e.life / e.maxLife;
    let alpha = e.alpha;
    if (progress < 0.15) alpha *= progress / 0.15;
    if (progress > 0.75) alpha *= (1 - progress) / 0.25;

    if (e.life > e.maxLife || e.y < -20) {
      Object.assign(e, createEmber(W, H, false));
    }

    const r = e.size * (1 - progress * 0.3);

    const glowGrd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 3.5);
    if (theme === 'crimson') {
      glowGrd.addColorStop(0, `rgba(255, 60, 90, ${alpha * 0.85})`);
      glowGrd.addColorStop(0.5, `rgba(180, 15, 45, ${alpha * 0.35})`);
    } else {
      glowGrd.addColorStop(0, `rgba(255, 210, 120, ${alpha * 0.8})`);
      glowGrd.addColorStop(0.5, `rgba(255, 140, 60, ${alpha * 0.3})`);
    }
    glowGrd.addColorStop(1, 'transparent');

    ctx.fillStyle = glowGrd;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 230, ${alpha})`;
    ctx.fill();
  }
}

// ===================================================================
// ✨ HAPPY ROMANTIC — GOLDEN SUNBURST & CELEBRATION SPARKLES
// ===================================================================

function drawHappySunburst(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  time: number,
  isPlaying: boolean
) {
  const pulse = (Math.sin(time * 0.002) + 1) * 0.05 + 0.15;
  const sunGrd = ctx.createRadialGradient(W * 0.5, H * 0.2, 0, W * 0.5, H * 0.2, H * 0.8);
  sunGrd.addColorStop(0, `rgba(255, 215, 0, ${pulse + 0.15})`);
  sunGrd.addColorStop(0.4, `rgba(255, 140, 0, ${pulse * 0.7})`);
  sunGrd.addColorStop(1, 'transparent');

  ctx.fillStyle = sunGrd;
  ctx.fillRect(0, 0, W, H);
}

function drawSparkles(
  ctx: CanvasRenderingContext2D,
  sparkles: Ember[],
  W: number,
  H: number,
  dt: number,
  time: number,
  isPlaying: boolean
) {
  const speed = isPlaying ? 1 : 0.4;

  for (const s of sparkles) {
    s.life += dt * speed;
    s.y += s.vy * dt * speed;
    s.x += (s.vx + Math.sin(time * 0.003 + s.y * 0.03)) * dt * speed;

    const progress = s.life / s.maxLife;
    let alpha = s.alpha;
    if (progress < 0.2) alpha *= progress / 0.2;
    if (progress > 0.8) alpha *= (1 - progress) / 0.2;

    if (s.life > s.maxLife || s.y < -20) {
      Object.assign(s, createEmber(W, H, false));
    }

    const r = s.size;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(time * 0.003 + s.x);

    ctx.strokeStyle = `rgba(255, 235, 140, ${alpha * 0.85})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 2, 0);
    ctx.lineTo(r * 2, 0);
    ctx.moveTo(0, -r * 2);
    ctx.lineTo(0, r * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();

    ctx.restore();
  }
}

// ===================================================================
// 🙏 DEVOTIONAL ROMANTIC — ROTATING DIVINE RAYS & DIYAS
// ===================================================================

function drawDevotionalRays(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  time: number,
  isPlaying: boolean
) {
  const angle = isPlaying ? time * 0.0004 : time * 0.0001;

  ctx.save();
  ctx.translate(W * 0.5, H * 0.2);
  ctx.rotate(angle);

  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const rayAngle = (i / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, Math.max(W, H), rayAngle - 0.07, rayAngle + 0.07);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 185, 40, 0.045)';
    ctx.fill();
  }

  ctx.restore();
}

function drawDivineLights(
  ctx: CanvasRenderingContext2D,
  lights: DivineLight[],
  W: number,
  H: number,
  dt: number,
  time: number,
  isPlaying: boolean
) {
  const speed = isPlaying ? 1 : 0.3;

  for (const l of lights) {
    l.y += l.vy * dt * speed;
    l.x += (l.vx + Math.sin(time * 0.002 + l.y * 0.01) * 0.3) * dt * speed;

    if (l.y < l.targetY) {
      l.y = H * 0.8 + Math.random() * (H * 0.2);
      l.x = Math.random() * W;
    }

    const pulse = (Math.sin(time * 0.003 + l.pulsePhase) + 1) * 0.3 + 0.7;
    const r = l.size * pulse;

    const auraGrd = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r * 3);
    auraGrd.addColorStop(0, `rgba(255, 210, 80, ${l.alpha * 0.9})`);
    auraGrd.addColorStop(0.5, `rgba(255, 130, 0, ${l.alpha * 0.4})`);
    auraGrd.addColorStop(1, 'transparent');

    ctx.fillStyle = auraGrd;
    ctx.beginPath();
    ctx.arc(l.x, l.y, r * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(l.x, l.y, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 220, ${l.alpha * 0.95})`;
    ctx.fill();
  }
}

// ===================================================================
// 🌙 DREAMY ROMANTIC — AURORA & STARRY NIGHT
// ===================================================================

function drawAurora(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  time: number,
  isPlaying: boolean
) {
  const speed = isPlaying ? 0.001 : 0.0003;
  const wave1 = Math.sin(time * speed) * 40;
  const wave2 = Math.cos(time * speed * 0.8) * 30;

  const auroraGrd = ctx.createLinearGradient(0, 0, W, H * 0.6);
  auroraGrd.addColorStop(0, 'rgba(15, 75, 55, 0.25)');
  auroraGrd.addColorStop(0.5, 'rgba(90, 45, 140, 0.22)');
  auroraGrd.addColorStop(1, 'rgba(20, 110, 130, 0.15)');

  ctx.fillStyle = auroraGrd;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.bezierCurveTo(W * 0.7, H * 0.35 + wave1, W * 0.3, H * 0.45 + wave2, 0, H * 0.3);
  ctx.closePath();
  ctx.fill();
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  W: number,
  H: number,
  time: number
) {
  for (const s of stars) {
    const twinkle = (Math.sin(time * s.speed + s.phase) + 1) * 0.5;
    const a = s.alpha * (0.3 + twinkle * 0.7);

    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * (0.8 + twinkle * 0.4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(230, 240, 255, ${a})`;
    ctx.fill();
  }
}

// ===================================================================
// 🎬 CINEMATIC VIGNETTE
// ===================================================================

function drawVignette(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  emotion: EmotionType
) {
  const vignetteGrd = ctx.createRadialGradient(
    W * 0.5,
    H * 0.5,
    Math.min(W, H) * 0.35,
    W * 0.5,
    H * 0.5,
    Math.max(W, H) * 0.75
  );
  vignetteGrd.addColorStop(0, 'transparent');
  const intensity = emotion === 'sad_romantic' || emotion === 'dark_romantic' ? 0.65 : 0.4;
  vignetteGrd.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);

  ctx.fillStyle = vignetteGrd;
  ctx.fillRect(0, 0, W, H);
}
