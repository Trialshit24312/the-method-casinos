import { describe, it, expect } from 'vitest';
import { isDiscoveryCandidateUrl, isBlockedDomain, shouldQueueSearchUrl } from '../src/discovery/filters.js';

describe('discovery URL filters', () => {
  it('blocks review/list sites', () => {
    expect(isBlockedDomain('https://casino.guru/reviews')).toBe(true);
    expect(isBlockedDomain('https://bonus.com/deals')).toBe(true);
    expect(isBlockedDomain('https://schema.org/Casino')).toBe(true);
  });

  it('collapses CDN hosts to operator root when checking hints', () => {
    expect(isDiscoveryCandidateUrl('https://cdn4.wowvegas.com')).toBe(true);
    expect(isDiscoveryCandidateUrl('https://wowvegas.com')).toBe(true);
  });

  it('rejects generic .com without casino hints', () => {
    expect(isDiscoveryCandidateUrl('https://bonus.com')).toBe(false);
    expect(shouldQueueSearchUrl('https://bonus.com')).toBe(false);
  });
});
