'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LiveAudioFeatures, AcousticIntent } from '@/hooks/useAudioEngine';

export type EmotionType =
  | 'sad_romantic'           // 🌧️ Melancholy, sorrowful love, separation & rain
  | 'heartbroken_romantic'     // 💔 Devastating breakup, love lost & emotional devastation
  | 'yearning_romantic'        // 🫶 Intense longing, viraha, missing someone & distance
  | 'dark_romantic'            // 🥀 Obsessive, haunting, dramatic & dark passion
  | 'sensual_romantic'         // 🔥 Physical attraction, chemistry, seduction & tension
  | 'soft_romantic'            // 🌸 Gentle, innocent, tender & comforting sweet love
  | 'intimate_romantic'        // ❤️ Deep emotional closeness, vulnerability & whispered romance
  | 'happy_romantic'           // ✨ Joyful, playful, flirtatious & celebratory love
  | 'hopeful_romantic'         // 🕊️ Optimistic love, reunion, faith & belief
  | 'nostalgic_romantic'       // 😢 Memories of past love, 90s vintage & reminiscence
  | 'devotional_romantic'      // 🙏 Sufi, divine, sacred, ishq-e-haqiqi & spiritual prayer
  | 'dreamy_romantic'          // 🌙 Ethereal, atmospheric, aurora & floating dreamscape
  // Backward compatibility aliases
  | 'heartbroken'
  | 'content_romantic'
  | 'adoring_romantic'
  | 'bittersweet_romantic'
  | 'lonely_romantic'
  | null;

export interface EmotionData {
  emotion: EmotionType;
  color: string;
  secondary: string;
  label: string;
  icon: string;
  themeDescription?: string;
  intent?: AcousticIntent;
}

export interface EmotionOverlayProps {
  songName: string;
  songArtist: string;
  isPlaying: boolean;
  getLiveFeatures?: () => LiveAudioFeatures;
  playlist?: { name: string; artist?: string }[];
  animationsEnabled?: boolean;
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
    shortLabel: 'Sad Rain',
    icon: '🌧️',
    desc: 'Fully animated rain on glass with droplet merging, sliding trails & condensation',
  },
  {
    type: 'heartbroken_romantic',
    label: 'Heartbroken & Devastated',
    shortLabel: 'Heartbroken',
    icon: '💔',
    desc: 'Shattered crystal shards drifting in a dark stormy void with lightning cracks',
  },
  {
    type: 'yearning_romantic',
    label: 'Deep Yearning (Viraha)',
    shortLabel: 'Yearning',
    icon: '🫶',
    desc: 'Swirling horizon mist with glowing floating paper lanterns drifting into the distance',
  },
  {
    type: 'dark_romantic',
    label: 'Dark & Obsessive Passion',
    shortLabel: 'Dark Passion',
    icon: '🥀',
    desc: 'Cloudy dark crimson mist with rising ember sparks and haunting intensity',
  },
  {
    type: 'sensual_romantic',
    label: 'Sensual Passion & Fire',
    shortLabel: 'Sensual Fire',
    icon: '🔥',
    desc: 'Rolling velvet crimson mist with rising ember sparks and burning chemistry',
  },
  {
    type: 'soft_romantic',
    label: 'Soft & Gentle Love',
    shortLabel: 'Soft Romance',
    icon: '🌸',
    desc: '3D floating rose petals with gentle warmth and acoustic serenity',
  },
  {
    type: 'intimate_romantic',
    label: 'Intimate & Tender Love',
    shortLabel: 'Intimate',
    icon: '❤️',
    desc: 'Warm candlelight ambiance with acoustic heartbeat pulse and gentle glowing halos',
  },
  {
    type: 'happy_romantic',
    label: 'Joyful & Playful Love',
    shortLabel: 'Happy Playful',
    icon: '✨',
    desc: 'Radiant golden sunburst rays with celebratory star sparkles and glitter bursts',
  },
  {
    type: 'hopeful_romantic',
    label: 'Hopeful & Uplifting',
    shortLabel: 'Hopeful',
    icon: '🕊️',
    desc: 'Rising celestial morning sunbeams with floating white down feathers',
  },
  {
    type: 'nostalgic_romantic',
    label: 'Nostalgic 90s Memories',
    shortLabel: 'Nostalgic',
    icon: '😢',
    desc: 'Vintage 35mm film grain, sepia scratches, and wandering glowing fireflies',
  },
  {
    type: 'devotional_romantic',
    label: 'Sufi & Sacred Love',
    shortLabel: 'Sufi Divine',
    icon: '🙏',
    desc: 'Rotating divine celestial rays, sacred glowing halos & floating diya lanterns',
  },
  {
    type: 'dreamy_romantic',
    label: 'Dreamy Aurora & Stars',
    shortLabel: 'Dreamy Aurora',
    icon: '🌙',
    desc: 'Northern lights aurora borealis, twinkling cosmic constellations & stardust',
  },
];

export function getInstantEmotion(name: string, artist?: string): EmotionData {
  const text = `${name || ''} ${artist || ''}`.toLowerCase();

  let emotion: EmotionType = 'soft_romantic';

  // 1. Heartbroken & Severe Grief
  if (
    text.includes('mushkil') ||
    text.includes('tadap') ||
    text.includes('channa mereya') ||
    text.includes('judai') ||
    text.includes('bhula dena') ||
    text.includes('dard-e-dil') ||
    text.includes('dard') ||
    text.includes('roya') ||
    text.includes('aansu') ||
    text.includes('bewafa') ||
    text.includes('rula') ||
    text.includes('alvida') ||
    text.includes('bikhra')
  ) {
    emotion = 'heartbroken_romantic';
  }
  // 2. Dark & Obsessive Passion
  else if (
    text.includes('deewana kar') ||
    text.includes('deewaniyat') ||
    text.includes('mera hua') ||
    text.includes('tum mere ho') ||
    text.includes('terre pyaar mein') ||
    text.includes('tu jo hain') ||
    text.includes('hate story') ||
    text.includes('raaz') ||
    text.includes('fitoor')
  ) {
    emotion = 'dark_romantic';
  }
  // 3. Sensual Romance & Seduction
  else if (
    text.includes('zara zara') ||
    text.includes('ang laga de') ||
    text.includes('jism') ||
    text.includes('labon ko') ||
    text.includes('bheege hoth') ||
    text.includes('sensual') ||
    text.includes('garmi')
  ) {
    emotion = 'sensual_romantic';
  }
  // 4. Yearning & Longing (Viraha)
  else if (
    text.includes('besabriyaan') ||
    text.includes('lo safar') ||
    text.includes('tu hi haqeeqat') ||
    text.includes('main woh chaand') ||
    text.includes('kaun tujhe') ||
    text.includes('agar tum saath') ||
    text.includes('intezaar') ||
    text.includes('tarse') ||
    text.includes('pee loon') ||
    text.includes('duriyan') ||
    text.includes('safar')
  ) {
    emotion = 'yearning_romantic';
  }
  // 5. Devotional & Sufi Sacred Love
  else if (
    text.includes('kun faya') ||
    text.includes('sajda') ||
    text.includes('khuda jane') ||
    text.includes('allah') ||
    text.includes('rabba') ||
    text.includes('arziyan') ||
    text.includes('maula') ||
    text.includes('sufi') ||
    text.includes('qawwali')
  ) {
    emotion = 'devotional_romantic';
  }
  // 6. Hopeful & Uplifting
  else if (
    text.includes('rab ka shukrana') ||
    text.includes('tu hi rab') ||
    text.includes('is qadar') ||
    text.includes('mitwa') ||
    text.includes('tum se') ||
    text.includes('hope') ||
    text.includes('sitaare')
  ) {
    emotion = 'hopeful_romantic';
  }
  // 7. Happy & Playful
  else if (
    text.includes('chaleya') ||
    text.includes('akhiyaan gulaab') ||
    text.includes('dil cheez') ||
    text.includes('nazar na lag') ||
    text.includes('pardesiya') ||
    text.includes('mere rashke qamar') ||
    text.includes('jeena haraam') ||
    text.includes('matargashti') ||
    text.includes('dance') ||
    text.includes('party') ||
    text.includes('rangabati')
  ) {
    emotion = 'happy_romantic';
  }
  // 8. Nostalgic 90s Retro
  else if (
    text.includes('main agar saamne') ||
    text.includes('pehla nasha') ||
    text.includes('baatein ankahee') ||
    text.includes('tum mile') ||
    text.includes('kuch kuch hota') ||
    text.includes('kumar sanu') ||
    text.includes('udit') ||
    text.includes('retro') ||
    text.includes('yaad')
  ) {
    emotion = 'nostalgic_romantic';
  }
  // 9. Intimate Whispers
  else if (
    text.includes('bol do na zara') ||
    text.includes('itni si baat') ||
    text.includes('ijazat') ||
    text.includes('dil mein ho tum') ||
    text.includes('naina re') ||
    text.includes('raabta') ||
    text.includes('hasi ban gaye')
  ) {
    emotion = 'intimate_romantic';
  }
  // 10. Dreamy Lofi Aurora
  else if (
    text.includes('neend') ||
    text.includes('chaand') ||
    text.includes('aurora') ||
    text.includes('taare') ||
    text.includes('khwaab') ||
    text.includes('lofi') ||
    text.includes('night')
  ) {
    emotion = 'dreamy_romantic';
  }
  // 11. Sad Rain
  else if (
    text.includes('tumse bhi zyada') ||
    text.includes('jeene bhi de') ||
    text.includes('tera mera rishta') ||
    text.includes('sawan') ||
    text.includes('baarish') ||
    text.includes('rain') ||
    text.includes('tanha') ||
    text.includes('alone')
  ) {
    emotion = 'sad_romantic';
  }
  // 12. Soft Romantic Default
  else {
    emotion = 'soft_romantic';
  }

  const themeInfo = ALL_ROMANTIC_THEMES.find((t) => t.type === emotion) || ALL_ROMANTIC_THEMES[5];
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
const STORAGE_KEY = 'deluxe_ai_emotions_v3';

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
  
  if (clientEmotionCache.has(cacheKey)) {
    return clientEmotionCache.get(cacheKey)!;
  }
  
  const stored = getLocalStoredEmotion(cacheKey);
  if (stored) {
    clientEmotionCache.set(cacheKey, stored);
    return stored;
  }
  
  return null;
}

function normalizeEmotionType(e: EmotionType): EmotionType {
  if (e === 'heartbroken') return 'heartbroken_romantic';
  if (e === 'content_romantic') return 'soft_romantic';
  if (e === 'adoring_romantic') return 'happy_romantic';
  if (e === 'bittersweet_romantic') return 'nostalgic_romantic';
  if (e === 'lonely_romantic') return 'sad_romantic';
  return e || 'soft_romantic';
}

// ===================================================================
// REACT COMPONENT
// ===================================================================

