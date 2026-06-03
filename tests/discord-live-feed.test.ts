import { describe, it, expect } from 'vitest';
import { formatDiscoveryEventLine } from '../src/shared/discord-live-feed.js';

describe('discord live feed formatting', () => {
  it('formats high-signal discovery events', () => {
    expect(formatDiscoveryEventLine({ type: 'phase', phase: 'search', label: 'Web search' }))
      .toContain('Web search');
    expect(formatDiscoveryEventLine({
      type: 'url_added',
      url: 'https://example-casino.com',
      name: 'Example Casino',
    })).toContain('Example Casino');
    expect(formatDiscoveryEventLine({
      type: 'complete',
      result: {
        scanned: 10,
        found: 2,
        added: 1,
        skipped: 0,
        blocked: 0,
        rejected: 3,
        durationMs: 120_000,
        sourcesChecked: 5,
        errors: [],
        mode: 'deep',
        addedCasinos: [{ name: 'Foo', url: 'https://foo.com' }],
      },
    })).toContain('deep scan complete');
  });

  it('hides per-url scan noise unless verbose', () => {
    const ev = { type: 'url_scanning' as const, url: 'https://scan.me/path' };
    expect(formatDiscoveryEventLine(ev)).toBeNull();
    process.env.DISCORD_LIVE_FEED_VERBOSE = '1';
    expect(formatDiscoveryEventLine(ev)).toContain('scan.me');
    delete process.env.DISCORD_LIVE_FEED_VERBOSE;
  });
});
