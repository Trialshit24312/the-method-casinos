import { describe, it, expect, beforeEach } from 'vitest';
import {
  beginDiscoveryLive,
  pushDiscoveryLiveEvent,
  finishDiscoveryLive,
  getDiscoveryLiveSnapshot,
  isDiscoveryLiveActive,
} from '../src/discovery/live-state.js';

describe('discovery live state', () => {
  beforeEach(() => {
    beginDiscoveryLive('quick');
  });

  it('tracks phase events and completion', () => {
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

  it('returns events since cursor', () => {
    pushDiscoveryLiveEvent({ type: 'search_query', query: 'sweepstakes casino' });
    pushDiscoveryLiveEvent({ type: 'url_scanning', url: 'example.com' });

    const all = getDiscoveryLiveSnapshot(0);
    expect(all.events).toHaveLength(2);

    const since = getDiscoveryLiveSnapshot(1);
    expect(since.events).toHaveLength(1);
    expect(since.events[0].type).toBe('url_scanning');
  });
});
