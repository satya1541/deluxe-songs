import { NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, BUCKET_NAME } from '@/lib/s3';

export type EmotionType =
  | 'sad_romantic'           // 🌧️ General melancholy, sadness, separation & sorrowful love
  | 'heartbroken_romantic'     // 💔 Devastating breakup, love lost & emotional damage
  | 'yearning_romantic'        // 🫶 Strong longing, viraha, missing someone & distance
  | 'dark_romantic'            // 🥀 Obsessive, haunting, dramatic & psychologically dark passion
  | 'sensual_romantic'         // 🔥 Physical attraction, chemistry, seduction & tension
  | 'soft_romantic'            // 🌸 Gentle, innocent, tender & comforting sweet love
  | 'intimate_romantic'        // ❤️ Deep emotional closeness, vulnerability & quiet whispers
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
  | 'lonely_romantic';

export interface AcousticIntent {
  warmth: number;        // 0.0 - 1.0 (Low-mid chest body & fullness at 230Hz)
  space: number;         // 0.0 - 1.0 (Reverb depth, decay & spatial staging)
  intensity: number;     // 0.0 - 1.0 (Dynamic punch & compression drive)
  brightness: number;    // 0.0 - 1.0 (Airy highs & presence at 14kHz)
  vocalPresence: number; // 0.0 - 1.0 (Forward vocal clarity & intimacy at 4kHz)
  subBassDepth: number;  // 0.0 - 1.0 (Low-end cinematic weight at 60Hz)
}

export interface EmotionResult {
  emotion: EmotionType;
  color: string;
  secondary: string;
  label: string;
  icon: string;
  themeDescription: string;
  intent: AcousticIntent;
}

const DEFAULT_INTENTS: Record<string, AcousticIntent> = {
  sad_romantic: {
    warmth: 0.75,
    space: 0.80,
    intensity: 0.35,
    brightness: 0.30,
    vocalPresence: 0.85,
    subBassDepth: 0.70,
  },
  heartbroken_romantic: {
    warmth: 0.60,
    space: 0.85,
    intensity: 0.55,
    brightness: 0.45,
    vocalPresence: 0.90,
    subBassDepth: 0.85,
  },
  heartbroken: {
    warmth: 0.60,
    space: 0.85,
    intensity: 0.55,
    brightness: 0.45,
    vocalPresence: 0.90,
    subBassDepth: 0.85,
  },
  yearning_romantic: {
    warmth: 0.70,
    space: 0.80,
    intensity: 0.40,
    brightness: 0.50,
    vocalPresence: 0.95,
    subBassDepth: 0.55,
  },
  dark_romantic: {
    warmth: 0.80,
    space: 0.60,
    intensity: 0.80,
    brightness: 0.40,
    vocalPresence: 0.75,
    subBassDepth: 0.95,
  },
  sensual_romantic: {
    warmth: 0.90,
    space: 0.55,
    intensity: 0.75,
    brightness: 0.50,
    vocalPresence: 0.85,
    subBassDepth: 0.90,
  },
  soft_romantic: {
    warmth: 0.65,
    space: 0.45,
    intensity: 0.25,
    brightness: 0.60,
    vocalPresence: 0.70,
    subBassDepth: 0.35,
  },
  content_romantic: {
    warmth: 0.65,
    space: 0.45,
    intensity: 0.25,
    brightness: 0.60,
    vocalPresence: 0.70,
    subBassDepth: 0.35,
  },
  intimate_romantic: {
    warmth: 0.85,
    space: 0.50,
    intensity: 0.30,
    brightness: 0.40,
    vocalPresence: 0.95,
    subBassDepth: 0.50,
  },
  happy_romantic: {
    warmth: 0.50,
    space: 0.40,
    intensity: 0.70,
    brightness: 0.85,
    vocalPresence: 0.75,
    subBassDepth: 0.75,
  },
  adoring_romantic: {
    warmth: 0.50,
    space: 0.40,
    intensity: 0.70,
    brightness: 0.85,
    vocalPresence: 0.75,
    subBassDepth: 0.75,
  },
  hopeful_romantic: {
    warmth: 0.60,
    space: 0.70,
    intensity: 0.50,
    brightness: 0.75,
    vocalPresence: 0.80,
    subBassDepth: 0.50,
  },
  nostalgic_romantic: {
    warmth: 0.85,
    space: 0.65,
    intensity: 0.45,
    brightness: 0.35,
    vocalPresence: 0.80,
    subBassDepth: 0.60,
  },
  bittersweet_romantic: {
    warmth: 0.85,
    space: 0.65,
    intensity: 0.45,
    brightness: 0.35,
    vocalPresence: 0.80,
    subBassDepth: 0.60,
  },
  devotional_romantic: {
    warmth: 0.75,
    space: 0.90,
    intensity: 0.60,
    brightness: 0.65,
    vocalPresence: 0.90,
    subBassDepth: 0.70,
  },
  dreamy_romantic: {
    warmth: 0.70,
    space: 0.85,
    intensity: 0.30,
    brightness: 0.70,
    vocalPresence: 0.65,
    subBassDepth: 0.65,
  },
  lonely_romantic: {
    warmth: 0.75,
    space: 0.80,
    intensity: 0.35,
    brightness: 0.30,
    vocalPresence: 0.85,
    subBassDepth: 0.70,
  },
};

