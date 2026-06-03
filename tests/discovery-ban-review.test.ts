import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import {
  initDatabase,
  banRejectedDiscovery,
  isUrlBlocked,
  getOpenSiteReports,
} from '../src/database/index.js';
import { getSweepstakesListSiteUrls } from '../src/discovery/list-sources.js';

describe('discovery rejection auto-ban', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-ban-review-'));
    process.env.DATA_DIR = dir;
    initDatabase();
  });

  it('bans hard-rejected discovery URLs on the blocklist', () => {
    const url = 'https://totally-fake-sweeps-casino.com';
    const site = banRejectedDiscovery(url, 'validation failed');
    expect(site).not.toBeNull();
    expect(site?.reportedBy).toBe('discovery');
    expect(isUrlBlocked(url)).toBe(true);

    const open = getOpenSiteReports();
    expect(open.some((r) => r.url.includes('totally-fake-sweeps-casino.com'))).toBe(false);
  });

  it('provides multiple sweepstakes list sites to crawl', () => {
    const quick = getSweepstakesListSiteUrls(false);
    const deep = getSweepstakesListSiteUrls(true);
    expect(quick.length).toBeGreaterThan(5);
    expect(deep.length).toBeGreaterThan(quick.length);
  });
});
