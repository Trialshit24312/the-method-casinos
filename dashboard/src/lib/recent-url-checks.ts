const STORAGE_KEY = 'method-recent-url-checks';
const MAX = 6;

export function readRecentUrlChecks(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentUrlCheck(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) return readRecentUrlChecks();
  const next = [trimmed, ...readRecentUrlChecks().filter((u) => u !== trimmed)].slice(0, MAX);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