export default function EmotionOverlay({
  songName,
  songArtist,
  isPlaying,
  getLiveFeatures,
  animationsEnabled = true,
}: EmotionOverlayProps) {
  const [internalEnabled, setInternalEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('deluxe_animations_enabled') !== 'false';
    }
    return true;
  });

  useEffect(() => {
    const handleToggle = (e: any) => {
      if (e?.detail?.enabled !== undefined) {
        setInternalEnabled(e.detail.enabled);
      } else {
        setInternalEnabled((prev) => !prev);
      }
    };
    window.addEventListener('toggle-animations', handleToggle);
    return () => window.removeEventListener('toggle-animations', handleToggle);
  }, []);

  const isFxActive = animationsEnabled && internalEnabled;

  const [emotionData, setEmotionData] = useState<EmotionData>(() =>
    getCachedEmotion(songName, songArtist) || getInstantEmotion(songName, songArtist)
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const prevSongRef = useRef<string>('');
  const abortCtrlRef = useRef<AbortController | null>(null);

  // Engine references for persistent physical simulations
  const rainEngineRef = useRef<RainEngineState>({
    drops: [],
    staticDrops: [],
    rainStreaksBg: [],
    rainStreaksFg: [],
    ripples: [],
    lightning: { active: false, timer: 15, intensity: 0, x: 0 },
    spawnTimer: 0,
    wipeTrails: [],
    fogLayers: [],
  });

  const shardsRef = useRef<GlassShard[]>([]);
  const lanternsRef = useRef<Lantern[]>([]);
  const dandelionsRef = useRef<DandelionSeed[]>([]);
  const petalsRef = useRef<Petal[]>([]);
  const filmDustRef = useRef<FilmDust[]>([]);
  const feathersRef = useRef<Feather[]>([]);
  const embersRef = useRef<Ember[]>([]);
  const diyasRef = useRef<DiyaLantern[]>([]);
  const starsRef = useRef<CosmicStar[]>([]);
  const cloudsRef = useRef<CloudLayer[]>([]);
  const bokehRef = useRef<BokehOrb[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const energyVeinsRef = useRef<EnergyVein[]>([]);

  // Fetch song emotion ONLY for the single active song (checks browser cache first)
  const fetchEmotionForCurrentSong = useCallback(async (name: string, artist: string) => {
    if (!name) return;
    const cacheKey = `${name.toLowerCase()}::${(artist || '').toLowerCase()}`;
    
    const cached = getCachedEmotion(name, artist);
    if (cached) {
      setEmotionData(cached);
      return;
    }

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

  // Instant mood switch when song changes (0ms latency)
  useEffect(() => {
    if (!songName) return;
    const songKey = `${songName}::${songArtist}`;
    if (songKey === prevSongRef.current) return;
    prevSongRef.current = songKey;

    const instantData = getCachedEmotion(songName, songArtist) || getInstantEmotion(songName, songArtist);

    setEmotionData(instantData);
    setIsTransitioning(true);

    fetchEmotionForCurrentSong(songName, songArtist);

    const timeout = setTimeout(() => {
      setIsTransitioning(false);
    }, 200);
    return () => clearTimeout(timeout);
  }, [songName, songArtist, fetchEmotionForCurrentSong]);

  const activeEmotion: EmotionType = normalizeEmotionType(emotionData?.emotion);

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
      shards: shardsRef,
      lanterns: lanternsRef,
      dandelions: dandelionsRef,
      petals: petalsRef,
      filmDust: filmDustRef,
      feathers: feathersRef,
      embers: embersRef,
      diyas: diyasRef,
      stars: starsRef,
      clouds: cloudsRef,
      bokeh: bokehRef,
      shootingStars: shootingStarsRef,
      energyVeins: energyVeinsRef,
    });
  }, [activeEmotion]);

  // Main 60FPS Canvas Rendering Loop with Real-time Live Audio Reactivity
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    if (!isPlaying || !isFxActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initScene(activeEmotion, canvas.width, canvas.height, {
        rainEngine: rainEngineRef,
        shards: shardsRef,
        lanterns: lanternsRef,
        dandelions: dandelionsRef,
        petals: petalsRef,
        filmDust: filmDustRef,
        feathers: feathersRef,
        embers: embersRef,
        diyas: diyasRef,
        stars: starsRef,
        clouds: cloudsRef,
        bokeh: bokehRef,
        shootingStars: shootingStarsRef,
        energyVeins: energyVeinsRef,
      });
    };

    handleResize();

    // Interactive mouse / touch wipe on glass (for sad rain)
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (activeEmotion !== 'sad_romantic') return;
      const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;
      if (clientX === undefined || clientY === undefined) return;

      const engine = rainEngineRef.current;
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

      // Extract Live Real-Time Audio Energy & Features
      const audio: LiveAudioFeatures = getLiveFeatures ? getLiveFeatures() : {
        rms: 0.3,
        subBassEnergy: 0.3,
        midEnergy: 0.3,
        trebleEnergy: 0.3,
        spectralCentroid: 0.5,
        section: 'verse',
      };

      ctx.clearRect(0, 0, W, H);

      // 1. Dynamic atmospheric background clouds & mist (with live audio breathing)
      drawClouds(ctx, cloudsRef.current, W, H, activeEmotion, time, isPlaying, audio);

      // 2. Render active 60FPS animation with live audio reactivity
      switch (activeEmotion) {
        case 'heartbroken_romantic':
          drawHeartbrokenVoid(ctx, W, H, time, isPlaying, audio);
          drawEnergyVeins(ctx, energyVeinsRef.current, W, H, time, isPlaying, audio);
          drawGlassShards(ctx, shardsRef.current, W, H, dt, time, isPlaying, audio);
          break;

        case 'yearning_romantic':
          drawYearningMist(ctx, W, H, time, isPlaying, audio);
          drawFloatingLanterns(ctx, lanternsRef.current, W, H, dt, time, isPlaying, audio);
          break;

        case 'dark_romantic':
          drawDarkRedAtmosphere(ctx, W, H, time, isPlaying, audio);
          drawRosePetals(ctx, petalsRef.current, W, H, dt, time, 'dark', isPlaying, audio);
          drawEmbers(ctx, embersRef.current, W, H, dt, time, 'dark', isPlaying, audio);
          break;

        case 'sensual_romantic':
          drawSensualCrimson(ctx, W, H, time, isPlaying, audio);
          drawRosePetals(ctx, petalsRef.current, W, H, dt, time, 'crimson', isPlaying, audio);
          drawEmbers(ctx, embersRef.current, W, H, dt, time, 'warm', isPlaying, audio);
          break;

        case 'soft_romantic':
          drawSoftRomanticAtmosphere(ctx, W, H, time, isPlaying, audio);
          drawRosePetals(ctx, petalsRef.current, W, H, dt, time, 'soft', isPlaying, audio);
          drawDandelions(ctx, dandelionsRef.current, W, H, dt, time, isPlaying, audio);
          break;

        case 'intimate_romantic':
          drawIntimateCandlelight(ctx, W, H, time, isPlaying, audio);
          drawBokeh(ctx, bokehRef.current, W, H, dt, time, isPlaying, audio);
          break;

        case 'happy_romantic':
          drawHappySunburst(ctx, W, H, time, isPlaying, audio);
          drawSparkles(ctx, embersRef.current, W, H, dt, time, isPlaying, audio);
          drawConfetti(ctx, feathersRef.current, W, H, dt, time, isPlaying, audio);
          break;

        case 'hopeful_romantic':
          drawHopefulSunbeams(ctx, W, H, time, isPlaying, audio);
          drawFeathers(ctx, feathersRef.current, W, H, dt, time, isPlaying, audio);
          drawLightOrbs(ctx, bokehRef.current, W, H, dt, time, isPlaying, audio);
          break;

        case 'nostalgic_romantic':
          drawVintageSepia(ctx, W, H, time, isPlaying, audio);
          drawFilmDustAndFireflies(ctx, filmDustRef.current, W, H, dt, time, isPlaying, audio);
          break;

        case 'devotional_romantic':
          drawDevotionalRays(ctx, W, H, time, isPlaying, audio);
          drawSacredGeometry(ctx, W, H, time, isPlaying, audio);
          drawDiyaLanterns(ctx, diyasRef.current, W, H, dt, time, isPlaying, audio);
          break;

        case 'dreamy_romantic':
          drawAurora(ctx, W, H, time, isPlaying, audio);
          drawCosmicStars(ctx, starsRef.current, W, H, time, audio);
          drawShootingStars(ctx, shootingStarsRef.current, W, H, dt, time, isPlaying, audio);
          drawCosmicDust(ctx, W, H, time, isPlaying, audio);
          break;

        case 'sad_romantic':
        default:
          updateAndDrawTympanusRain(ctx, rainEngineRef.current, W, H, dt, time, isPlaying, audio);
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
  }, [isPlaying, activeEmotion, getLiveFeatures]);

  const currentThemeInfo = ALL_ROMANTIC_THEMES.find((t) => t.type === activeEmotion) || ALL_ROMANTIC_THEMES[5];

  return (
    <>
      {/* 60FPS WebGL/Canvas Physical Layer - ONLY rendered when playing */}
      <canvas
        ref={canvasRef}
        className={`emotion-canvas ${isPlaying ? 'emotion-canvas-active' : 'emotion-canvas-hidden'}`}
        aria-hidden="true"
      />

      {/* Deep CSS atmospheric gradient */}
      <div
        className={`emotion-overlay emotion-${activeEmotion} ${isPlaying ? 'emotion-active' : 'emotion-paused'} ${isTransitioning ? 'emotion-transitioning' : ''}`}
        aria-hidden="true"
      >
        <div className="emotion-gradient" />
      </div>

      {/* Automatic AI Mood Badge */}
      <div className={`emotion-badge-container ${isPlaying ? 'emotion-badge-visible' : 'emotion-badge-hidden'}`}>
        <div
          className="emotion-badge-pill"
          title={`AI Romantic Mood: ${emotionData?.label || currentThemeInfo.shortLabel}`}
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
  x: number; y: number; r: number; vy: number; vx: number; mass: number;
  state: 'resting' | 'sliding' | 'accelerating';
  wobblePhase: number; wobbleSpeed: number; wobbleAmp: number;
  trail: { x: number; y: number; r: number; alpha: number }[];
  trailTimer: number; stickTimer: number; isUserDrop?: boolean;
}

interface StaticDrop { x: number; y: number; r: number; alpha: number; phase: number; speed: number; }
interface RainStreak { x: number; y: number; l: number; vy: number; vx: number; alpha: number; width: number; }
interface SplashRipple { x: number; y: number; r: number; maxR: number; alpha: number; dr: number; }
interface WipeTrail { x: number; y: number; r: number; alpha: number; }
interface LightningState { active: boolean; timer: number; intensity: number; x: number; }
interface FogLayer { x: number; y: number; w: number; h: number; alpha: number; vx: number; phase: number; }

