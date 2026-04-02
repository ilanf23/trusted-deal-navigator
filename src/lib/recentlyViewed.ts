const STORAGE_KEY = 'clx-recently-viewed';
const MAX_ITEMS = 10;

export interface RecentlyViewedEntry {
  id: string;
  name: string;
  title?: string | null;
  company?: string | null;
}

export function getRecentlyViewed(): RecentlyViewedEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(entry: RecentlyViewedEntry) {
  const list = getRecentlyViewed().filter(e => e.id !== entry.id);
  list.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
}
