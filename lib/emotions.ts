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
}

export const ALL_ROMANTIC_THEMES: {
  type: EmotionType;
  label: string;
  shortLabel: string;
  icon: string;
  desc: string;
  primaryColor: string;
  secondaryColor: string;
}[] = [
  {
    type: 'sad_romantic',
    label: 'Sad & Melancholic (Rain)',
    shortLabel: 'Sad Rain',
    icon: '🌧️',
    desc: 'Melancholic rain, sorrowful love, separation & quiet raindrops',
    primaryColor: '#1a237e',
    secondaryColor: '#42a5f5',
  },
  {
    type: 'heartbroken_romantic',
    label: 'Heartbroken (Devastating Loss)',
    shortLabel: 'Heartbreak',
    icon: '💔',
    desc: 'Devastating breakup, shattered emotions, weeping sub-bass & grief',
    primaryColor: '#2b0914',
    secondaryColor: '#e53935',
  },
  {
    type: 'yearning_romantic',
    label: 'Yearning (Viraha & Distance)',
    shortLabel: 'Viraha',
    icon: '🫶',
    desc: 'Intense longing, distance, horizons & yearning for beloved',
    primaryColor: '#3e2723',
    secondaryColor: '#ffb74d',
  },
  {
    type: 'dark_romantic',
    label: 'Dark & Obsessive Passion',
    shortLabel: 'Dark Obsession',
    icon: '🥀',
    desc: 'Haunting tension, crimson obsessions & dramatic string crescendo',
    primaryColor: '#180a22',
    secondaryColor: '#ba68c8',
  },
  {
    type: 'sensual_romantic',
    label: 'Sensual & Seductive Romance',
    shortLabel: 'Sensual Fire',
    icon: '🔥',
    desc: 'Warm electric chemistry, intimate rhythm & deep physical allure',
    primaryColor: '#311008',
    secondaryColor: '#ff7043',
  },
  {
    type: 'soft_romantic',
    label: 'Soft & Tender Romance',
    shortLabel: 'Soft Velvet',
    icon: '🌸',
    desc: 'Sweet gentle acoustics, whispering breeze & comforting love',
    primaryColor: '#26121f',
    secondaryColor: '#f48fb1',
  },
  {
    type: 'intimate_romantic',
    label: 'Intimate Whispers',
    shortLabel: 'Intimate Romance',
    icon: '❤️',
    desc: 'Heart-to-heart whispered closeness & candlelit warmth',
    primaryColor: '#2d0a14',
    secondaryColor: '#ef5350',
  },
  {
    type: 'happy_romantic',
    label: 'Joyful & Playful Love',
    shortLabel: 'Joyful Love',
    icon: '✨',
    desc: 'Flirtatious energy, sunlit smiles, upbeat rhythm & euphoria',
    primaryColor: '#1e2806',
    secondaryColor: '#ffca28',
  },
  {
    type: 'hopeful_romantic',
    label: 'Hopeful & Uplifting Love',
    shortLabel: 'Hopeful Reunion',
    icon: '🕊️',
    desc: 'Dawn glow, golden horizon, optimism & unbreakable faith',
    primaryColor: '#072421',
    secondaryColor: '#4db6ac',
  },
  {
    type: 'nostalgic_romantic',
    label: 'Nostalgic 90s Vintage Romance',
    shortLabel: 'Retro Memories',
    icon: '📼',
    desc: 'Evergreen golden memories, vintage cassette tape warmth & timeless melodies',
    primaryColor: '#2c1e10',
    secondaryColor: '#ffb74d',
  },
  {
    type: 'devotional_romantic',
    label: 'Devotional & Sufi Sacred Love',
    shortLabel: 'Sufi Sanctuary',
    icon: '🙏',
    desc: 'Sacred ishq-e-haqiqi, celestial domes & transcendent prayer',
    primaryColor: '#0a2216',
    secondaryColor: '#81c784',
  },
  {
    type: 'dreamy_romantic',
    label: 'Dreamy Lofi Aurora',
    shortLabel: 'Aurora Float',
    icon: '🌙',
    desc: 'Northern lights aurora, floating starlight & ethereal dreamscape',
    primaryColor: '#0d1b2a',
    secondaryColor: '#80deea',
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
    text.includes('bikhra') ||
    text.includes('breakup') ||
    text.includes('broken')
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
    text.includes('fitoor') ||
    text.includes('obsessed')
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
    text.includes('safar') ||
    text.includes('miss you')
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
    text.includes('qawwali') ||
    text.includes('radhe') ||
    text.includes('krishna')
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
    text.includes('rangabati') ||
    text.includes('happy')
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
    text.includes('night') ||
    text.includes('dream')
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
    color: themeInfo.primaryColor,
    secondary: themeInfo.secondaryColor,
    label: themeInfo.shortLabel || themeInfo.label.split('(')[0].trim(),
    icon: themeInfo.icon,
    themeDescription: themeInfo.desc,
  };
}
