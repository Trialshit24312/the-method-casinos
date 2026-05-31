import { describe, it, expect } from 'vitest';
import { isDiscoveryCandidateUrl, isBlockedDomain } from '../src/discovery/filters.js';

describe('discovery URL filters', () => {
  it('blocks review/list sites', () => {
    expect(isBlockedDomain('https://casino.guru/reviews')).toBe(true);
  });

  it('collapses CDN hosts to operator root when checking hints', () => {
    // Subdomain URL still maps to wowvegas.com for hint matching
    expect(isDiscoveryCandidateUrl('https://cdn4.wowvegas.com')).toBe(true);
    expect(isDiscoveryCandidateUrl('https://wowvegas.com')).toBe(true);
  });
});
