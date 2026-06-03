import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { initDatabase } from '../src/database/index.js';
import {
  claimListSitesForRun,
  releaseListSitesForRun,
} from '../src/discovery/list-site-coordinator.js';
import { getAllSweepstakesListSiteUrls } from '../src/discovery/list-sources.js';

describe('list site coordinator', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-list-coord-'));
    process.env.DATA_DIR = dir;
    initDatabase();
  });

  it('assigns different list sites to parallel discovery runs', () => {
    const pool = getAllSweepstakesListSiteUrls();
    expect(pool.length).toBeGreaterThan(12);

    const runA = claimListSitesForRun('run-a', true);
    const runB = claimListSitesForRun('run-b', true);
    expect(runA.length).toBeGreaterThan(0);
    expect(runB.length).toBeGreaterThan(0);

    const overlap = runA.filter((u) => runB.includes(u));
    expect(overlap).toEqual([]);

    releaseListSitesForRun('run-a');
    releaseListSitesForRun('run-b');
  });
});
