import { describe, it, expect } from 'vitest';
import { buildSearchQueries } from '../src/discovery/queries.js';

describe('buildSearchQueries', () => {
  it('only uses sweepstakes-focused queries', () => {
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

  it('prioritizes list-style discovery queries', () => {
    const queries = buildSearchQueries(false);
    const listish = queries.filter((q) => /list|directory|complete|all |master|catalog|roundup|every /i.test(q));
    expect(listish.length).toBeGreaterThan(3);
  });
});
