import { describe, it, expect } from 'vitest';
import { isCatalogStale, formatLastChecked, STALE_CATALOG_DAYS } from '../src/shared/freshness.js';

describe('catalog freshness', () => {
  const now = new Date('2026-05-31T12:00:00Z').getTime();

  it('treats null lastCheckedAt as stale', () => {
    expect(isCatalogStale(null, now)).toBe(true);
    expect(formatLastChecked(null)).toBe('Never checked');
  });

  it('marks entries older than STALE_CATALOG_DAYS as stale', () => {
    const old = new Date(now - (STALE_CATALOG_DAYS + 1) * 86400000).toISOString();
    expect(isCatalogStale(old, now)).toBe(true);
  });

  it('marks recent checks as fresh', () => {
    const recent = new Date(now - 5 * 86400000).toISOString();
    expect(isCatalogStale(recent, now)).toBe(false);
    expect(formatLastChecked(recent, now)).toBe('Checked 5d ago');
  });
});
