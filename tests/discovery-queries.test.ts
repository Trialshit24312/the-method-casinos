import { afterEach, describe, it, expect } from 'vitest';
import { buildSearchQueries } from '../src/discovery/queries.js';

describe('buildSearchQueries', () => {
  const prev = process.env.DISCOVERY_WEB_SEARCH;

  afterEach(() => {
    if (prev === undefined) delete process.env.DISCOVERY_WEB_SEARCH;
    else process.env.DISCOVERY_WEB_SEARCH = prev;
  });

  it('returns empty when web search is disabled (default)', () => {
    delete process.env.DISCOVERY_WEB_SEARCH;
    expect(buildSearchQueries(true)).toEqual([]);
  });

  it('uses sweepstakes queries when DISCOVERY_WEB_SEARCH=1', () => {
    process.env.DISCOVERY_WEB_SEARCH = '1';
    const queries = buildSearchQueries(true);
    expect(queries.length).toBeGreaterThan(10);
    for (const q of queries) {
      const lower = q.toLowerCase();
      expect(
        lower.includes('sweepstakes')
        || lower.includes('sweeps')
        || lower.includes('social casino')
        || lower.includes('gold coins')
        || lower.includes('sweeps coins'),
      ).toBe(true);
    }
  });
});
