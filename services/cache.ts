
export interface HistoryItem {
  id: string;
  timestamp: number;
  tool: 'BIBLE' | 'BIO' | 'SERMON';
  query: string;
  result: any;
  language: string;
}

const CACHE_KEY = 'faithwalk_history_cache_v1';
export const HISTORY_EVENT = 'faithwalk-history-updated';

export const saveToCache = (tool: 'BIBLE' | 'BIO' | 'SERMON', query: string, result: any, language: string) => {
  try {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      tool,
      query: query.trim(),
      result,
      language
    };

    const existing = getHistory();
    // Remove duplicates for same query
    const filtered = existing.filter(item => item.query.toLowerCase() !== query.trim().toLowerCase());
    
    // Add to top, limit to 50 items
    const updated = [newItem, ...filtered].slice(0, 50);
    localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    
    // Notify UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(HISTORY_EVENT));
    }
  } catch (e) {
    console.warn("Cache save failed", e);
  }
};

export const checkCache = (tool: 'BIBLE' | 'BIO' | 'SERMON', query: string): any | null => {
  try {
    const history = getHistory();
    const item = history.find(h => h.tool === tool && h.query.toLowerCase() === query.trim().toLowerCase());
    return item ? item.result : null;
  } catch (e) {
    return null;
  }
};

export const getHistory = (): HistoryItem[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const clearHistory = () => {
  localStorage.removeItem(CACHE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HISTORY_EVENT));
  }
};
