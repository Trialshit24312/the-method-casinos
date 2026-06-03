import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { initDatabase, getPendingCasinos, clearDiscoverySession } from '../src/database/index.js';
import { saveDiscoveryCandidateForReview, isSoftDiscoveryReject } from '../src/discovery/engine.js';
import { getKnownHosts } from '../src/database/index.js';

describe('discovery soft save to review queue', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-soft-save-'));
    process.env.DATA_DIR = dir;
    initDatabase();
  });

  it('classifies fetch/validation failures as soft rejects', () => {
    expect(isSoftDiscoveryReject('fetch failed')).toBe(true);
    expect(isSoftDiscoveryReject('insufficient sweepstakes signals')).toBe(true);
    expect(isSoftDiscoveryReject('adult content')).toBe(false);
    expect(isSoftDiscoveryReject('not a casino candidate URL')).toBe(false);
  });

  it('saves operator-shaped hosts as pending for manual review', () => {
    clearDiscoverySession();
    const known = getKnownHosts();
    const saved = saveDiscoveryCandidateForReview(
      'https://newtestcasino.us',
      'fetch failed',
      new Set(known),
    );
    expect(saved).not.toBeNull();
    const pending = getPendingCasinos();
    expect(pending.some((c) => c.url.includes('newtestcasino.us'))).toBe(true);
  });
});
