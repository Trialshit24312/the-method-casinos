import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { initDatabase, clearDiscoverySession, hasDiscoverySession } from '../src/database/index.js';
import {
  startClientDiscovery,
  runClientDiscoveryStep,
  cancelClientDiscovery,
} from '../src/discovery/step-engine.js';
import { getDiscoveryLiveSnapshot } from '../src/discovery/live-state.js';

describe('client discovery step engine', () => {
  beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-client-step-'));
    process.env.DATA_DIR = dir;
    initDatabase();
  });

  it('does not duplicate phase events when stepping', async () => {
    cancelClientDiscovery();
    clearDiscoverySession();
    startClientDiscovery(false);

    const before = getDiscoveryLiveSnapshot(0);
    expect(before.running).toBe(true);

    await runClientDiscoveryStep();
    const afterFirst = getDiscoveryLiveSnapshot(0);
    const phaseEvents = afterFirst.events.filter((e) => e.type === 'phase');
    const checking = phaseEvents.filter(
      (e) => e.type === 'phase' && e.label.includes('Checking for missing verified operators'),
    );
    expect(checking.length).toBeLessThanOrEqual(1);

    cancelClientDiscovery();
    expect(hasDiscoverySession()).toBe(false);
  });

  it('serializes concurrent step calls', async () => {
    cancelClientDiscovery();
    clearDiscoverySession();
    startClientDiscovery(false);

    const [a, b] = await Promise.all([
      runClientDiscoveryStep(),
      runClientDiscoveryStep(),
    ]);
    expect(a.done).toBe(b.done);
    expect(a.done).toBe(false);

    cancelClientDiscovery();
  });
});
