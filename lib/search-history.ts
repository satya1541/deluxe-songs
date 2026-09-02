export interface RecentSearchItem {
  query: string;
  timestamp: number;
  entityType?: string;
}

const STORAGE_KEY = 'deluxe-songs-recent-searches';
const MAX_HISTORY = 12;

export function getRecentSearches(): RecentSearchItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to parse recent searches', err);
  }
  return [];
}

export function saveRecentSearch(query: string, entityType?: string) {
  if (typeof window === 'undefined' || !query.trim()) return;
  
  try {
    let history = getRecentSearches();
    const cleanQuery = query.trim().toLowerCase();
    
    // Deduplicate
    history = history.filter(h => h.query.toLowerCase() !== cleanQuery);
    
    // Add new search at the beginning
    history.unshift({
      query: query.trim(),
      timestamp: Date.now(),
      entityType
    });
    
    // Cap at MAX_HISTORY
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save recent search', err);
  }
}

export function removeRecentSearch(query: string) {
  if (typeof window === 'undefined') return;
  try {
    const history = getRecentSearches();
    const cleanQuery = query.trim().toLowerCase();
    const updated = history.filter(h => h.query.toLowerCase() !== cleanQuery);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to remove recent search', err);
  }
}

export function clearAllRecentSearches() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear recent searches', err);
  }
}