interface RainEngineState {
  drops: GlassDrop[]; staticDrops: StaticDrop[];
  rainStreaksBg: RainStreak[]; rainStreaksFg: RainStreak[];
  ripples: SplashRipple[]; lightning: LightningState;
  spawnTimer: number; wipeTrails: WipeTrail[]; fogLayers: FogLayer[];
}

interface GlassShard {
  x: number; y: number; vx: number; vy: number; rot: number; vRot: number;
  size: number; alpha: number; points: { x: number; y: number }[];
  glowPhase: number; refractColor: string;
}

interface Lantern {
  x: number; y: number; targetY: number; vx: number; vy: number;
  size: number; alpha: number; flickerPhase: number; swayPhase: number;
  depth: number;
}

interface DandelionSeed {
  x: number; y: number; vx: number; vy: number; size: number;
  rot: number; vRot: number; alpha: number;
}

interface Petal {
  x: number; y: number; z: number; size: number; vx: number; vy: number;
  rotX: number; rotY: number; rotZ: number; vRotX: number; vRotY: number; vRotZ: number;
  alpha: number;
}

interface FilmDust {
  x: number; y: number; vx: number; vy: number; size: number;
  alpha: number; isFirefly: boolean; pulsePhase: number;
}

interface Feather {
  x: number; y: number; vx: number; vy: number; size: number;
  rot: number; vRot: number; alpha: number; swayPhase: number;
  hue: number;
}

interface Ember {
  x: number; y: number; size: number; vx: number; vy: number;
  alpha: number; life: number; maxLife: number;
  hue: number;
}

interface DiyaLantern {
  x: number; y: number; radius: number; vx: number; vy: number;
  alpha: number; pulsePhase: number; orbitRadius: number; orbitPhase: number;
}

interface CosmicStar {
  x: number; y: number; size: number; baseAlpha: number;
  twinklePhase: number; twinkleSpeed: number; depth: number;
}

interface CloudLayer {
  x: number; y: number; radius: number; vx: number; alpha: number;
  breathPhase: number;
}

interface BokehOrb {
  x: number; y: number; r: number; vx: number; vy: number;
  alpha: number; hue: number; pulsePhase: number; pulseSpeed: number;
}

interface ShootingStar {
  x: number; y: number; vx: number; vy: number; life: number;
  maxLife: number; trail: { x: number; y: number; alpha: number }[];
  active: boolean; timer: number;
}

