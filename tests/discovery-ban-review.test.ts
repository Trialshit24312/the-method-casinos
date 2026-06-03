import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { initDatabase, queueDiscoveryBanReview, getOpenSiteReports } from '../src/database/index.js';
import { buildSearchQueries } from '../src/discovery/queries.js';

describe('discovery ban review and fresh queries', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-ban-review-'));
    process.env.DATA_DIR = dir;
    initDatabase();
  });

  it('queues rejected URLs for ban review', () => {
    const report = queueDiscoveryBanReview('https://totally-fake-sweeps-casino.com', 'validation failed');
    expect(report).not.toBeNull();
    expect(report?.reportedBy).toBe('discovery');
    expect(report?.reason).toContain('Ban review');

    const open = getOpenSiteReports();
    expect(open.some((r) => r.url.includes('totally-fake-sweeps-casino.com'))).toBe(true);
  });

  it('builds a different query order on each call', () => {
    const a = buildSearchQueries(false);
    const b = buildSearchQueries(false);
    expect(a.length).toBeGreaterThan(10);
    expect(b.length).toBeGreaterThan(10);
    const sameOrder = a.length === b.length && a.every((q, i) => q === b[i]);
    expect(sameOrder).toBe(false);
  });
});
