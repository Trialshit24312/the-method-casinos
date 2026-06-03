import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { initDatabase, addCasino, getPendingCasinos } from '../src/database/index.js';
import {
  getLatestLocalBackupPath,
  restoreLatestLocalBackupIfNeeded,
} from '../src/shared/catalog-persist.js';
import { getDbPath } from '../src/shared/data-path.js';

describe('hardwired catalog persist', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-catalog-persist-'));
    process.env.DATA_DIR = dir;
    process.env.REMOTE_DB_SYNC = '0';
    initDatabase();
  });

  it('writes casinos.latest.db after addCasino', () => {
    const added = addCasino({
      name: 'Persist Test Casino',
      url: 'https://persisttestcasino.us',
      description: 'test',
      features: ['sweepstakes'],
      signupRequirements: ['Email'],
      source: 'web_scan',
      verified: false,
      reviewStatus: 'pending',
    });
    expect(added).not.toBeNull();

    const latest = getLatestLocalBackupPath();
    expect(fs.existsSync(latest)).toBe(true);
    expect(fs.statSync(latest).size).toBeGreaterThan(1000);

    const pending = getPendingCasinos();
    expect(pending.some((c) => c.url.includes('persisttestcasino.us'))).toBe(true);
  });

  it('restore helper is available when backup exists', () => {
    expect(fs.existsSync(getLatestLocalBackupPath())).toBe(true);
    expect(restoreLatestLocalBackupIfNeeded()).toBe(false);
  });
});