interface EnergyVein {
  points: { x: number; y: number }[];
  alpha: number; life: number; maxLife: number;
  width: number; color: string;
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
    shards: React.MutableRefObject<GlassShard[]>;
    lanterns: React.MutableRefObject<Lantern[]>;
    dandelions: React.MutableRefObject<DandelionSeed[]>;
    petals: React.MutableRefObject<Petal[]>;
    filmDust: React.MutableRefObject<FilmDust[]>;
    feathers: React.MutableRefObject<Feather[]>;
    embers: React.MutableRefObject<Ember[]>;
    diyas: React.MutableRefObject<DiyaLantern[]>;
    stars: React.MutableRefObject<CosmicStar[]>;
    clouds: React.MutableRefObject<CloudLayer[]>;
    bokeh: React.MutableRefObject<BokehOrb[]>;
    shootingStars: React.MutableRefObject<ShootingStar[]>;
    energyVeins: React.MutableRefObject<EnergyVein[]>;
  }
) {
  refs.clouds.current = [];
  const cloudCount = emotion === 'heartbroken_romantic' || emotion === 'dark_romantic' ? 10 : 7;
  for (let i = 0; i < cloudCount; i++) {
    refs.clouds.current.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.75,
      radius: Math.min(W, H) * (0.35 + Math.random() * 0.45),
      vx: (Math.random() - 0.5) * 0.22,
      alpha: 0.14 + Math.random() * 0.16,
      breathPhase: Math.random() * Math.PI * 2,
    });
  }

  if (emotion === 'heartbroken_romantic') {
    refs.shards.current = [];
    for (let i = 0; i < 42; i++) {
      refs.shards.current.push(createGlassShard(W, H, true));
    }
    refs.energyVeins.current = [];
  }

  if (emotion === 'yearning_romantic') {
    refs.lanterns.current = [];
    for (let i = 0; i < 28; i++) {
      refs.lanterns.current.push(createLantern(W, H, true));
    }
  }

  if (emotion === 'soft_romantic' || emotion === 'dark_romantic' || emotion === 'sensual_romantic') {
    refs.petals.current = [];
    const count = emotion === 'soft_romantic' ? 45 : 32;
    for (let i = 0; i < count; i++) {
      refs.petals.current.push(createPetal(W, H, true));
    }
    if (emotion === 'soft_romantic') {
      refs.dandelions.current = [];
      for (let i = 0; i < 30; i++) {
        refs.dandelions.current.push(createDandelion(W, H, true));
      }
    }
  }

  if (emotion === 'nostalgic_romantic') {
    refs.filmDust.current = [];
    for (let i = 0; i < 65; i++) {
      refs.filmDust.current.push(createFilmDust(W, H, true));
    }
  }

  if (emotion === 'hopeful_romantic') {
    refs.feathers.current = [];
    for (let i = 0; i < 32; i++) {
      refs.feathers.current.push(createFeather(W, H, true));
    }
    refs.bokeh.current = [];
    for (let i = 0; i < 18; i++) {
      refs.bokeh.current.push(createBokeh(W, H, true, 40));
    }
  }

  if (emotion === 'sensual_romantic' || emotion === 'dark_romantic') {
    refs.embers.current = [];
    for (let i = 0; i < 55; i++) {
      refs.embers.current.push(createEmber(W, H, true));
    }
  }

  if (emotion === 'happy_romantic') {
    refs.embers.current = [];
    for (let i = 0; i < 60; i++) {
      refs.embers.current.push(createEmber(W, H, true));
    }
    refs.feathers.current = [];
    for (let i = 0; i < 35; i++) {
      refs.feathers.current.push(createFeather(W, H, true));
    }
  }

  if (emotion === 'intimate_romantic') {
    refs.bokeh.current = [];
    for (let i = 0; i < 24; i++) {
      refs.bokeh.current.push(createBokeh(W, H, true, 340));
    }
  }

  if (emotion === 'devotional_romantic') {
    refs.diyas.current = [];
    for (let i = 0; i < 30; i++) {
      refs.diyas.current.push({
        x: Math.random() * W,
        y: Math.random() * H,
        radius: 3.5 + Math.random() * 7,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -(0.4 + Math.random() * 1.1),
        alpha: 0.45 + Math.random() * 0.45,
        pulsePhase: Math.random() * Math.PI * 2,
        orbitRadius: 40 + Math.random() * 120,
        orbitPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  if (emotion === 'dreamy_romantic') {
    refs.stars.current = [];
    for (let i = 0; i < 160; i++) {
      refs.stars.current.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.88,
        size: 0.6 + Math.random() * 2.5,
        baseAlpha: 0.3 + Math.random() * 0.7,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.012 + Math.random() * 0.04,
        depth: 0.3 + Math.random() * 1.0,
      });
    }
    refs.shootingStars.current = [];
    for (let i = 0; i < 3; i++) {
      refs.shootingStars.current.push({
        x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 60,
        trail: [], active: false, timer: 120 + Math.random() * 300,
      });
    }
  }

  if (emotion === 'sad_romantic' || emotion === 'heartbroken_romantic') {
    const engine = refs.rainEngine.current;
    engine.drops = [];
    engine.staticDrops = [];
    engine.rainStreaksBg = [];
    engine.rainStreaksFg = [];
    engine.ripples = [];
    engine.wipeTrails = [];
    engine.lightning = { active: false, timer: 8 + Math.random() * 12, intensity: 0, x: 0 };
    engine.spawnTimer = 0;

    engine.fogLayers = [];
    for (let i = 0; i < 4; i++) {
      engine.fogLayers.push({
        x: Math.random() * W, y: H * (0.5 + Math.random() * 0.4),
        w: W * (0.6 + Math.random() * 0.8), h: H * (0.15 + Math.random() * 0.2),
        alpha: 0.06 + Math.random() * 0.08, vx: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < 250; i++) {
      engine.staticDrops.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.8 + Math.random() * 2.8, alpha: 0.2 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2, speed: 0.001 + Math.random() * 0.002,
      });
    }

    for (let i = 0; i < 36; i++) {
      const isLarge = Math.random() < 0.35;
      engine.drops.push({
        x: Math.random() * W, y: Math.random() * H,
        r: isLarge ? 5 + Math.random() * 6 : 2.5 + Math.random() * 3,
        vy: 0, vx: 0,
        mass: isLarge ? 3 + Math.random() * 3 : 1 + Math.random() * 1.5,
        state: Math.random() < 0.25 ? 'sliding' : 'resting',
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.04 + Math.random() * 0.06,
        wobbleAmp: 0.15 + Math.random() * 0.2,
        trail: [], trailTimer: 0,
        stickTimer: Math.random() * 180,
      });
    }

    for (let i = 0; i < 85; i++) {
      engine.rainStreaksBg.push({
        x: Math.random() * W, y: Math.random() * H,
        l: 18 + Math.random() * 35, vy: 16 + Math.random() * 10,
        vx: -2.8 - Math.random() * 1.5, alpha: 0.15 + Math.random() * 0.25, width: 0.9,
      });
    }

    for (let i = 0; i < 40; i++) {
      engine.rainStreaksFg.push({
        x: Math.random() * W, y: Math.random() * H,
        l: 30 + Math.random() * 50, vy: 24 + Math.random() * 14,
        vx: -3.5 - Math.random() * 1.8, alpha: 0.25 + Math.random() * 0.35, width: 1.5,
      });
    }
  }
}

// Particle Creators
function createGlassShard(W: number, H: number, scatter = false): GlassShard {
  const size = 12 + Math.random() * 28;
  const colors = ['rgba(120,200,255,', 'rgba(180,140,255,', 'rgba(100,255,220,', 'rgba(255,180,200,'];
  return {
    x: Math.random() * W, y: scatter ? Math.random() * H : -40,
    vx: (Math.random() - 0.5) * 1.5, vy: 0.8 + Math.random() * 2.0,
    rot: Math.random() * Math.PI * 2, vRot: (Math.random() - 0.5) * 0.05,
    size, alpha: 0.4 + Math.random() * 0.5,
    points: [
      { x: -size * 0.5, y: -size * 0.6 },
      { x: size * 0.6, y: -size * 0.2 },
      { x: size * 0.3, y: size * 0.7 },
      { x: -size * 0.7, y: size * 0.4 },
    ],
    glowPhase: Math.random() * Math.PI * 2,
    refractColor: colors[Math.floor(Math.random() * colors.length)],
  };
}

function createLantern(W: number, H: number, scatter = false): Lantern {
  return {
    x: Math.random() * W, y: scatter ? Math.random() * H : H + 30,
    targetY: -40,
    vx: (Math.random() - 0.5) * 0.4, vy: -(0.4 + Math.random() * 1.0),
    size: 14 + Math.random() * 22, alpha: 0.5 + Math.random() * 0.45,
    flickerPhase: Math.random() * Math.PI * 2,
    swayPhase: Math.random() * Math.PI * 2,
    depth: 0.4 + Math.random() * 1.0,
  };
}

function createDandelion(W: number, H: number, scatter = false): DandelionSeed {
  return {
    x: scatter ? Math.random() * W : -30, y: Math.random() * H,
    vx: 0.8 + Math.random() * 1.4, vy: (Math.random() - 0.5) * 0.6,
    size: 10 + Math.random() * 14, rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 0.02, alpha: 0.5 + Math.random() * 0.45,
  };
}

function createPetal(W: number, H: number, scatter = false): Petal {
  return {
    x: Math.random() * (W + 120) - 60, y: scatter ? Math.random() * H : -40,
    z: 0.5 + Math.random() * 1.5, size: 11 + Math.random() * 15,
    vx: -0.6 + Math.random() * 1.6, vy: 0.9 + Math.random() * 1.9,
    rotX: Math.random() * Math.PI * 2, rotY: Math.random() * Math.PI * 2,
    rotZ: Math.random() * Math.PI * 2,
    vRotX: (Math.random() - 0.5) * 0.035, vRotY: (Math.random() - 0.5) * 0.035,
    vRotZ: (Math.random() - 0.5) * 0.025, alpha: 0.65 + Math.random() * 0.35,
  };
}

function createFilmDust(W: number, H: number, scatter = false): FilmDust {
  const isFirefly = Math.random() < 0.4;
  return {
    x: Math.random() * W, y: scatter ? Math.random() * H : H + 10,
    vx: (Math.random() - 0.5) * (isFirefly ? 0.8 : 0.4),
    vy: isFirefly ? -(0.4 + Math.random() * 0.8) : (Math.random() - 0.5) * 0.5,
    size: isFirefly ? 3 + Math.random() * 4 : 1.2 + Math.random() * 2,
    alpha: isFirefly ? 0.6 + Math.random() * 0.35 : 0.25 + Math.random() * 0.3,
    isFirefly, pulsePhase: Math.random() * Math.PI * 2,
  };
}

function createFeather(W: number, H: number, scatter = false): Feather {
  return {
    x: Math.random() * W, y: scatter ? Math.random() * H : -40,
    vx: (Math.random() - 0.5) * 0.8, vy: 0.7 + Math.random() * 1.2,
    size: 16 + Math.random() * 22, rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 0.02, alpha: 0.55 + Math.random() * 0.35,
    swayPhase: Math.random() * Math.PI * 2,
    hue: Math.random() * 360,
  };
}

function createEmber(W: number, H: number, scatter = false): Ember {
  return {
    x: Math.random() * W, y: scatter ? Math.random() * H : H + 12,
    size: 2 + Math.random() * 4.5,
    vx: (Math.random() - 0.5) * 1.6, vy: -(1.3 + Math.random() * 2.7),
    alpha: 0.65 + Math.random() * 0.35, life: 0,
    maxLife: 160 + Math.random() * 260,
    hue: Math.random() * 40 - 10,
  };
}

function createBokeh(W: number, H: number, scatter = false, baseHue = 340): BokehOrb {
  return {
    x: Math.random() * W, y: scatter ? Math.random() * H : H * 0.5 + Math.random() * H * 0.5,
    r: 15 + Math.random() * 45, vx: (Math.random() - 0.5) * 0.3,
    vy: -(0.15 + Math.random() * 0.4), alpha: 0.08 + Math.random() * 0.15,
    hue: baseHue + (Math.random() - 0.5) * 30,
    pulsePhase: Math.random() * Math.PI * 2, pulseSpeed: 0.001 + Math.random() * 0.002,
  };
}

// ===================================================================
// ATMOSPHERIC BACKGROUND CLOUDS (with live audio breathing)
// ===================================================================

function drawClouds(
  ctx: CanvasRenderingContext2D, clouds: CloudLayer[], W: number, H: number,
  emotion: EmotionType, time: number, isPlaying: boolean, audio: LiveAudioFeatures
) {
  const pal = getCloudPalette(emotion);
  const speedMult = isPlaying ? (1.0 + audio.rms * 0.6) : 0.4;

  for (const c of clouds) {
    c.x += c.vx * speedMult;
    if (c.x < -c.radius) c.x = W + c.radius;
    if (c.x > W + c.radius) c.x = -c.radius;

    const breath = (Math.sin(time * 0.0008 + c.breathPhase) + audio.subBassEnergy * 0.4) * c.radius * 0.08;
    const r = c.radius + breath;

    const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    grd.addColorStop(0, pal.inner);
    grd.addColorStop(1, pal.outer);

    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function getCloudPalette(emotion: EmotionType) {
  switch (emotion) {
    case 'heartbroken_romantic': return { inner: 'rgba(12, 18, 30, 0.8)', outer: 'rgba(2, 4, 8, 0)' };
    case 'yearning_romantic': return { inner: 'rgba(65, 40, 10, 0.55)', outer: 'rgba(20, 12, 35, 0)' };
    case 'intimate_romantic': return { inner: 'rgba(85, 12, 45, 0.6)', outer: 'rgba(35, 3, 18, 0)' };
    case 'soft_romantic': return { inner: 'rgba(95, 25, 60, 0.5)', outer: 'rgba(40, 5, 25, 0)' };
    case 'happy_romantic': return { inner: 'rgba(95, 55, 10, 0.5)', outer: 'rgba(40, 20, 5, 0)' };
    case 'nostalgic_romantic': return { inner: 'rgba(65, 45, 30, 0.55)', outer: 'rgba(25, 15, 10, 0)' };
    case 'hopeful_romantic': return { inner: 'rgba(15, 65, 105, 0.5)', outer: 'rgba(5, 25, 45, 0)' };
    case 'sensual_romantic':
    case 'dark_romantic': return { inner: 'rgba(110, 8, 24, 0.7)', outer: 'rgba(45, 2, 8, 0)' };
    case 'devotional_romantic': return { inner: 'rgba(95, 45, 10, 0.6)', outer: 'rgba(35, 15, 0, 0)' };
    case 'dreamy_romantic': return { inner: 'rgba(15, 25, 65, 0.65)', outer: 'rgba(5, 10, 30, 0)' };
    case 'sad_romantic': return { inner: 'rgba(12, 22, 45, 0.7)', outer: 'rgba(4, 8, 20, 0)' };
    default: return { inner: 'rgba(18, 28, 52, 0.6)', outer: 'rgba(5, 12, 26, 0)' };
  }
}

// ===================================================================
// 💔 HEARTBROKEN — SHATTERED GLASS, ENERGY VEINS & STORMY VOID
// ===================================================================

function drawHeartbrokenVoid(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const pulse = isPlaying ? Math.sin(time * 0.0015) * 0.1 + 0.25 + audio.subBassEnergy * 0.15 : 0.12;
  const pulse2 = isPlaying ? Math.cos(time * 0.001) * 0.06 + 0.12 + audio.rms * 0.1 : 0.06;

  const grd = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, H * 0.9);
  grd.addColorStop(0, `rgba(10, 25, 45, ${pulse + 0.2})`);
  grd.addColorStop(0.4, `rgba(5, 10, 20, ${pulse})`);
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  const grd2 = ctx.createRadialGradient(
    W * 0.5 + Math.sin(time * 0.0008) * 80, H * 0.5 + Math.cos(time * 0.001) * 60,
    0, W * 0.5, H * 0.5, H * 0.7
  );
  grd2.addColorStop(0, `rgba(0, 100, 200, ${pulse2})`);
  grd2.addColorStop(0.5, `rgba(0, 40, 120, ${pulse2 * 0.5})`);
  grd2.addColorStop(1, 'transparent');
  ctx.fillStyle = grd2;
  ctx.fillRect(0, 0, W, H);
}

function drawEnergyVeins(ctx: CanvasRenderingContext2D, veins: EnergyVein[], W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  if (!isPlaying) return;

  // Spawn energy cracks on beat drops / transients or randomly
  const spawnThreshold = audio.subBassEnergy > 0.65 ? 0.04 : 0.008;
  if (Math.random() < spawnThreshold && veins.length < 5) {
    const startX = Math.random() * W;
    const startY = Math.random() * H * 0.4;
    const pts: { x: number; y: number }[] = [{ x: startX, y: startY }];
    let cx = startX, cy = startY;
    const segments = 8 + Math.floor(Math.random() * 12);
    for (let i = 0; i < segments; i++) {
      cx += (Math.random() - 0.5) * 80;
      cy += 20 + Math.random() * 40;
      pts.push({ x: cx, y: cy });
    }
    veins.push({
      points: pts, alpha: 0.9 + audio.rms * 0.1, life: 0, maxLife: 40 + Math.random() * 30,
      width: 1.5 + Math.random() * 2 + audio.subBassEnergy * 1.5,
      color: Math.random() < 0.5 ? 'rgba(0, 180, 255,' : 'rgba(180, 120, 255,',
    });
  }

  for (let i = veins.length - 1; i >= 0; i--) {
    const v = veins[i];
    v.life++;
    const progress = v.life / v.maxLife;
    const a = v.alpha * (1 - progress);
    if (a <= 0) { veins.splice(i, 1); continue; }

    ctx.save();
    ctx.shadowBlur = 12 + audio.rms * 10;
    ctx.shadowColor = v.color + '0.6)';
    ctx.strokeStyle = v.color + `${a})`;
    ctx.lineWidth = v.width * (1 - progress * 0.5);
    ctx.beginPath();
    ctx.moveTo(v.points[0].x, v.points[0].y);
    for (let j = 1; j < v.points.length; j++) {
      ctx.lineTo(v.points[j].x, v.points[j].y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = `rgba(255, 255, 255, ${a * 0.7})`;
    ctx.lineWidth = v.width * 0.4;
    ctx.beginPath();
    ctx.moveTo(v.points[0].x, v.points[0].y);
    for (let j = 1; j < v.points.length; j++) {
      ctx.lineTo(v.points[j].x, v.points[j].y);
    }
    ctx.stroke();
  }
}

function drawGlassShards(ctx: CanvasRenderingContext2D, shards: GlassShard[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.rms * 0.8) : 0.3;

  for (const s of shards) {
    s.y += s.vy * dt * speed;
    s.x += s.vx * dt * speed;
    s.rot += s.vRot * dt * speed * (1 + audio.subBassEnergy * 0.5);

    if (s.y > H + 50) {
      Object.assign(s, createGlassShard(W, H, false));
    }

    const glowPulse = (Math.sin(time * 0.003 + s.glowPhase) * 0.3 + 0.7) + (audio.midEnergy * 0.3);

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);

    const auraR = s.size * (1.8 + audio.subBassEnergy * 0.4);
    const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, auraR);
    aura.addColorStop(0, `${s.refractColor}${s.alpha * glowPulse * 0.3})`);
    aura.addColorStop(1, 'transparent');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      ctx.lineTo(s.points[i].x, s.points[i].y);
    }
    ctx.closePath();

    const shardGrd = ctx.createLinearGradient(-s.size, -s.size, s.size, s.size);
    shardGrd.addColorStop(0, `rgba(200, 240, 255, ${s.alpha * 0.8 * glowPulse})`);
    shardGrd.addColorStop(0.5, `rgba(100, 180, 240, ${s.alpha * 0.4})`);
    shardGrd.addColorStop(1, `rgba(30, 80, 140, ${s.alpha * 0.65})`);

    ctx.fillStyle = shardGrd;
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${s.alpha * 0.9})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-s.size * 0.15, -s.size * 0.2, s.size * 0.2, s.size * 0.08, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * glowPulse * 0.7})`;
    ctx.fill();

    ctx.restore();
  }
}

// ===================================================================
// 🫶 YEARNING — PARALLAX FOG & FLOATING LANTERNS
// ===================================================================

function drawYearningMist(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const pulse = isPlaying ? Math.sin(time * 0.002) * 0.08 + 0.22 + audio.midEnergy * 0.15 : 0.12;

  const beaconX = W * 0.5 + Math.sin(time * 0.0005) * W * 0.15;
  const beaconY = H * 0.25;
  const beacon = ctx.createRadialGradient(beaconX, beaconY, 0, beaconX, beaconY, H * (0.6 + audio.rms * 0.2));
  beacon.addColorStop(0, `rgba(255, 200, 60, ${pulse + 0.12})`);
  beacon.addColorStop(0.3, `rgba(255, 140, 20, ${pulse * 0.7})`);
  beacon.addColorStop(0.6, `rgba(75, 40, 90, ${pulse * 0.4})`);
  beacon.addColorStop(1, 'transparent');
  ctx.fillStyle = beacon;
  ctx.fillRect(0, 0, W, H);

  if (isPlaying) {
    for (let layer = 0; layer < 3; layer++) {
      const speed = (layer + 1) * (0.15 + audio.subBassEnergy * 0.1);
      const fogAlpha = 0.04 + layer * 0.015;
      const yOff = H * (0.55 + layer * 0.12) + Math.sin(time * 0.001 * speed + layer) * 20;

      ctx.fillStyle = `rgba(180, 140, 80, ${fogAlpha})`;
      ctx.beginPath();
      ctx.moveTo(-20, H);
      for (let x = -20; x <= W + 20; x += 40) {
        const y = yOff + Math.sin(x * 0.003 + time * 0.0004 * speed) * 30 +
          Math.cos(x * 0.005 - time * 0.0003 * speed) * 15;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 20, H);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawFloatingLanterns(ctx: CanvasRenderingContext2D, lanterns: Lantern[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.rms * 0.5) : 0.3;

  for (const l of lanterns) {
    const depthSpeed = l.depth;
    l.y += l.vy * dt * speed * depthSpeed;
    l.x += (l.vx + Math.sin(time * 0.0015 + l.swayPhase) * 0.5 * depthSpeed) * dt * speed;

    if (l.y < l.targetY) {
      Object.assign(l, createLantern(W, H, false));
    }

    const flicker = (Math.sin(time * 0.006 + l.flickerPhase) * 0.15 + 0.85) + (audio.midEnergy * 0.25);
    const r = l.size * flicker * l.depth;
    const a = l.alpha * l.depth;

    const auraSize = r * (2.5 + l.depth * 1.5 + audio.subBassEnergy * 0.5);
    const auraGrd = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, auraSize);
    auraGrd.addColorStop(0, `rgba(255, 210, 100, ${a * 0.75})`);
    auraGrd.addColorStop(0.3, `rgba(255, 140, 30, ${a * 0.4})`);
    auraGrd.addColorStop(0.6, `rgba(200, 80, 10, ${a * 0.12})`);
    auraGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = auraGrd;
    ctx.beginPath();
    ctx.arc(l.x, l.y, auraSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 240, 170, ${a * 0.95})`;
    ctx.beginPath();
    ctx.roundRect(l.x - r * 0.5, l.y - r * 0.7, r, r * 1.4, 3);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${a * flicker})`;
    ctx.beginPath();
    ctx.arc(l.x, l.y + r * 0.1, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===================================================================
// 🥀 DARK ROMANTIC & 🔥 SENSUAL ROMANTIC
// ===================================================================

function drawDarkRedAtmosphere(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const pulse = isPlaying ? Math.sin(time * 0.002) * 0.1 + 0.28 + audio.subBassEnergy * 0.15 : 0.15;

  const moonX = W * 0.7 + Math.sin(time * 0.0003) * 30;
  const moonY = H * 0.18;
  const moonGrd = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, H * (0.35 + audio.rms * 0.15));
  moonGrd.addColorStop(0, `rgba(200, 20, 40, ${pulse + 0.2})`);
  moonGrd.addColorStop(0.3, `rgba(140, 5, 20, ${pulse})`);
  moonGrd.addColorStop(0.7, `rgba(60, 0, 10, ${pulse * 0.4})`);
  moonGrd.addColorStop(1, 'transparent');
  ctx.fillStyle = moonGrd;
  ctx.fillRect(0, 0, W, H);

  if (isPlaying) {
    ctx.save();
    ctx.globalAlpha = 0.06 + audio.subBassEnergy * 0.04;
    ctx.translate(W * 0.5, H * 0.7);
    const angle = time * (0.0003 + audio.rms * 0.0003);
    ctx.rotate(angle);
    const vortexGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, H * 0.6);
    vortexGrd.addColorStop(0, 'rgba(180, 10, 25, 0.6)');
    vortexGrd.addColorStop(0.5, 'rgba(90, 0, 15, 0.3)');
    vortexGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = vortexGrd;
    ctx.beginPath();
    for (let arm = 0; arm < 4; arm++) {
      const armAngle = (arm / 4) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, H * 0.55, armAngle - 0.2, armAngle + 0.2);
    }
    ctx.fill();
    ctx.restore();
  }
}

function drawSensualCrimson(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const pulse = isPlaying ? Math.sin(time * 0.0025) * 0.1 + 0.28 + audio.subBassEnergy * 0.2 : 0.15;

  const centers = [
    { x: W * 0.3, y: H * 0.7, r: 210, g: 20, b: 40 },
    { x: W * 0.7, y: H * 0.6, r: 190, g: 10, b: 60 },
    { x: W * 0.5, y: H * 0.8, r: 220, g: 30, b: 30 },
  ];

  for (const c of centers) {
    const px = c.x + Math.sin(time * 0.001 + c.x * 0.01) * 40;
    const py = c.y + Math.cos(time * 0.0008 + c.y * 0.01) * 30;
    const grd = ctx.createRadialGradient(px, py, 0, px, py, H * (0.55 + audio.rms * 0.2));
    grd.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${pulse * 0.5})`);
    grd.addColorStop(0.5, `rgba(${c.r * 0.5}, ${c.g}, ${c.b * 0.5}, ${pulse * 0.2})`);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }
}

