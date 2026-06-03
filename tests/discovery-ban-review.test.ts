import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { initDatabase, queueDiscoveryBanReview, getOpenSiteReports } from '../src/database/index.js';
import { getSweepstakesListSiteUrls } from '../src/discovery/list-sources.js';

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

  it('provides multiple sweepstakes list sites to crawl', () => {
    const quick = getSweepstakesListSiteUrls(false);
    const deep = getSweepstakesListSiteUrls(true);
    expect(quick.length).toBeGreaterThan(5);
    expect(deep.length).toBeGreaterThan(quick.length);
  });
});
