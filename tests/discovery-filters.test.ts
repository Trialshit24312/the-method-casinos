import { describe, it, expect } from 'vitest';
import {
  isDiscoveryCandidateUrl,
  isBlockedDomain,
  shouldQueueSearchUrl,
  isSweepstakesDirectoryUrl,
  isNonOperatorInfrastructureHost,
} from '../src/discovery/filters.js';

describe('discovery URL filters', () => {
  it('blocks junk and allows sweepstakes list pages', () => {
    expect(isBlockedDomain('https://bonus.com/deals')).toBe(true);
    expect(isBlockedDomain('https://schema.org/Casino')).toBe(true);
    expect(isSweepstakesDirectoryUrl('https://casino.guru/reviews')).toBe(true);
    expect(isBlockedDomain('https://casino.guru/reviews')).toBe(false);
  });

  it('blocks third-party scripts and widgets from list-site link mining', () => {
    for (const url of [
      'https://www.googletagmanager.com/gtm.js',
      'https://rankmath.com',
      'https://optinmonster.com',
      'https://fontawesome.com',
      'https://www.whatsapp.com',
      'https://scoresandodds.com',
    ]) {
      expect(isNonOperatorInfrastructureHost(url)).toBe(true);
      expect(isDiscoveryCandidateUrl(url)).toBe(false);
      expect(shouldQueueSearchUrl(url)).toBe(false);
    }
  });

  it('collapses CDN hosts to operator root when checking hints', () => {
    expect(isDiscoveryCandidateUrl('https://cdn4.wowvegas.com')).toBe(true);
    expect(isDiscoveryCandidateUrl('https://wowvegas.com')).toBe(true);
  });

  it('rejects generic .com without casino hints', () => {
    expect(isDiscoveryCandidateUrl('https://bonus.com')).toBe(false);
    expect(shouldQueueSearchUrl('https://bonus.com')).toBe(false);
    expect(isDiscoveryCandidateUrl('https://example.com')).toBe(false);
  });

  it('allows known sweepstakes brands on .com', () => {
    expect(isDiscoveryCandidateUrl('https://pulsz.com')).toBe(true);
    expect(isDiscoveryCandidateUrl('https://chumba.com')).toBe(true);
  });

  it('allows sweepstakes roundup sites for list mining', () => {
    expect(isSweepstakesDirectoryUrl('https://www.sweepskings.com/')).toBe(true);
    expect(isBlockedDomain('https://www.sweepskings.com/best-sites')).toBe(false);
    expect(shouldQueueSearchUrl('https://www.sweepskings.com/best-sites')).toBe(true);
  });
});