// ===================================================================
// 🌸 SOFT ROMANTIC & ❤️ INTIMATE ROMANTIC
// ===================================================================

function drawSoftRomanticAtmosphere(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const t = time * 0.001;
  const heartBeat = isPlaying
    ? Math.pow(Math.max(0, Math.sin(t * 1.2)), 8) * 0.28 + Math.pow(Math.max(0, Math.sin(t * 1.2 + 0.4)), 12) * 0.12 + 0.1 + (audio.midEnergy * 0.15)
    : 0.08;

  const grd = ctx.createRadialGradient(W * 0.5, H * 0.65, 0, W * 0.5, H * 0.65, H * 0.85);
  grd.addColorStop(0, `rgba(225, 25, 85, ${heartBeat + 0.15})`);
  grd.addColorStop(0.4, `rgba(125, 10, 45, ${heartBeat * 0.85})`);
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

function drawIntimateCandlelight(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const f1 = Math.sin(time * 0.004) * 0.12;
  const f2 = Math.sin(time * 0.011) * 0.06;
  const f3 = Math.sin(time * 0.023) * 0.03;
  const heartBeat = isPlaying ? Math.pow(Math.sin(time * 0.0035), 4) * 0.22 + 0.14 + f1 + f2 + f3 + (audio.midEnergy * 0.2) : 0.08;

  const cx1 = W * 0.35 + Math.sin(time * 0.0006) * 20;
  const cy1 = H * 0.65;
  const cx2 = W * 0.65 + Math.cos(time * 0.0007) * 15;
  const cy2 = H * 0.6;

  for (const [cx, cy] of [[cx1, cy1], [cx2, cy2]]) {
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * (0.55 + audio.rms * 0.15));
    grd.addColorStop(0, `rgba(255, 180, 60, ${heartBeat * 0.7})`);
    grd.addColorStop(0.3, `rgba(235, 80, 45, ${heartBeat * 0.35})`);
    grd.addColorStop(0.6, `rgba(135, 15, 45, ${heartBeat * 0.15})`);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawBokeh(ctx: CanvasRenderingContext2D, orbs: BokehOrb[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.rms * 0.4) : 0.3;

  for (const b of orbs) {
    b.y += b.vy * dt * speed;
    b.x += (b.vx + Math.sin(time * 0.001 + b.pulsePhase) * 0.15) * dt * speed;

    if (b.y < -b.r * 2) {
      Object.assign(b, createBokeh(W, H, false, 340));
    }

    const pulse = Math.sin(time * b.pulseSpeed + b.pulsePhase) * 0.04 + 1 + (audio.midEnergy * 0.2);
    const r = b.r * pulse;
    const a = b.alpha * (1 + audio.rms * 0.3);

    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${b.hue}, 70%, 70%, ${a * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const fillGrd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    fillGrd.addColorStop(0, `hsla(${b.hue}, 80%, 80%, ${a * 0.3})`);
    fillGrd.addColorStop(0.6, `hsla(${b.hue}, 60%, 50%, ${a * 0.08})`);
    fillGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = fillGrd;
    ctx.fill();
  }
}

function drawDandelions(ctx: CanvasRenderingContext2D, seeds: DandelionSeed[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.trebleEnergy * 0.5) : 0.3;

  for (const s of seeds) {
    s.x += s.vx * dt * speed;
    s.y += (s.vy + Math.sin(time * 0.002 + s.x * 0.01) * 0.5) * dt * speed;
    s.rot += s.vRot * dt * speed;

    if (s.x > W + 40 || s.y > H + 40 || s.y < -40) {
      Object.assign(s, createDandelion(W, H, false));
    }

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);

    const glowGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, s.size * 1.5);
    glowGrd.addColorStop(0, `rgba(255, 250, 230, ${s.alpha * 0.2})`);
    glowGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrd;
    ctx.beginPath();
    ctx.arc(0, 0, s.size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 245, 210, ${s.alpha * 0.75})`;
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI - Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s.size, Math.sin(a) * s.size);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 240, ${s.alpha * 0.95})`;
    ctx.fill();

    ctx.restore();
  }
}

function drawRosePetals(ctx: CanvasRenderingContext2D, petals: Petal[], W: number, H: number, dt: number, time: number, theme: 'dark' | 'soft' | 'crimson', isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.rms * 0.6) : 0.3;

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

    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.8, -s * 0.7, s * 1.1, s * 0.2, 0, s);
    ctx.bezierCurveTo(-s * 1.1, s * 0.2, -s * 0.8, -s * 0.7, 0, -s);

    const petalGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
    if (theme === 'dark' || theme === 'crimson') {
      petalGrd.addColorStop(0, `rgba(235, 30, 60, ${p.alpha})`);
      petalGrd.addColorStop(0.55, `rgba(160, 5, 25, ${p.alpha * 0.95})`);
      petalGrd.addColorStop(1, `rgba(50, 0, 10, ${p.alpha * 0.6})`);
    } else {
      petalGrd.addColorStop(0, `rgba(255, 120, 155, ${p.alpha})`);
      petalGrd.addColorStop(0.55, `rgba(225, 45, 85, ${p.alpha * 0.95})`);
      petalGrd.addColorStop(1, `rgba(100, 10, 35, ${p.alpha * 0.6})`);
    }

    ctx.fillStyle = petalGrd;
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * 0.15})`;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.8);
    ctx.quadraticCurveTo(s * 0.1, 0, 0, s * 0.7);
    ctx.stroke();

    ctx.restore();
  }
}

// ===================================================================
// ✨ HAPPY ROMANTIC — SUNBURST, SPARKLES & CONFETTI
// ===================================================================

function drawHappySunburst(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const pulse = isPlaying ? (Math.sin(time * 0.002) + 1) * 0.08 + 0.2 + (audio.rms * 0.15) : 0.15;
  const rotSpeed = isPlaying ? time * (0.0002 + audio.subBassEnergy * 0.0002) : time * 0.00005;

  const sunGrd = ctx.createRadialGradient(W * 0.5, H * 0.2, 0, W * 0.5, H * 0.2, H * 0.95);
  sunGrd.addColorStop(0, `rgba(255, 200, 50, ${pulse + 0.2})`);
  sunGrd.addColorStop(0.3, `rgba(255, 140, 10, ${pulse})`);
  sunGrd.addColorStop(0.6, `rgba(235, 90, 0, ${pulse * 0.4})`);
  sunGrd.addColorStop(1, 'transparent');
  ctx.fillStyle = sunGrd;
  ctx.fillRect(0, 0, W, H);

  if (isPlaying) {
    ctx.save();
    ctx.translate(W * 0.5, H * 0.2);
    ctx.rotate(rotSpeed);
    const rays = 16;
    for (let i = 0; i < rays; i++) {
      const rayAngle = (i / rays) * Math.PI * 2;
      const rayAlpha = 0.03 + Math.sin(time * 0.003 + i) * 0.015 + audio.trebleEnergy * 0.02;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, Math.max(W, H) * 1.2, rayAngle - 0.06, rayAngle + 0.06);
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 230, 120, ${rayAlpha})`;
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawSparkles(ctx: CanvasRenderingContext2D, sparkles: Ember[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.trebleEnergy * 0.8) : 0.4;

  for (const s of sparkles) {
    s.life += dt * speed;
    s.y += s.vy * dt * speed;
    s.x += (s.vx + Math.sin(time * 0.003 + s.y * 0.03)) * dt * speed;

    const progress = s.life / s.maxLife;
    let alpha = s.alpha * (1 + audio.trebleEnergy * 0.4);
    if (progress < 0.2) alpha *= progress / 0.2;
    if (progress > 0.8) alpha *= (1 - progress) / 0.2;

    if (s.life > s.maxLife || s.y < -20) {
      Object.assign(s, createEmber(W, H, false));
    }

    const r = s.size * (1 + audio.trebleEnergy * 0.5);
    const rot = time * 0.003 + s.x;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(rot);

    ctx.strokeStyle = `rgba(255, 230, 100, ${alpha * 0.85})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-r * 2.5, 0); ctx.lineTo(r * 2.5, 0);
    ctx.moveTo(0, -r * 2.5); ctx.lineTo(0, r * 2.5);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 180, ${alpha * 0.4})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-r * 1.5, -r * 1.5); ctx.lineTo(r * 1.5, r * 1.5);
    ctx.moveTo(r * 1.5, -r * 1.5); ctx.lineTo(-r * 1.5, r * 1.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();

    ctx.restore();
  }
}

function drawConfetti(ctx: CanvasRenderingContext2D, confetti: Feather[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.subBassEnergy * 0.6) : 0.3;

  for (const c of confetti) {
    c.y += c.vy * dt * speed;
    c.x += (c.vx + Math.sin(time * 0.003 + c.swayPhase) * 1.2) * dt * speed;
    c.rot += c.vRot * dt * speed * 3;

    if (c.y > H + 40) {
      Object.assign(c, createFeather(W, H, false));
      c.y = -20;
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);

    const s = c.size * 0.3;
    ctx.fillStyle = `hsla(${c.hue}, 85%, 65%, ${c.alpha * 0.8})`;
    ctx.fillRect(-s * 0.5, -s * 0.25, s, s * 0.5);

    ctx.restore();
  }
}

// ===================================================================
// 🔥 EMBERS
// ===================================================================

function drawEmbers(ctx: CanvasRenderingContext2D, embers: Ember[], W: number, H: number, dt: number, time: number, theme: 'dark' | 'warm', isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.subBassEnergy * 0.8) : 0.3;

  for (const e of embers) {
    e.life += dt * speed;
    e.y += e.vy * dt * speed;
    e.x += (e.vx + Math.sin(time * 0.003 + e.y * 0.02) * 0.6) * dt * speed;

    const progress = e.life / e.maxLife;
    let alpha = e.alpha * (1 + audio.rms * 0.4);
    if (progress < 0.15) alpha *= progress / 0.15;
    if (progress > 0.75) alpha *= (1 - progress) / 0.25;

    if (e.life > e.maxLife || e.y < -20) {
      Object.assign(e, createEmber(W, H, false));
    }

    const r = e.size * (1 - progress * 0.3) * (1 + audio.subBassEnergy * 0.4);

    const glowGrd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r * 4);
    if (theme === 'dark') {
      glowGrd.addColorStop(0, `rgba(255, 40, 70, ${alpha * 0.8})`);
      glowGrd.addColorStop(0.4, `rgba(180, 10, 35, ${alpha * 0.3})`);
    } else {
      glowGrd.addColorStop(0, `rgba(255, ${140 + e.hue}, 40, ${alpha * 0.8})`);
      glowGrd.addColorStop(0.4, `rgba(200, ${80 + e.hue}, 10, ${alpha * 0.3})`);
    }
    glowGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrd;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 240, 245, ${alpha})`;
    ctx.fill();
  }
}