const EMOTION_MAP: Record<string, Omit<EmotionResult, 'emotion' | 'intent'>> = {
  sad_romantic: {
    color: '#050c1a',
    secondary: '#64b5f6',
    label: 'Sad & Melancholic',
    icon: '🌧️',
    themeDescription: 'Rain on glass window with fluid droplet sliding physics and misty condensation',
  },
  heartbroken_romantic: {
    color: '#0d1117',
    secondary: '#00e5ff',
    label: 'Heartbroken & Devastated',
    icon: '💔',
    themeDescription: 'Shattered crystal shards in a dark stormy void with lightning cracks',
  },
  heartbroken: {
    color: '#0d1117',
    secondary: '#00e5ff',
    label: 'Heartbroken & Devastated',
    icon: '💔',
    themeDescription: 'Shattered crystal shards in a dark stormy void with lightning cracks',
  },
  yearning_romantic: {
    color: '#ffb300',
    secondary: '#303f9f',
    label: 'Deep Yearning (Viraha)',
    icon: '🫶',
    themeDescription: 'Swirling horizon mist with glowing floating paper lanterns drifting away',
  },
  dark_romantic: {
    color: '#880e4f',
    secondary: '#ff1744',
    label: 'Dark & Obsessive Passion',
    icon: '🥀',
    themeDescription: 'Cloudy dark crimson mist with rising ember sparks and haunting intensity',
  },
  sensual_romantic: {
    color: '#b71c1c',
    secondary: '#ff3d00',
    label: 'Sensual Passion & Fire',
    icon: '🔥',
    themeDescription: 'Rolling velvet crimson mist with rising ember sparks and burning intensity',
  },
  soft_romantic: {
    color: '#ec407a',
    secondary: '#f48fb1',
    label: 'Soft & Gentle Love',
    icon: '🌸',
    themeDescription: '3D floating rose petals with gentle warmth and acoustic serenity',
  },
  content_romantic: {
    color: '#ff7043',
    secondary: '#ffe082',
    label: 'Peaceful Bliss (Sukoon)',
    icon: '😌',
    themeDescription: 'Golden hour sunset warmth with drifting dandelion fluff in lazy breezes',
  },
  intimate_romantic: {
    color: '#ad1457',
    secondary: '#f06292',
    label: 'Intimate & Tender Love',
    icon: '❤️',
    themeDescription: 'Warm candlelight ambiance with acoustic heartbeat pulse and gentle halos',
  },
  happy_romantic: {
    color: '#f57f17',
    secondary: '#fff176',
    label: 'Joyful & Playful Love',
    icon: '✨',
    themeDescription: 'Radiant golden sunburst rays with celebratory star sparkles and glitter bursts',
  },
  adoring_romantic: {
    color: '#ec407a',
    secondary: '#fff59d',
    label: 'Adoring & Sweet Love',
    icon: '🥰',
    themeDescription: '3D floating rose petals with playful celebratory glitter and sparkle bursts',
  },
  hopeful_romantic: {
    color: '#0288d1',
    secondary: '#81d4fa',
    label: 'Hopeful & Uplifting',
    icon: '🕊️',
    themeDescription: 'Rising celestial morning sunbeams with floating white feathers and light orbs',
  },
  nostalgic_romantic: {
    color: '#6d4c41',
    secondary: '#ffca28',
    label: 'Nostalgic 90s Memories',
    icon: '😢',
    themeDescription: 'Vintage 35mm film grain, sepia scratches, and wandering glowing fireflies',
  },
  devotional_romantic: {
    color: '#e65100',
    secondary: '#ffb74d',
    label: 'Sufi & Sacred Love',
    icon: '🙏',
    themeDescription: 'Rotating celestial golden rays, sacred glowing halos & floating diya lanterns',
  },
  dreamy_romantic: {
    color: '#1a237e',
    secondary: '#80deea',
    label: 'Dreamy Aurora & Stars',
    icon: '🌙',
    themeDescription: 'Northern lights aurora borealis, twinkling cosmic constellations & stardust',
  },
  bittersweet_romantic: {
    color: '#4a148c',
    secondary: '#ff6f00',
    label: 'Bittersweet Memories',
    icon: '🌅',
    themeDescription: 'Dual-tone twilight sky with falling amber autumn leaves and tender mist',
  },
  lonely_romantic: {
    color: '#050c1a',
    secondary: '#64b5f6',
    label: 'Lonely Rain on Glass',
    icon: '🌧️',
    themeDescription: 'Rain on glass window with fluid droplet sliding physics and condensation',
  },
};

