export const STALE_CATALOG_DAYS = 90;

export function isCatalogStale(lastCheckedAt: string | null, now = Date.now()): boolean {
  if (!lastCheckedAt) return true;
  const ageMs = now - new Date(lastCheckedAt).getTime();
  return ageMs > STALE_CATALOG_DAYS * 24 * 60 * 60 * 1000;
}

export function formatLastChecked(lastCheckedAt: string | null, now = Date.now()): string {
  if (!lastCheckedAt) return 'Never checked';
  const then = new Date(lastCheckedAt).getTime();
  const days = Math.floor((now - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Checked today';
  if (days === 1) return 'Checked yesterday';
  if (days < 30) return `Checked ${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'Checked ~1mo ago' : `Checked ~${months}mo ago`;
}
