import { NextRequest, NextResponse } from 'next/server';
import { parseSearchQuery, detectSearchIntent } from '@/lib/search-parser';
import { stringSimilarity } from '@/lib/entity-resolution';
import { searchSaavnArtists, fetchRealArtistImage } from '@/lib/saavn-stream';

export const dynamic = 'force-dynamic';

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

function cleanImage(imageUrl?: string): string {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  if (imageUrl.includes('artist-default') || imageUrl.includes('default_artist') || imageUrl.includes('default-film')) {
    return '';
  }
  return imageUrl
    .replace(/50x50\.jpg/gi, '500x500.jpg')
    .replace(/150x150\.jpg/gi, '500x500.jpg')
    .trim();
}

export interface SearchSuggestionItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'song' | 'artist' | 'query' | 'album';
  image?: string;
  queryValue: string;
  score?: number; // Used internally for ranking
}

export interface GroupedSuggestions {
  artists: SearchSuggestionItem[];
  songs: SearchSuggestionItem[];
  albums: SearchSuggestionItem[];
  queries: SearchSuggestionItem[];
}

// Rank suggestion items based on intent and query similarity
function rankSuggestions(
  items: SearchSuggestionItem[],
  query: string,
  intentPrimary: string,
  targetType: string
): SearchSuggestionItem[] {
  const queryLower = query.toLowerCase().trim();
  
  const scoredItems = items.map(item => {
    let score = 0;
    const titleLower = item.title.toLowerCase().trim();
    
    // 1. Exact match
    if (titleLower === queryLower) score += 250;
    // 2. Prefix match
    else if (titleLower.startsWith(queryLower)) score += 120;
    // 3. Token match
    else if (titleLower.includes(queryLower)) score += 50;
    // 4. Fuzzy match
    else {
      const sim = stringSimilarity(query, item.title);
      if (sim > 0.7) score += sim * 40;
    }

    // Heavy boost for clean solo artist names (not multi-person semicolon producer strings)
    if (targetType === 'artist') {
      if (!item.title.includes(';') && !item.title.includes('&') && !item.title.includes(',')) {
        score += 80;
      } else {
        score -= 60; // Penalize messy multi-producer strings
      }
      if (item.image && !item.image.includes('photo-1511671782779-c97d3d27a1d4')) {
        score += 30;
      }
    }
    
    // 5. Intent compatibility
    if (intentPrimary === targetType.toUpperCase()) {
      score += 50; // Boost entity types that match detected intent
    }

    return { ...item, score };
  });

  scoredItems.sort((a, b) => (b.score || 0) - (a.score || 0));
  return scoredItems;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  const trimmed = query.trim();

  // If query is empty or 1 char, return empty grouped suggestions (no default suggestions)
  if (!trimmed || trimmed.length < 2) {
    return NextResponse.json({
      success: true,
      query: trimmed,
      isDefault: false,
      groupedSuggestions: {
        artists: [],
        songs: [],
        albums: [],
        queries: [],
      },
    });
  }

  const parsedQuery = parseSearchQuery(trimmed);
  const intent = detectSearchIntent(parsedQuery);
  const effectiveQuery = parsedQuery.baseQuery;

  try {
    const [saavnRes, ytRes, directArtistsRes] = await Promise.allSettled([
      fetch(
        `https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&api_version=4&ctx=web6dot0&query=${encodeURIComponent(
          effectiveQuery
        )}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      ),
      fetch(
        `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(
          trimmed // For youtube use full query for context
        )}`
      ),
      searchSaavnArtists(effectiveQuery, 4),
    ]);

    const allArtists: SearchSuggestionItem[] = [];
    const allAlbums: SearchSuggestionItem[] = [];
    const allSongs: SearchSuggestionItem[] = [];
    const allQueries: SearchSuggestionItem[] = [];
    
    const seenArtistNames = new Set<string>();
    const seenTitles = new Set<string>();

    // 1. First add Direct Verified Artists from searchSaavnArtists (provides genuine solo artist)
    if (directArtistsRes.status === 'fulfilled' && Array.isArray(directArtistsRes.value)) {
      for (const artist of directArtistsRes.value) {
        const title = cleanHtml(artist.name);
        const lower = title.toLowerCase();
        if (!title || seenArtistNames.has(lower)) continue;
        seenArtistNames.add(lower);
        seenTitles.add(lower);

        allArtists.push({
          id: `art-${artist.id}`,
          title,
          subtitle: cleanHtml(artist.role || 'Verified Artist'),
          type: 'artist',
          image: artist.cover,
          queryValue: title,
        });
      }
    }

    // 2. Parse YouTube / Global suggestions first for smart auto-correction and trending hits
    if (ytRes.status === 'fulfilled' && ytRes.value.ok) {
      try {
        const ytData = await ytRes.value.json();
        const queries = Array.isArray(ytData[1]) ? ytData[1] : [];
        for (const q of queries.slice(0, 5)) {
          const title = cleanHtml(String(q));
          if (!title || seenTitles.has(title.toLowerCase())) continue;
          seenTitles.add(title.toLowerCase());
          allQueries.push({
            id: `yt-${Math.random().toString(36).substring(7)}`,
            title,
            subtitle: 'Opus & Global Match',
            type: 'query',
            queryValue: title,
          });
        }
      } catch {}
    }

    // 3. Parse JioSaavn autocomplete if available
    if (saavnRes.status === 'fulfilled' && saavnRes.value.ok) {
      try {
        const data = await saavnRes.value.json();

        // Matching Artists from Autocomplete
        if (Array.isArray(data.artists?.data)) {
          for (const item of data.artists.data) {
            const title = cleanHtml(item.name || item.title);
            const lower = title.toLowerCase();
            if (!title || seenArtistNames.has(lower)) continue;
            seenArtistNames.add(lower);
            seenTitles.add(lower);

            const rawImg = cleanImage(item.image);
            const resolvedImg = rawImg || (await fetchRealArtistImage(title));

            allArtists.push({
              id: `art-${item.id || Math.random()}`,
              title,
              subtitle: cleanHtml(item.description || 'Artist'),
              type: 'artist',
              image: resolvedImg,
              queryValue: title,
            });
          }
        }

        // Matching Albums
        if (Array.isArray(data.albums?.data)) {
          for (const item of data.albums.data) {
            const title = cleanHtml(item.title);
            if (!title || seenTitles.has(title.toLowerCase())) continue;
            seenTitles.add(title.toLowerCase());

            allAlbums.push({
              id: `alb-${item.id || Math.random()}`,
              title,
              subtitle: cleanHtml(item.description || item.music || 'Album'),
              type: 'album',
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

            allSongs.push({
              id: `song-${item.id || Math.random()}`,
              title,
              subtitle,
              type: 'song',
              image: cleanImage(item.image),
              queryValue: title,
            });
          }
        }
      } catch {}
    }

    // 4. Rank and Slice limits
    const rankedArtists = rankSuggestions(allArtists, effectiveQuery, intent.primary, 'artist').slice(0, 2);
    const rankedAlbums = rankSuggestions(allAlbums, effectiveQuery, intent.primary, 'album').slice(0, 2);
    const rankedSongs = rankSuggestions(allSongs, effectiveQuery, intent.primary, 'song').slice(0, 4);
    const rankedQueries = rankSuggestions(allQueries, effectiveQuery, intent.primary, 'query').slice(0, 3);

    const groupedSuggestions: GroupedSuggestions = {
      artists: rankedArtists,
      albums: rankedAlbums,
      songs: rankedSongs,
      queries: rankedQueries
    };

    return NextResponse.json({
      success: true,
      query: trimmed,
      intent, // Return intent metadata to client
      groupedSuggestions,
    });
  } catch (err) {
    console.error('Autocomplete suggestions error:', err);
    return NextResponse.json({
      success: false,
      query: trimmed,
      groupedSuggestions: { artists: [], songs: [], albums: [], queries: [] },
    });
  }
}