// ===================================================================
// 🕊️ HOPEFUL — SUNBEAMS, FEATHERS & LIGHT ORBS
// ===================================================================

function drawHopefulSunbeams(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const angle = isPlaying ? time * 0.0002 : time * 0.00005;
  const pulse = Math.sin(time * 0.001) * 0.015 + 0.05 + (audio.midEnergy * 0.04);

  const dawnGrd = ctx.createLinearGradient(0, 0, 0, H);
  dawnGrd.addColorStop(0, `rgba(255, 200, 80, ${pulse + 0.08})`);
  dawnGrd.addColorStop(0.3, `rgba(100, 180, 255, ${pulse * 0.6})`);
  dawnGrd.addColorStop(1, 'transparent');
  ctx.fillStyle = dawnGrd;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W * 0.5, H * 0.08);
  ctx.rotate(angle);

  const rays = 14;
  for (let i = 0; i < rays; i++) {
    const rayAngle = (i / rays) * Math.PI * 2;
    const rayPulse = Math.sin(time * 0.002 + i * 0.5) * 0.015 + 0.04 + (audio.rms * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, Math.max(W, H), rayAngle - 0.07, rayAngle + 0.07);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 230, 120, ${rayPulse})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawFeathers(ctx: CanvasRenderingContext2D, feathers: Feather[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.rms * 0.4) : 0.3;

  for (const f of feathers) {
    f.y += f.vy * dt * speed;
    f.x += (f.vx + Math.sin(time * 0.002 + f.swayPhase) * 0.8) * dt * speed;
    f.rot += f.vRot * dt * speed;

    if (f.y > H + 40) {
      Object.assign(f, createFeather(W, H, false));
    }

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);

    const s = f.size;

    const glowGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.5);
    glowGrd.addColorStop(0, `rgba(255, 255, 255, ${f.alpha * 0.15})`);
    glowGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrd;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 255, 255, ${f.alpha * 0.95})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(0, s);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -s * 0.8);
    ctx.bezierCurveTo(s * 0.35, -s * 0.4, s * 0.35, s * 0.4, 0, s * 0.9);
    ctx.bezierCurveTo(-s * 0.35, s * 0.4, -s * 0.35, -s * 0.4, 0, -s * 0.8);
    ctx.fillStyle = `rgba(245, 250, 255, ${f.alpha * 0.6})`;
    ctx.fill();

    ctx.restore();
  }
}

