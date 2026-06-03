import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import {
  initDatabase,
  hasDiscoverySession,
  saveDiscoverySession,
  resetDiscoveryLiveStorage,
  recoverDiscoveryLiveOnBoot,
  isDiscoveryLiveRunningStorage,
} from '../src/database/index.js';
import { getDiscoveryLiveSnapshot } from '../src/discovery/live-state.js';

describe('discovery boot recovery', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-boot-recovery-'));
    process.env.DATA_DIR = dir;
    initDatabase();
  });

  it('preserves client session on server restart instead of wiping it', () => {
    saveDiscoverySession({
      mode: 'quick',
      phase: 'search',
      queryIndex: 5,
    });
    resetDiscoveryLiveStorage('quick');

    recoverDiscoveryLiveOnBoot();

    expect(hasDiscoverySession()).toBe(true);
    expect(isDiscoveryLiveRunningStorage()).toBe(false);
    const snap = getDiscoveryLiveSnapshot(0);
    expect(snap.phaseLabel).toContain('Resume');
  });
});
