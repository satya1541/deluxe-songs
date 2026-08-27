import { NextRequest, NextResponse } from 'next/server';

function cleanHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function cleanImage(imageUrl: string): string {
  if (!imageUrl) return '';
  return imageUrl.trim();
}

export interface SearchSuggestionItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'song' | 'artist' | 'query' | 'album';
  image?: string;
  queryValue: string;
}

const DEFAULT_POPULAR_SUGGESTIONS: SearchSuggestionItem[] = [
  {
    id: 'pop-1',
    title: 'Arijit Singh',
    subtitle: 'Popular Artist • Romantic Anthems',
    type: 'artist',
    image: 'https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_150x150.jpg',
    queryValue: 'Arijit Singh',
  },
  {
    id: 'pop-2',
    title: 'Kesariya',
    subtitle: 'Song • Brahmāstra • Pritam, Arijit Singh',
    type: 'song',
    image: 'https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-150x150.jpg',
    queryValue: 'Kesariya',
  },
  {
    id: 'pop-3',
    title: 'Diljit Dosanjh',
    subtitle: 'Popular Artist • Global Punjabi Pop',
    type: 'artist',
    image: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_150x150.jpg',
    queryValue: 'Diljit Dosanjh',
  },
  {
    id: 'pop-4',
    title: 'Softly',
    subtitle: 'Song • Karan Aujla, Ikky',
    type: 'song',
    image: 'https://c.saavncdn.com/538/Making-Memories-English-2023-20230818075015-150x150.jpg',
    queryValue: 'Softly Karan Aujla',
  },
  {
    id: 'pop-5',
    title: 'Shreya Ghoshal',
    subtitle: 'Popular Artist • Melodious Vocals',
    type: 'artist',
    image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_007_20241101074144_150x150.jpg',
    queryValue: 'Shreya Ghoshal',
  },
  {
    id: 'pop-6',
    title: 'Anirudh Ravichander',
    subtitle: 'Popular Artist • High-Energy Hits',
    type: 'artist',
    image: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_003_20260121134149_150x150.jpg',
    queryValue: 'Anirudh Ravichander',
  },
  {
    id: 'pop-7',
    title: 'Channa Mereya',
    subtitle: 'Song • Ae Dil Hai Mushkil • Pritam, Arijit',
    type: 'song',
    image: 'https://c.saavncdn.com/257/Ae-Dil-Hai-Mushkil-Hindi-2016-150x150.jpg',
    queryValue: 'Channa Mereya',
  },
  {
    id: 'pop-8',
    title: 'Atif Aslam',
    subtitle: 'Popular Artist • Soulful Ballads',
    type: 'artist',
    image: 'https://c.saavncdn.com/716/Atif-Aslam-Mashup-2-Hindi-2026-20260424160758-150x150.jpg',
    queryValue: 'Atif Aslam',
  },
];

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  const trimmed = query.trim();

  // If query is empty or 1 char, return default trending search suggestions
  if (!trimmed || trimmed.length < 2) {
    return NextResponse.json({
      success: true,
      query: trimmed,
      isDefault: true,
      suggestions: DEFAULT_POPULAR_SUGGESTIONS,
    });
  }

  try {
    const [saavnRes, ytRes] = await Promise.allSettled([
      fetch(
        `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&api_version=4&ctx=web6dot0&query=${encodeURIComponent(
          trimmed
        )}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      ),
      fetch(
        `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(
          trimmed
        )}`
      ),
    ]);

    const suggestions: SearchSuggestionItem[] = [];
    const seenTitles = new Set<string>();

    // 1. Parse YouTube / Global suggestions first for smart auto-correction and trending hits
    if (ytRes.status === 'fulfilled' && ytRes.value.ok) {
      try {
        const ytData = await ytRes.value.json();
        const queries = Array.isArray(ytData[1]) ? ytData[1] : [];
        for (const q of queries.slice(0, 4)) {
          const title = cleanHtml(String(q));
          if (!title || seenTitles.has(title.toLowerCase())) continue;
          seenTitles.add(title.toLowerCase());
          suggestions.push({
            id: `yt-${Math.random().toString(36).substring(7)}`,
            title,
            subtitle: 'YouTube Music & Global Match',
            type: 'query',
            queryValue: title,
          });
        }
      } catch {}
    }

    // 2. Parse JioSaavn autocomplete if available
    if (saavnRes.status === 'fulfilled' && saavnRes.value.ok) {
      try {
        const data = await saavnRes.value.json();

        // Top Direct Queries
        if (Array.isArray(data.topquery?.data)) {
          for (const item of data.topquery.data) {
            const title = cleanHtml(item.title);
            if (!title || seenTitles.has(title.toLowerCase())) continue;
            seenTitles.add(title.toLowerCase());

            suggestions.push({
              id: `top-${item.id || Math.random()}`,
              title,
              subtitle: item.type ? `${item.type.toUpperCase()} • Best Match` : 'Search Suggestion',
              type: item.type === 'artist' ? 'artist' : item.type === 'song' ? 'song' : 'query',
              image: cleanImage(item.image),
              queryValue: title,
            });
          }
        }

        // Matching Songs
        if (Array.isArray(data.songs?.data)) {
          for (const item of data.songs.data) {
            const title = cleanHtml(item.title);
            if (!title || seenTitles.has(title.toLowerCase())) continue;
            seenTitles.add(title.toLowerCase());

            const subtitle = cleanHtml(
              item.description || item.subtitle || item.more_info?.primary_artists || 'Song'
            );

            suggestions.push({
              id: `song-${item.id || Math.random()}`,
              title,
              subtitle,
              type: 'song',
              image: cleanImage(item.image),
              queryValue: title,
            });
          }
        }

        // Matching Artists
        if (Array.isArray(data.artists?.data)) {
          for (const item of data.artists.data) {
            const title = cleanHtml(item.name || item.title);
            if (!title || seenTitles.has(title.toLowerCase())) continue;
            seenTitles.add(title.toLowerCase());

            suggestions.push({
              id: `art-${item.id || Math.random()}`,
              title,
              subtitle: cleanHtml(item.description || 'Artist'),
              type: 'artist',
              image: cleanImage(item.image),
              queryValue: title,
            });
          }
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      query: trimmed,
      suggestions: suggestions.slice(0, 10),
    });
  } catch (err) {
    console.error('Autocomplete suggestions error:', err);
    return NextResponse.json({
      success: false,
      query: trimmed,
      suggestions: [],
    });
  }
}
