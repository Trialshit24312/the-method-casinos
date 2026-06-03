export interface RecentView {
  id: string;
  slug: string;
  name: string;
  viewedAt: string;
}

const STORAGE_KEY = 'method-recently-viewed';
const MAX = 8;

export function readRecentlyViewed(): RecentView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v) => v && typeof v.id === 'string' && typeof v.slug === 'string' && typeof v.name === 'string')
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(casino: { id: string; urlNormalized?: string | null; name: string }): RecentView[] {
  const slug = casino.urlNormalized ?? casino.id;
  const entry: RecentView = {
    id: casino.id,
    slug,
    name: casino.name,
    viewedAt: new Date().toISOString(),
  };
  const next = [entry, ...readRecentlyViewed().filter((v) => v.id !== casino.id)].slice(0, MAX);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
