
export interface HistoryItem {
  id: string;
  timestamp: number;
  tool: 'BIBLE' | 'BIO' | 'SERMON' | 'LIVE';
  query: string;
  result: any;
  language: string;
}

const CACHE_KEY = 'faithwalk_history_cache_v1';
export const HISTORY_EVENT = 'faithwalk-history-updated';

export const saveToCache = (tool: 'BIBLE' | 'BIO' | 'SERMON' | 'LIVE', query: string, result: any, language: string) => {
  if (!query || !result) return;
  
  const newItem: HistoryItem = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    tool,
    query: query.trim(),
    result,
    language
  };

  try {
    const existing = getHistory();
    // Remove duplicates for same query (for non-Live tools primarily)
    const filtered = tool === 'LIVE' 
      ? existing 
      : existing.filter(item => item.query.toLowerCase() !== query.trim().toLowerCase());
    
    // Add to top, default limit 50
    const updated = [newItem, ...filtered].slice(0, 50);
    localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    dispatchUpdate();
  } catch (e: any) {
    // Robust Quota Handling: If storage is full, remove oldest items and retry
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      try {
        console.warn("Storage full, cleaning up old history...");
        const existing = getHistory();
        if (existing.length > 5) {
          // Keep only the newest 25 items to free up significant space
          const pruned = [newItem, ...existing].slice(0, 25);
          localStorage.setItem(CACHE_KEY, JSON.stringify(pruned));
          dispatchUpdate();
        }
      } catch (retryError) {
        console.error("Failed to save history even after pruning", retryError);
      }
    } else {
      console.warn("Cache save failed", e);
    }
  }
};

const dispatchUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HISTORY_EVENT));
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
  dispatchUpdate();
};
