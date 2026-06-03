import { describe, it, expect } from 'vitest';
import { computeSimilarity, rankSimilarCasinos } from '../src/shared/similarity.js';
import type { Casino } from '../src/shared/types.js';

function mockCasino(overrides: Partial<Casino> & Pick<Casino, 'id' | 'name'>): Casino {
  return {
    url: 'https://example.com',
    description: '',
    features: ['sweepstakes'],
    signupRequirements: ['Email'],
    verified: true,
    active: true,
    reviewStatus: 'approved',
    rating: 4.5,
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('similarity scoring', () => {
  it('rewards shared no_phone and slots features', () => {
    const source = mockCasino({
      id: 'a',
      name: 'Source',
      features: ['sweepstakes', 'no_phone', 'email_only', 'slots'],
    });
    const close = mockCasino({
      id: 'b',
      name: 'Close',
      features: ['sweepstakes', 'no_phone', 'email_only', 'slots'],
    });
    const far = mockCasino({
      id: 'c',
      name: 'Far',
      features: ['sweepstakes', 'sports'],
    });
    expect(computeSimilarity(source, close).matchPercent).toBeGreaterThan(
      computeSimilarity(source, far).matchPercent,
    );
  });

  it('penalizes vpn_allowed vs vpn_blocked mismatch', () => {
    const source = mockCasino({
      id: 'a',
      name: 'VPN ok',
      features: ['sweepstakes', 'vpn_allowed'],
    });
    const blocked = mockCasino({
      id: 'b',
      name: 'VPN blocked',
      features: ['sweepstakes', 'vpn_blocked'],
    });
    const allowed = mockCasino({
      id: 'c',
      name: 'Also VPN ok',
      features: ['sweepstakes', 'vpn_allowed'],
    });
    expect(computeSimilarity(source, allowed).matchPercent).toBeGreaterThan(
      computeSimilarity(source, blocked).matchPercent,
    );
  });

  it('rankSimilarCasinos filters weak matches', () => {
    const source = mockCasino({
      id: 'src',
      name: 'Chumba',
      features: ['sweepstakes', 'no_phone', 'slots'],
    });
    const candidates = [
      mockCasino({ id: '1', name: 'Like', features: ['sweepstakes', 'no_phone', 'slots'] }),
      mockCasino({ id: '2', name: 'Unlike', features: ['sweepstakes'] }),
    ];
    const ranked = rankSimilarCasinos(source, candidates, 5);
    expect(ranked.some((m) => m.casino.id === '1')).toBe(true);
    expect(ranked.every((m) => m.matchPercent >= 20)).toBe(true);
  });
});
