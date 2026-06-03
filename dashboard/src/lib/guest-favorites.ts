import type { Casino } from '../types';

const STORAGE_KEY = 'method-guest-favorites';
const MAX = 50;

export function readGuestFavorites(): Casino[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string').slice(0, MAX);
  } catch {
    return [];
  }
}

export function isGuestFavorite(casinoId: string): boolean {
  return readGuestFavorites().some((c) => c.id === casinoId);
}

export function toggleGuestFavorite(casino: Casino): boolean {
  const existing = readGuestFavorites();
  const has = existing.some((c) => c.id === casino.id);
  const next = has
    ? existing.filter((c) => c.id !== casino.id)
    : [{ ...casino, savedAt: new Date().toISOString() }, ...existing].slice(0, MAX);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('method-guest-favorites'));
  return !has;
}

export function removeGuestFavorite(casinoId: string): void {
  const next = readGuestFavorites().filter((c) => c.id !== casinoId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('method-guest-favorites'));
}

export async function mergeGuestFavoritesIntoAccount(
  addFavorite: (casinoId: string) => Promise<unknown>,
): Promise<number> {
  const guest = readGuestFavorites();
  if (!guest.length) return 0;

  const remaining: Casino[] = [];
  let merged = 0;

  for (const casino of guest) {
    try {
      await addFavorite(casino.id);
      merged += 1;
    } catch {
      /* network error or duplicate — keep locally until confirmed */
      remaining.push(casino);
    }
  }

  if (remaining.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  }
  window.dispatchEvent(new Event('method-guest-favorites'));

  if (merged > 0) {
    sessionStorage.setItem('method-guest-merge-notice', String(merged));
  }

  return merged;
}
