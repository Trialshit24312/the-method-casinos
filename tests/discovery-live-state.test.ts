import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, beforeEach, describe, it, expect } from 'vitest';

describe('discovery live state', () => {
  beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'method-discovery-live-'));
    process.env.DATA_DIR = dir;
    const { initDatabase } = await import('../src/database/index.js');
    initDatabase();
  });

  beforeEach(async () => {
    const { beginDiscoveryLive } = await import('../src/discovery/live-state.js');
    beginDiscoveryLive('quick');
  });

  it('tracks phase events and completion', async () => {
    const {
      pushDiscoveryLiveEvent,
      finishDiscoveryLive,
      getDiscoveryLiveSnapshot,
      isDiscoveryLiveActive,
    } = await import('../src/discovery/live-state.js');

    expect(isDiscoveryLiveActive()).toBe(true);

    pushDiscoveryLiveEvent({ type: 'phase', phase: 'search', label: 'Searching…' });
    pushDiscoveryLiveEvent({
      type: 'progress',
      stats: {
        scanned: 2,
        queued: 1,
        added: 0,
        rejected: 1,
        skipped: 0,
        blocked: 0,
        sourcesChecked: 3,
        phase: 'search',
        queryIndex: 1,
        queryTotal: 8,
      },
    });

    const snap = getDiscoveryLiveSnapshot(0);
    expect(snap.running).toBe(true);
    expect(snap.phaseLabel).toBe('Searching…');
    expect(snap.stats?.scanned).toBe(2);
    expect(snap.events.length).toBe(1);

    finishDiscoveryLive({
      scanned: 2,
      found: 1,
      added: 0,
      skipped: 0,
      blocked: 0,
      rejected: 1,
      durationMs: 1000,
      sourcesChecked: 3,
      errors: [],
      mode: 'quick',
      addedCasinos: [],
    });

    expect(isDiscoveryLiveActive()).toBe(false);
    expect(getDiscoveryLiveSnapshot().result?.scanned).toBe(2);
  });

  it('returns events since cursor', async () => {
    const { pushDiscoveryLiveEvent, getDiscoveryLiveSnapshot } = await import('../src/discovery/live-state.js');

    pushDiscoveryLiveEvent({ type: 'search_query', query: 'sweepstakes casino' });
    pushDiscoveryLiveEvent({ type: 'url_scanning', url: 'example.com' });

    const all = getDiscoveryLiveSnapshot(0);
    expect(all.events).toHaveLength(2);

    const since = getDiscoveryLiveSnapshot(all.events[0].seq + 1);
    expect(since.events).toHaveLength(1);
    expect(since.events[0].type).toBe('url_scanning');
  });

  it('persists completed result for reload', async () => {
    const { finishDiscoveryLive, getDiscoveryLiveSnapshot } = await import('../src/discovery/live-state.js');

    finishDiscoveryLive({
      scanned: 5,
      found: 2,
      added: 1,
      skipped: 0,
      blocked: 0,
      rejected: 1,
      durationMs: 5000,
      sourcesChecked: 10,
      errors: [],
      mode: 'deep',
      addedCasinos: [{ name: 'Test Casino', url: 'https://example.com' }],
    });

    const snap = getDiscoveryLiveSnapshot(0);
    expect(snap.running).toBe(false);
    expect(snap.result?.added).toBe(1);
    expect(snap.result?.mode).toBe('deep');
  });
});
