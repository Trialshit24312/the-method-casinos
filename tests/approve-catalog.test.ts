import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import {
  initDatabase,
  approveCasino,
  getPendingCasinos,
  searchCasinos,
} from '../src/database/index.js';
import { saveDiscoveryCandidateForReview } from '../src/discovery/engine.js';
import { getKnownHosts } from '../src/database/index.js';

describe('approve casino catalog inclusion', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-approve-catalog-'));
    process.env.DATA_DIR = dir;
    process.env.REMOTE_DB_SYNC = '0';
    initDatabase();
  });

  it('moves approved pending casinos into the verified catalog', () => {
    const known = getKnownHosts();
    const saved = saveDiscoveryCandidateForReview(
      'https://approvedcatalogtest.us',
      'from sweepstakes list site',
      new Set(known),
    );
    expect(saved).not.toBeNull();

    const pendingBefore = getPendingCasinos();
    const row = pendingBefore.find((c) => c.url.includes('approvedcatalogtest.us'));
    expect(row).toBeDefined();

    const approved = approveCasino(row!.id, 'test-admin');
    expect(approved).not.toBeNull();
    expect(approved?.verified).toBe(true);
    expect(approved?.reviewStatus).toBe('approved');

    expect(getPendingCasinos().some((c) => c.id === row!.id)).toBe(false);

    const catalog = searchCasinos({ catalogOnly: true, limit: 500 });
    expect(catalog.some((c) => c.url.includes('approvedcatalogtest.us'))).toBe(true);
  });
});
