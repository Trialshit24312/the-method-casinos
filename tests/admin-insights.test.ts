import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { initDatabase, getAdminInsights, getKnownHosts } from '../src/database/index.js';
import { saveDiscoveryCandidateForReview } from '../src/discovery/engine.js';

describe('getAdminInsights', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-insights-'));
    process.env.DATA_DIR = dir;
    initDatabase();
  });

  it('returns pending count and structure', () => {
    saveDiscoveryCandidateForReview(
      'https://pending-insights-test.us',
      'fetch failed',
      new Set(getKnownHosts()),
    );
    const insights = getAdminInsights();
    expect(insights.pendingCount).toBeGreaterThanOrEqual(1);
    expect(insights.discoveryLast7d).toMatchObject({
      runs: expect.any(Number),
      added: expect.any(Number),
      rejected: expect.any(Number),
    });
    expect(Array.isArray(insights.recentRuns)).toBe(true);
    expect(typeof insights.catalogGrowth30d).toBe('number');
  });
});
