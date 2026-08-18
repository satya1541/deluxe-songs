import { NextResponse } from 'next/server';

export type EmotionType =
  | 'sad_romantic'         // 🌧️ Rainy & Melancholic (Tympanus style rain on glass)
  | 'dark_romantic'        // 🥀 Dark Crimson & Passionate (Embers & Dark Red Mist)
  | 'soft_romantic'        // 🌸 Soft & Sweet Love (3D Floating Rose Petals)
  | 'happy_romantic'       // ✨ Joyful & Peppy Love (Golden Sunburst & Sparkles)
  | 'devotional_romantic'  // 🙏 Sufi & Divine Sacred Love (Divine Rays & Floating Diyas)
  | 'dreamy_romantic';     // 🌙 Dreamy & Serene Lofi (Twinkling Cosmos & Aurora)

export interface EmotionResult {
  emotion: EmotionType;
  color: string;
  secondary: string;
  label: string;
  icon: string;
  themeDescription: string;
}

const EMOTION_MAP: Record<EmotionType, Omit<EmotionResult, 'emotion'>> = {
  sad_romantic: {
    color: '#1a237e',
    secondary: '#42a5f5',
    label: 'Sad & Melancholic',
    icon: '🌧️',
    themeDescription: 'Rain on glass with misty condensation & stormy clouds',
  },
  dark_romantic: {
    color: '#8b0000',
    secondary: '#ff1744',
    label: 'Dark & Passionate',
    icon: '🥀',
    themeDescription: 'Cloudy dark red mist with burning ember sparks & dark passion',
  },
  soft_romantic: {
    color: '#ad1457',
    secondary: '#f48fb1',
    label: 'Soft & Sweet Romance',
    icon: '🌸',
    themeDescription: 'Floating 3D rose petals with warm acoustic heartbeat glow',
  },
  happy_romantic: {
    color: '#f9a825',
    secondary: '#ff6f00',
    label: 'Joyful & Peppy Love',
    icon: '✨',
    themeDescription: 'Golden sunburst rays with celebratory shimmer & glitter',
  },
  devotional_romantic: {
    color: '#e65100',
    secondary: '#ffab00',
    label: 'Sufi & Divine Love',
    icon: '🙏',
    themeDescription: 'Rotating sacred golden light rays & floating diya lanterns',
  },
  dreamy_romantic: {
    color: '#1b5e20',
    secondary: '#7c4dff',
    label: 'Dreamy & Serene Night',
    icon: '🌙',
    themeDescription: 'Cosmic starry sky with twinkling stars & shifting aurora borealis',
  },
};

// In-memory cache so we don't re-call Gemini repeatedly for identical songs
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
    if (emotionCache.has(cacheKey)) {
      return NextResponse.json(emotionCache.get(cacheKey));
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallback = guessFallbackEmotion(songName, songArtist);
      return NextResponse.json(fallback);
    }

    const prompt = `You are an expert music emotion classifier specializing in Bollywood and Indian romantic songs.
Most Indian songs are love/romantic songs, but each has a distinct emotional subtype.

Analyze this track:
Song Title: "${songName}"
Artist/Album: "${songArtist || 'Unknown'}"

Classify its specific romantic/emotional subtype into EXACTLY ONE of these 6 categories:
1. sad_romantic - Heartbreak, sadness, crying, rain, longing, separation, grief, dard, alvida, emotional pain (e.g. "Ae Dil Hai Mushkil", "Tum Hi Ho", "Galliyan Returns", "Sawan Aaya Hai", "Wajah Tum Ho", "Tera Mera Rishta", "Tere Bina", "Tumse Bhi Zyada")
2. dark_romantic - Passionate, obsessive, dramatic, dark crimson, haunting, seductive, intense love, deewaniyat (e.g. "Deewana Kar Raha Hai", "Deewaniyat", "Mera Hua", "Tum Mere Ho", "Terre Pyaar Mein", "Tu Jo Hain", "Tum Ho Mera Pyar")
3. soft_romantic - Sweet, tender, gentle acoustic love, innocent affection, soft melody, soulful warmth (e.g. "Dil Diyan Gallan", "Sajni", "Bol Do Na Zara", "Itni Si Baat Hain", "Maheroo Maheroo", "Dil Mein Ho Tum", "Ijazat", "Naina Re")
4. happy_romantic - Upbeat, dance, peppy, joyful celebration, flirtatious, cheerful energy (e.g. "Akhiyaan Gulaab", "Chaleya", "Dil Cheez Tujhe Dedi", "Mere Rashke Qamar", "Pardesiya", "Nazar Na Lag Jaaye", "Jeena Haraam")
5. devotional_romantic - Sufi, divine sacred love, prayer, ishq sufiyana, rab, dua, spiritual adoration (e.g. "Rab Ka Shukrana", "Tu Hi Rab Tu Hi Dua", "Is Qadar", "Tujhe Sochta Hoon")
6. dreamy_romantic - Dreamy, stargazing, midnight journey, peaceful, acoustic chill, relaxing, serene (e.g. "Besabriyaan", "Lo Safar", "Sitaare", "Tum Hardafa Ho", "Jeena Marna")

Reply with ONLY the single category name (one of: sad_romantic, dark_romantic, soft_romantic, happy_romantic, devotional_romantic, dreamy_romantic).`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 800,
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn('Gemini API returned error status:', res.status);
      const fallback = guessFallbackEmotion(songName, songArtist);
      return NextResponse.json(fallback);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    // Extract non-thought part or fallback to last text part
    const contentPart = parts.find((p: { thought?: boolean; text?: string }) => !p.thought && p.text) || parts[parts.length - 1];
    const rawText = contentPart?.text || '';

    const cleaned = rawText.toLowerCase().replace(/[^a-z_]/g, ' ').trim();

    const validEmotions: EmotionType[] = [
      'sad_romantic',
      'dark_romantic',
      'soft_romantic',
      'happy_romantic',
      'devotional_romantic',
      'dreamy_romantic',
    ];

    let detected: EmotionType | undefined = validEmotions.find(e => cleaned.split(/\s+/).includes(e));
    if (!detected) {
      detected = validEmotions.find(e => cleaned.includes(e));
    }
    if (!detected) {
      detected = guessFallbackEmotionType(songName, songArtist);
    }

    const result: EmotionResult = {
      emotion: detected,
      ...EMOTION_MAP[detected],
    };

    emotionCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Emotion API error:', error);
    const fallback = guessFallbackEmotion(songName, songArtist);
    return NextResponse.json(fallback);
  }
}

// ===== Smart Music Knowledge Fallback for Offline / Missing Key =====

function guessFallbackEmotionType(name: string, artist?: string): EmotionType {
  const text = `${name} ${artist ?? ''}`.toLowerCase();

  // 1. Sad / Rainy Romantic
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
    return 'sad_romantic';
  }

  // 2. Dark Passionate / Obsessive Romantic
  if (
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
    return 'dark_romantic';
  }

  // 3. Sufi / Devotional Romantic
  if (
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
    return 'devotional_romantic';
  }

  // 4. Happy / Upbeat Romantic
  if (
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
    return 'happy_romantic';
  }

  // 5. Dreamy / Lofi Serene Romantic
  if (
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
    return 'dreamy_romantic';
  }

  // 6. Soft & Sweet Romantic (Default for gentle love tracks)
  return 'soft_romantic';
}

function guessFallbackEmotion(name: string, artist?: string): EmotionResult {
  const emotion = guessFallbackEmotionType(name, artist);
  return { emotion, ...EMOTION_MAP[emotion] };
}