// In-memory cache to prevent redundant Gemini API calls
const emotionCache = new Map<string, EmotionResult>();

export async function POST(request: Request) {
  let songName = 'unknown';
  let songArtist = '';

  try {
    const body = await request.json().catch(() => ({}));
    songName = (body.name || '').trim();
    songArtist = (body.artist || '').trim();

    if (!songName) {
      return NextResponse.json({ error: 'Song name is required' }, { status: 400 });
    }

    const cacheKey = `${songName.toLowerCase()}::${songArtist.toLowerCase()}`;
    const sanitizedFileName = cacheKey.replace(/[^a-z0-9]/gi, '_');
    const s3Key = `Music/Emotions/${sanitizedFileName}.json`;

    if (emotionCache.has(cacheKey)) {
      return NextResponse.json(emotionCache.get(cacheKey));
    }

    // Try reading from S3 cache
    try {
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });
      const s3Response = await s3Client.send(getCommand);
      if (s3Response.Body) {
        const jsonStr = await s3Response.Body.transformToString();
        const cachedResult: EmotionResult = JSON.parse(jsonStr);
        emotionCache.set(cacheKey, cachedResult);
        return NextResponse.json(cachedResult);
      }
    } catch (e: any) {
      // Ignore if not found (NoSuchKey)
      if (e.name !== 'NoSuchKey') {
        console.warn('S3 Emotion Cache read error:', e.message);
      }
    }

    let detected: EmotionType;
    let validatedIntent: AcousticIntent;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Use fallback if no API key
      const fallback = guessFallbackEmotion(songName, songArtist);
      detected = fallback.emotion;
      validatedIntent = fallback.intent;
    } else {
      // Adaptive 3-Tier Neuro-Acoustic Classifier Prompt with normalized intent vectors [0.0 - 1.0]
      const prompt = `You are an expert Indian musicologist and audio mastering engineer specializing in Bollywood, Hindi, Punjabi, Bengali, Odia, Sambalpuri, Sufi, and Indian romantic tracks.

Analyze the following song using ONLY the available metadata:
- Song title: "${songName}"
- Artist(s): "${songArtist || 'Unknown'}"
- Your learned knowledge about the song's musical, vocal, and emotional production identity.

IMPORTANT:
You do NOT have access to the raw audio file.
Do not invent lyrics.
Do NOT output arbitrary EQ decibels or raw frequencies.

Your goal is two-fold:
1. Identify the song's DOMINANT romantic mood from the 12 categories:
   - "sad_romantic", "heartbroken_romantic", "yearning_romantic", "dark_romantic", "sensual_romantic", "soft_romantic", "intimate_romantic", "happy_romantic", "hopeful_romantic", "nostalgic_romantic", "devotional_romantic", "dreamy_romantic"

2. Output a 6-Dimensional Normalized Acoustic Intent Vector (each float strictly between 0.0 and 1.0):
   - "warmth": 0.0 (thin/cold) to 1.0 (rich chest body & low-mid fullness)
   - "space": 0.0 (dry/intimate studio) to 1.0 (vast cathedral/horizon reverb & stereo field)
   - "intensity": 0.0 (delicate acoustic) to 1.0 (dramatic punch & heavy energy)
   - "brightness": 0.0 (dark vintage sepia) to 1.0 (airy crisp high-end brilliance)
   - "vocalPresence": 0.0 (recessed behind music) to 1.0 (forward intimate vocal clarity)
   - "subBassDepth": 0.0 (acoustic light bass) to 1.0 (deep cinematic sub-bass rumble)

Return ONLY valid JSON without markdown formatting in this exact format:
{
  "emotion": "sad_romantic",
  "intent": {
    "warmth": 0.75,
    "space": 0.80,
    "intensity": 0.35,
    "brightness": 0.30,
    "vocalPresence": 0.85,
    "subBassDepth": 0.70
  }
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 300,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!res.ok) {
        console.warn('Gemini API returned error status:', res.status);
        const fallback = guessFallbackEmotion(songName, songArtist);
        detected = fallback.emotion;
        validatedIntent = fallback.intent;
      } else {
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const contentPart = parts.find((p: { thought?: boolean; text?: string }) => !p.thought && p.text) || parts[parts.length - 1];
        const rawText = contentPart?.text || '{}';

        let parsedEmotion: string = '';
        let parsedIntent: Partial<AcousticIntent> = {};

        try {
          const parsed = JSON.parse(rawText);
          parsedEmotion = (parsed.emotion || '').trim().toLowerCase();
          if (parsed.intent && typeof parsed.intent === 'object') {
            parsedIntent = parsed.intent;
          }
        } catch {
          const match = rawText.match(/"emotion"\s*:\s*"([^"]+)"/);
          if (match) parsedEmotion = match[1].toLowerCase();
        }

        const validEmotions: EmotionType[] = [
          'sad_romantic',
          'heartbroken_romantic',
          'yearning_romantic',
          'dark_romantic',
          'sensual_romantic',
          'soft_romantic',
          'intimate_romantic',
          'happy_romantic',
          'hopeful_romantic',
          'nostalgic_romantic',
          'devotional_romantic',
          'dreamy_romantic',
        ];

        detected = validEmotions.find(e => e === parsedEmotion) as EmotionType;
        
        // Check aliases if not direct match
        if (!detected) {
          if (parsedEmotion === 'heartbroken') detected = 'heartbroken_romantic';
          else if (parsedEmotion === 'content_romantic') detected = 'soft_romantic';
          else if (parsedEmotion === 'adoring_romantic') detected = 'happy_romantic';
          else if (parsedEmotion === 'bittersweet_romantic') detected = 'nostalgic_romantic';
          else if (parsedEmotion === 'lonely_romantic') detected = 'sad_romantic';
        }

        if (!detected) {
          detected = guessFallbackEmotionType(songName, songArtist);
        }

        const defaultIntent = DEFAULT_INTENTS[detected] || DEFAULT_INTENTS.soft_romantic;
        validatedIntent = {
          warmth: clampFloat(parsedIntent.warmth, defaultIntent.warmth),
          space: clampFloat(parsedIntent.space, defaultIntent.space),
          intensity: clampFloat(parsedIntent.intensity, defaultIntent.intensity),
          brightness: clampFloat(parsedIntent.brightness, defaultIntent.brightness),
          vocalPresence: clampFloat(parsedIntent.vocalPresence, defaultIntent.vocalPresence),
          subBassDepth: clampFloat(parsedIntent.subBassDepth, defaultIntent.subBassDepth),
        };
      }
    }

    const themeData = EMOTION_MAP[detected] || EMOTION_MAP.soft_romantic;
    const result: EmotionResult = {
      emotion: detected,
      ...themeData,
      intent: validatedIntent,
    };

    // Save to S3 cache (await it so Vercel/Node doesn't terminate early)
    try {
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: JSON.stringify(result, null, 2),
        ContentType: 'application/json',
      });
      await s3Client.send(putCommand);
    } catch (e) {
      console.error('Failed to save emotion to S3:', e);
    }

    emotionCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Emotion API error:', error);
    const fallback = guessFallbackEmotion(songName, songArtist);
    return NextResponse.json(fallback);
  }
}

function clampFloat(val: any, fallback: number): number {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return Math.max(0.0, Math.min(1.0, Math.round(val * 100) / 100));
}

// ===== Smart Indian Music Emotion Fallback Heuristic Engine =====

function guessFallbackEmotionType(name: string, artist?: string): EmotionType {
  const text = `${name} ${artist ?? ''}`.toLowerCase();

  // 1. Heartbroken & Severe Breakup Devastation
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
    return 'heartbroken_romantic';
  }

  // 2. Dark & Obsessive Passion
  if (
    text.includes('deewana kar') ||
    text.includes('deewaniyat') ||
    text.includes('mera hua') ||
    text.includes('tum mere ho') ||
    text.includes('terre pyaar mein') ||
    text.includes('tu jo hain') ||
    text.includes('hate story') ||
    text.includes('raaz') ||
    text.includes('fitoor') ||
    text.includes('obsess')
  ) {
    return 'dark_romantic';
  }

  // 3. Sensual Romance & Seduction
  if (
    text.includes('zara zara') ||
    text.includes('ang laga de') ||
    text.includes('jism') ||
    text.includes('chemistry') ||
    text.includes('labon ko') ||
    text.includes('bheege hoth') ||
    text.includes('sensual') ||
    text.includes('garmi')
  ) {
    return 'sensual_romantic';
  }

  // 4. Yearning, Longing & Viraha
  if (
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
    return 'yearning_romantic';
  }

  // 5. Devotional & Sufi Sacred Love
  if (
    text.includes('kun faya') ||
    text.includes('sajda') ||
    text.includes('khuda jane') ||
    text.includes('allah') ||
    text.includes('rabba') ||
    text.includes('arziyan') ||
    text.includes('maula') ||
    text.includes('sufi') ||
    text.includes('qawwali') ||
    text.includes('shukr')
  ) {
    return 'devotional_romantic';
  }

  // 6. Hopeful & Uplifting Love
  if (
    text.includes('rab ka shukrana') ||
    text.includes('tu hi rab') ||
    text.includes('is qadar') ||
    text.includes('mitwa') ||
    text.includes('tum se') ||
    text.includes('hope') ||
    text.includes('sitaare')
  ) {
    return 'hopeful_romantic';
  }

  // 7. Happy, Flirtatious & Playful
  if (
    text.includes('chaleya') ||
    text.includes('akhiyaan gulaab') ||
    text.includes('dil cheez') ||
    text.includes('nazar na lag') ||
    text.includes('pardesiya') ||
    text.includes('mere rashke qamar') ||
    text.includes('jeena haraam') ||
    text.includes('matargashti') ||
    text.includes('uff') ||
    text.includes('dance') ||
    text.includes('party') ||
    text.includes('sambalpuri') ||
    text.includes('rangabati')
  ) {
    return 'happy_romantic';
  }

  // 8. Nostalgic 90s Retro Love
  if (
    text.includes('main agar saamne') ||
    text.includes('pehla nasha') ||
    text.includes('baatein ankahee') ||
    text.includes('tum mile') ||
    text.includes('kuch kuch hota') ||
    text.includes('kumar sanu') ||
    text.includes('udit narayan') ||
    text.includes('alka yagnik') ||
    text.includes('90s') ||
    text.includes('retro') ||
    text.includes('yaad')
  ) {
    return 'nostalgic_romantic';
  }

  // 9. Intimate Whispers & Close Romance
  if (
    text.includes('bol do na zara') ||
    text.includes('itni si baat') ||
    text.includes('ijazat') ||
    text.includes('dil mein ho tum') ||
    text.includes('naina re') ||
    text.includes('raabta') ||
    text.includes('hasi ban gaye')
  ) {
    return 'intimate_romantic';
  }

  // 10. Dreamy & Lofi Nightscape
  if (
    text.includes('neend') ||
    text.includes('chaand') ||
    text.includes('aurora') ||
    text.includes('taare') ||
    text.includes('khwaab') ||
    text.includes('sapne') ||
    text.includes('lofi') ||
    text.includes('night')
  ) {
    return 'dreamy_romantic';
  }

  // 11. Sad Romantic & Lonely Rain
  if (
    text.includes('tumse bhi zyada') ||
    text.includes('jeene bhi de') ||
    text.includes('tera mera rishta') ||
    text.includes('sawan') ||
    text.includes('baarish') ||
    text.includes('rain') ||
    text.includes('tanha') ||
    text.includes('alone') ||
    text.includes('kho gaya')
  ) {
    return 'sad_romantic';
  }

  // 12. Soft Romantic Default
  return 'soft_romantic';
}

function guessFallbackEmotion(name: string, artist?: string): EmotionResult {
  const emotion = guessFallbackEmotionType(name, artist);
  const theme = EMOTION_MAP[emotion] || EMOTION_MAP.soft_romantic;
  const intent = DEFAULT_INTENTS[emotion] || DEFAULT_INTENTS.soft_romantic;
  return {
    emotion,
    ...theme,
    intent,
  };
}