function drawLightOrbs(ctx: CanvasRenderingContext2D, orbs: BokehOrb[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.trebleEnergy * 0.6) : 0.3;

  for (const b of orbs) {
    b.y += b.vy * dt * speed * 2;
    b.x += (b.vx + Math.sin(time * 0.0015 + b.pulsePhase) * 0.3) * dt * speed;

    if (b.y < -b.r * 2) {
      Object.assign(b, createBokeh(W, H, false, 40));
    }

    const pulse = Math.sin(time * b.pulseSpeed + b.pulsePhase) * 0.3 + 0.7 + (audio.midEnergy * 0.3);
    const r = b.r * 0.5 * pulse;

    const orbGrd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2);
    orbGrd.addColorStop(0, `rgba(255, 250, 200, ${b.alpha * 0.9})`);
    orbGrd.addColorStop(0.5, `rgba(255, 200, 80, ${b.alpha * 0.3})`);
    orbGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = orbGrd;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===================================================================
// 😢 NOSTALGIC — VHS SEPIA, FILM GATE & FIREFLIES
// ===================================================================

function drawVintageSepia(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const pulse = isPlaying ? Math.sin(time * 0.002) * 0.04 + 0.18 + audio.rms * 0.06 : 0.12;

  const sepiaGrd = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, H * 0.85);
  sepiaGrd.addColorStop(0, `rgba(180, 115, 60, ${pulse + 0.12})`);
  sepiaGrd.addColorStop(0.6, `rgba(90, 50, 25, ${pulse * 0.8})`);
  sepiaGrd.addColorStop(1, 'transparent');
  ctx.fillStyle = sepiaGrd;
  ctx.fillRect(0, 0, W, H);

  if (isPlaying && Math.random() < 0.08) {
    const lineY = Math.random() * H;
    const lineH = 2 + Math.random() * 6;
    ctx.fillStyle = `rgba(255, 235, 180, ${0.03 + Math.random() * 0.04})`;
    ctx.fillRect(0, lineY, W, lineH);
  }

  if (Math.random() < 0.15) {
    const scratchX = Math.random() * W;
    ctx.strokeStyle = `rgba(255, 235, 180, ${0.04 + Math.random() * 0.04})`;
    ctx.lineWidth = 0.5 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.moveTo(scratchX, 0);
    ctx.lineTo(scratchX + (Math.random() - 0.5) * 3, H);
    ctx.stroke();
  }

  if (isPlaying) {
    const gateJitter = Math.sin(time * 0.01) * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.fillRect(0, 0, 8 + gateJitter, H);
    ctx.fillRect(W - 8 - gateJitter, 0, 8 + gateJitter, H);
  }
}

function drawFilmDustAndFireflies(ctx: CanvasRenderingContext2D, dust: FilmDust[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.rms * 0.4) : 0.3;

  for (const d of dust) {
    d.y += d.vy * dt * speed;
    d.x += (d.vx + Math.sin(time * 0.003 + d.y * 0.02) * 0.4) * dt * speed;

    if (d.y < -10 || d.y > H + 20) {
      Object.assign(d, createFilmDust(W, H, false));
    }

    if (d.isFirefly) {
      const pulse = (Math.sin(time * 0.004 + d.pulsePhase) + 1) * 0.4 + 0.6 + (audio.midEnergy * 0.3);
      const r = d.size * pulse;

      const auraGrd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r * 5);
      auraGrd.addColorStop(0, `rgba(255, 220, 80, ${d.alpha * 0.7})`);
      auraGrd.addColorStop(0.3, `rgba(255, 180, 40, ${d.alpha * 0.3})`);
      auraGrd.addColorStop(0.6, `rgba(200, 120, 20, ${d.alpha * 0.08})`);
      auraGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrd;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(d.x, d.y, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 220, ${d.alpha})`;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 225, 175, ${d.alpha * 0.5})`;
      ctx.fill();
    }
  }
}

// ===================================================================
// 🙏 SUFI / DEVOTIONAL — SACRED GEOMETRY, RAYS & DIYA LANTERNS
// ===================================================================

function drawDevotionalRays(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const angle = isPlaying ? time * 0.0003 : time * 0.0001;
  const pulse = Math.sin(time * 0.001) * 0.015 + 0.045 + (audio.midEnergy * 0.04);

  const centerGrd = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, H * (0.5 + audio.rms * 0.2));
  centerGrd.addColorStop(0, `rgba(255, 200, 60, ${pulse + 0.1})`);
  centerGrd.addColorStop(0.5, `rgba(200, 120, 20, ${pulse * 0.5})`);
  centerGrd.addColorStop(1, 'transparent');
  ctx.fillStyle = centerGrd;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W * 0.5, H * 0.15);
  ctx.rotate(angle);
  const rays = 16;
  for (let i = 0; i < rays; i++) {
    const rayAngle = (i / rays) * Math.PI * 2;
    const rayPulse = Math.sin(time * 0.0015 + i * 0.4) * 0.01 + 0.035 + audio.subBassEnergy * 0.02;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, Math.max(W, H), rayAngle - 0.07, rayAngle + 0.07);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 185, 50, ${rayPulse})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawSacredGeometry(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  if (!isPlaying) return;

  ctx.save();
  ctx.translate(W * 0.5, H * 0.5);
  ctx.rotate(time * (0.0002 + audio.rms * 0.0002));

  const rings = 5;
  for (let r = 1; r <= rings; r++) {
    const radius = r * Math.min(W, H) * 0.08 * (1 + audio.subBassEnergy * 0.12);
    const alpha = 0.04 + (rings - r) * 0.008 + audio.midEnergy * 0.03;
    ctx.strokeStyle = `rgba(255, 200, 80, ${alpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    const dotCount = r * 6;
    for (let d = 0; d < dotCount; d++) {
      const dAngle = (d / dotCount) * Math.PI * 2 + time * 0.0003 * (r % 2 === 0 ? 1 : -1);
      const dx = Math.cos(dAngle) * radius;
      const dy = Math.sin(dAngle) * radius;
      ctx.beginPath();
      ctx.arc(dx, dy, 1.2 + audio.trebleEnergy * 1.0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 220, 120, ${alpha * 2})`;
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawDiyaLanterns(ctx: CanvasRenderingContext2D, diyas: DiyaLantern[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.rms * 0.5) : 0.3;

  for (const d of diyas) {
    d.orbitPhase += 0.001 * dt * speed;
    d.y += d.vy * dt * speed;
    d.x += (d.vx + Math.sin(d.orbitPhase) * 0.3) * dt * speed;

    if (d.y < -30) {
      d.y = H + 30;
      d.x = Math.random() * W;
    }

    const pulse = (Math.sin(time * 0.004 + d.pulsePhase) + 1) * 0.3 + 0.7 + (audio.midEnergy * 0.25);
    const flickerHigh = Math.sin(time * 0.015 + d.pulsePhase * 2) * 0.1;
    const r = d.radius * (pulse + flickerHigh);

    const haloGrd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r * 5);
    haloGrd.addColorStop(0, `rgba(255, 210, 90, ${d.alpha * 0.75})`);
    haloGrd.addColorStop(0.3, `rgba(255, 150, 30, ${d.alpha * 0.3})`);
    haloGrd.addColorStop(0.6, `rgba(200, 80, 10, ${d.alpha * 0.08})`);
    haloGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = haloGrd;
    ctx.beginPath();
    ctx.arc(d.x, d.y, r * 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(200, 130, 40, ${d.alpha * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y + r * 0.3, r * 0.8, r * 0.4, 0, 0, Math.PI);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 220, ${d.alpha * pulse})`;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y - r * 0.2, r * 0.25, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===================================================================
// 🌙 DREAMY — MULTI-BAND AURORA, COSMIC STARS, SHOOTING STARS & DUST
// ===================================================================

function drawAurora(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const t = isPlaying ? time * (0.0008 + audio.rms * 0.0006) : time * 0.0002;

  const bands = [
    { yBase: 0.3, color1: 'rgba(25, 185, 140,', color2: 'rgba(0, 120, 90,', amp: 60 + audio.subBassEnergy * 25, freq: 0.004, phase: 0 },
    { yBase: 0.35, color1: 'rgba(125, 75, 255,', color2: 'rgba(60, 30, 150,', amp: 50 + audio.midEnergy * 20, freq: 0.005, phase: 2 },
    { yBase: 0.28, color1: 'rgba(0, 215, 255,', color2: 'rgba(0, 100, 150,', amp: 45 + audio.trebleEnergy * 20, freq: 0.003, phase: 4 },
  ];

  for (const band of bands) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H * band.yBase + band.amp);

    for (let x = 0; x <= W; x += 20) {
      const y = H * band.yBase +
        Math.sin(x * band.freq + t + band.phase) * band.amp +
        Math.cos(x * 0.002 - t * 0.7 + band.phase) * band.amp * 0.6;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(W, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();

    const auroraGrd = ctx.createLinearGradient(0, 0, W * 0.5, H * 0.5);
    auroraGrd.addColorStop(0, `${band.color1}${0.18 + audio.rms * 0.1})`);
    auroraGrd.addColorStop(0.5, `${band.color2}${0.12 + audio.midEnergy * 0.08})`);
    auroraGrd.addColorStop(1, `${band.color1}0.06)`);

    ctx.fillStyle = auroraGrd;
    ctx.fill();
    ctx.restore();
  }
}

function drawCosmicStars(ctx: CanvasRenderingContext2D, stars: CosmicStar[], W: number, H: number, time: number, audio: LiveAudioFeatures) {
  for (const s of stars) {
    const twinkle = Math.sin(time * s.twinkleSpeed + s.twinklePhase);
    const alpha = s.baseAlpha * (0.5 + twinkle * 0.5) * s.depth * (1 + audio.trebleEnergy * 0.3);

    if (s.size > 1.5) {
      const glowGrd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 4);
      glowGrd.addColorStop(0, `rgba(200, 220, 255, ${alpha * 0.3})`);
      glowGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrd;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * s.depth, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240, 248, 255, ${alpha})`;
    ctx.fill();

    if (s.size > 1.8 && twinkle > 0.5) {
      const flareA = alpha * 0.6;
      ctx.strokeStyle = `rgba(255, 255, 255, ${flareA})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(s.x - s.size * 3, s.y); ctx.lineTo(s.x + s.size * 3, s.y);
      ctx.moveTo(s.x, s.y - s.size * 3); ctx.lineTo(s.x, s.y + s.size * 3);
      ctx.stroke();
    }
  }
}

function drawShootingStars(ctx: CanvasRenderingContext2D, stars: ShootingStar[], W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  if (!isPlaying) return;

  for (const s of stars) {
    if (!s.active) {
      s.timer -= dt;
      // Trigger on chorus transitions or timer expiry
      if (s.timer <= 0 || (audio.section === 'chorus' && Math.random() < 0.015)) {
        s.active = true;
        s.x = Math.random() * W * 0.8;
        s.y = Math.random() * H * 0.3;
        s.vx = 8 + Math.random() * 12;
        s.vy = 3 + Math.random() * 5;
        s.life = 0;
        s.maxLife = 50 + Math.random() * 40;
        s.trail = [];
      }
      continue;
    }

    s.life += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    s.trail.push({ x: s.x, y: s.y, alpha: 1 });
    if (s.trail.length > 20) s.trail.shift();

    const progress = s.life / s.maxLife;
    const headAlpha = progress < 0.1 ? progress / 0.1 : progress > 0.7 ? (1 - progress) / 0.3 : 1;

    for (let i = 0; i < s.trail.length; i++) {
      const t = s.trail[i];
      t.alpha = Math.max(0, t.alpha - 0.04 * dt);
      if (t.alpha <= 0) continue;
      const ta = t.alpha * headAlpha * 0.8;
      const tr = 2 * (i / s.trail.length);
      ctx.beginPath();
      ctx.arc(t.x, t.y, tr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${ta})`;
      ctx.fill();
    }

    if (headAlpha > 0) {
      const headGrd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6);
      headGrd.addColorStop(0, `rgba(255, 255, 255, ${headAlpha})`);
      headGrd.addColorStop(0.5, `rgba(150, 200, 255, ${headAlpha * 0.5})`);
      headGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = headGrd;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (s.life >= s.maxLife) {
      s.active = false;
      s.timer = 180 + Math.random() * 400;
    }
  }
}

function drawCosmicDust(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  if (!isPlaying) return;

  const dustCenters = [
    { x: W * 0.2, y: H * 0.4, r: 150, g: 80, b: 255 },
    { x: W * 0.75, y: H * 0.55, r: 0, g: 200, b: 200 },
    { x: W * 0.5, y: H * 0.25, r: 100, g: 255, b: 180 },
  ];

  for (const c of dustCenters) {
    const px = c.x + Math.sin(time * 0.0003 + c.x * 0.01) * 30;
    const py = c.y + Math.cos(time * 0.0004 + c.y * 0.01) * 20;
    const dustRadius = Math.min(W, H) * (0.25 + audio.rms * 0.08);
    const grd = ctx.createRadialGradient(px, py, 0, px, py, dustRadius);
    grd.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${0.04 + audio.midEnergy * 0.03})`);
    grd.addColorStop(0.6, `rgba(${c.r}, ${c.g}, ${c.b}, 0.015)`);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(px, py, dustRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===================================================================
// 🌧️ SAD ROMANTIC — TYMPANUS PHYSICAL RAIN ON GLASS
// ===================================================================

function updateAndDrawTympanusRain(ctx: CanvasRenderingContext2D, engine: RainEngineState, W: number, H: number, dt: number, time: number, isPlaying: boolean, audio: LiveAudioFeatures) {
  const speed = isPlaying ? (1.0 + audio.rms * 0.5) : 0.4;

  engine.lightning.timer -= (dt * speed) / 60;
  if (engine.lightning.timer <= 0 || (audio.subBassEnergy > 0.8 && Math.random() < 0.01)) {
    engine.lightning.active = true;
    engine.lightning.intensity = 0.65 + Math.random() * 0.3;
    engine.lightning.timer = 12 + Math.random() * 20;
    engine.lightning.x = Math.random() * W;
  }

  if (engine.lightning.active) {
    engine.lightning.intensity -= 0.04 * dt;
    if (engine.lightning.intensity <= 0) {
      engine.lightning.active = false;
      engine.lightning.intensity = 0;
    } else {
      ctx.fillStyle = `rgba(220, 240, 255, ${engine.lightning.intensity * 0.25})`;
      ctx.fillRect(0, 0, W, H);

      if (engine.lightning.intensity > 0.3) {
        ctx.save();
        ctx.strokeStyle = `rgba(200, 230, 255, ${engine.lightning.intensity * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(200, 230, 255, 0.5)';
        ctx.beginPath();
        let lx = engine.lightning.x;
        let ly = 0;
        ctx.moveTo(lx, ly);
        const segs = 8 + Math.floor(Math.random() * 6);
        for (let i = 0; i < segs; i++) {
          lx += (Math.random() - 0.5) * 60;
          ly += H / segs;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  for (const fog of engine.fogLayers) {
    fog.x += fog.vx * speed;
    fog.phase += 0.001;
    const fogAlpha = fog.alpha * (0.7 + Math.sin(fog.phase) * 0.3) * (1 + audio.subBassEnergy * 0.3);
    if (fog.x > W + fog.w) fog.x = -fog.w;
    if (fog.x < -fog.w) fog.x = W + fog.w;

    const fogGrd = ctx.createRadialGradient(
      fog.x + fog.w * 0.5, fog.y, 0,
      fog.x + fog.w * 0.5, fog.y, fog.w * 0.5
    );
    fogGrd.addColorStop(0, `rgba(120, 160, 200, ${fogAlpha})`);
    fogGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = fogGrd;
    ctx.beginPath();
    ctx.ellipse(fog.x + fog.w * 0.5, fog.y, fog.w * 0.5, fog.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = `rgba(160, 205, 255, ${0.22 + audio.rms * 0.1})`;
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

  ctx.strokeStyle = `rgba(210, 235, 255, ${0.38 + audio.rms * 0.15})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const s of engine.rainStreaksFg) {
    s.y += s.vy * dt * speed;
    s.x += s.vx * dt * speed;
    if (s.y > H + s.l) {
      s.y = -s.l;
      s.x = Math.random() * (W + 200);

      if (Math.random() < (0.25 + audio.subBassEnergy * 0.2)) {
        engine.ripples.push({
          x: s.x, y: Math.random() * H,
          r: 2, maxR: 12 + Math.random() * 18 + audio.subBassEnergy * 10,
          alpha: 0.55, dr: 0.7 + Math.random() * 0.8,
        });
      }
    }
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + s.vx * 1.5, s.y + s.l);
  }
  ctx.stroke();

  for (let i = engine.ripples.length - 1; i >= 0; i--) {
    const rip = engine.ripples[i];
    rip.r += rip.dr * dt * speed;
    rip.alpha -= 0.015 * dt * speed;
    if (rip.alpha <= 0 || rip.r >= rip.maxR) {
      engine.ripples.splice(i, 1); continue;
    }
    ctx.strokeStyle = `rgba(200, 230, 255, ${rip.alpha * 0.45})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = engine.wipeTrails.length - 1; i >= 0; i--) {
    const wt = engine.wipeTrails[i];
    wt.alpha -= 0.004 * dt;
    if (wt.alpha <= 0) {
      engine.wipeTrails.splice(i, 1); continue;
    }
    const wipeGrd = ctx.createRadialGradient(wt.x, wt.y, 0, wt.x, wt.y, wt.r);
    wipeGrd.addColorStop(0, `rgba(180, 220, 255, ${wt.alpha * 0.15})`);
    wipeGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = wipeGrd;
    ctx.beginPath();
    ctx.arc(wt.x, wt.y, wt.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const sd of engine.staticDrops) {
    sd.phase += sd.speed * dt;
    const pulse = (Math.sin(sd.phase) * 0.12 + 0.88) * (1 + audio.subBassEnergy * 0.08);
    const r = sd.r * pulse;

    ctx.beginPath();
    ctx.arc(sd.x + r * 0.25, sd.y + r * 0.3, r * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sd.x, sd.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(190, 225, 255, ${sd.alpha * 0.55})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sd.x - r * 0.35, sd.y - r * 0.35, Math.max(0.5, r * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${sd.alpha * 0.85})`;
    ctx.fill();
  }

  engine.spawnTimer += dt * speed;
  if (engine.spawnTimer > 40 && engine.drops.length < 50) {
    engine.spawnTimer = 0;
    const isLarge = Math.random() < 0.4;
    engine.drops.push({
      x: Math.random() * W, y: -20,
      r: isLarge ? 5 + Math.random() * 6 : 2.5 + Math.random() * 3,
      vy: 1.5 + Math.random() * 3, vx: (Math.random() - 0.5) * 0.4,
      mass: isLarge ? 3 + Math.random() * 3 : 1 + Math.random() * 1.5,
      state: 'sliding', wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.06, wobbleAmp: 0.25,
      trail: [], trailTimer: 0, stickTimer: 0,
    });
  }

  for (let i = engine.drops.length - 1; i >= 0; i--) {
    const d = engine.drops[i];
    d.wobblePhase += d.wobbleSpeed * dt;
    const wobble = Math.sin(d.wobblePhase) * (d.wobbleAmp + audio.subBassEnergy * 0.2);

    if (isPlaying) {
      if (d.state === 'resting') {
        d.stickTimer -= dt;
        if (d.stickTimer <= 0 || d.mass > 3.5 || audio.subBassEnergy > 0.7) {
          d.state = 'sliding';
          d.vy = 0.8 + d.mass * 0.6 + Math.random() * 2;
          d.stickTimer = 40 + Math.random() * 120;
        }
      } else {
        d.vy += (0.05 + d.mass * 0.02) * dt;
        d.y += d.vy * dt * speed;
        d.x += (Math.sin(d.y * 0.015) * 0.8 + d.vx) * dt * speed;

        d.trailTimer -= dt;
        if (d.trailTimer <= 0) {
          d.trail.push({
            x: d.x + (Math.random() - 0.5) * 2, y: d.y,
            r: d.r * (0.22 + Math.random() * 0.28), alpha: 0.75,
          });
          d.trailTimer = 3 + Math.random() * 5;
          if (d.trail.length > 32) d.trail.shift();
        }

        d.stickTimer -= dt;
        if (d.stickTimer <= 0 && Math.random() < 0.15 && !d.isUserDrop) {
          d.state = 'resting';
          d.vy = 0;
          d.stickTimer = 30 + Math.random() * 90;
        }
      }
    }

    if (d.state === 'sliding' && isPlaying) {
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

      for (let j = 0; j < engine.drops.length; j++) {
        if (i === j) continue;
        const other = engine.drops[j];
        const dist = Math.hypot(other.x - d.x, other.y - d.y);
        if (dist < (d.r + other.r) * 0.9) {
          d.r = Math.sqrt(d.r * d.r + other.r * other.r);
          d.mass += other.mass;
          d.vy += 0.3;
          d.wobbleAmp = 0.45;
          engine.ripples.push({
            x: d.x, y: d.y, r: 3,
            maxR: d.r * 2.5, alpha: 0.6, dr: 0.6,
          });
          engine.drops.splice(j, 1);
          break;
        }
      }
    }

    if (d.y > H + d.r + 30) {
      engine.drops.splice(i, 1); continue;
    }

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

    const curR = d.r * (1 + wobble * 0.15);

    ctx.beginPath();
    ctx.arc(d.x + curR * 0.25, d.y + curR * 0.3, curR * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

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
      ctx.scale(1 - wobble * 0.1, 1 + Math.min(d.vy * 0.08, 0.4));
    }
    ctx.beginPath();
    ctx.arc(0, 0, curR, 0, Math.PI * 2);
    ctx.fillStyle = dropGrd;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-curR * 0.35, -curR * 0.35, curR * 0.45, curR * 0.25, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(curR * 0.35, curR * 0.35, curR * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220, 245, 255, 0.55)';
    ctx.fill();

    ctx.restore();
  }
}

// ===================================================================
// 🎬 CINEMATIC VIGNETTE
// ===================================================================

function drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number, emotion: EmotionType) {
  const vignetteGrd = ctx.createRadialGradient(
    W * 0.5, H * 0.5, Math.min(W, H) * 0.35,
    W * 0.5, H * 0.5, Math.max(W, H) * 0.75
  );
  vignetteGrd.addColorStop(0, 'transparent');
  const intensity =
    emotion === 'heartbroken_romantic' || emotion === 'dark_romantic' ? 0.7
    : emotion === 'sensual_romantic' || emotion === 'sad_romantic' ? 0.6
    : emotion === 'intimate_romantic' ? 0.55
    : 0.4;
  vignetteGrd.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);

  ctx.fillStyle = vignetteGrd;
  ctx.fillRect(0, 0, W, H);
}
