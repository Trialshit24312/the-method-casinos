import { describe, it, expect } from 'vitest';
import {
  computeSimilarity,
  rankSimilarCasinos,
  scoreInferredSimilarity,
} from '../src/shared/similarity.js';
import type { Casino } from '../src/shared/types.js';

function mockCasino(overrides: Partial<Casino> & Pick<Casino, 'id' | 'name'>): Casino {
  return {
    url: 'https://example.com',
    urlNormalized: 'example.com',
    description: '',
    features: ['sweepstakes'],
    signupRequirements: ['Email'],
    verified: true,
    active: true,
    reviewStatus: 'approved',
    rating: 4.5,
    source: 'manual',
    bonusInfo: '',
    cashOutBeforeBlocked: null,
    trackables: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: null,
    lastCheckedAt: null,
    healthStatus: 'ok',
    healthNote: '',
    ...overrides,
  };
}

describe('similarity scoring', () => {
  it('rewards shared no_phone and slots features over sweepstakes-only overlap', () => {
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

  it('uses text overlap when feature sets are sparse', () => {
    const source = mockCasino({
      id: 'a',
      name: 'Lucky Spin Slots',
      description: 'Free sweeps coins daily bonus no phone signup',
      features: ['sweepstakes'],
    });
    const textMatch = mockCasino({
      id: 'b',
      name: 'Lucky Spin Social',
      description: 'Daily free sweeps coins and bonus spins',
      features: ['sweepstakes'],
    });
    const noText = mockCasino({
      id: 'c',
      name: 'Unrelated Brand',
      description: 'Sports betting picks',
      features: ['sweepstakes'],
    });
    expect(computeSimilarity(source, textMatch).matchPercent).toBeGreaterThan(
      computeSimilarity(source, noText).matchPercent,
    );
  });

  it('rankSimilarCasinos prefers multi-feature matches', () => {
    const source = mockCasino({
      id: 'src',
      name: 'Chumba',
      features: ['sweepstakes', 'no_phone', 'slots', 'gift_card_redeem'],
    });
    const candidates = [
      mockCasino({ id: '1', name: 'Like', features: ['sweepstakes', 'no_phone', 'slots', 'gift_card_redeem'] }),
      mockCasino({ id: '2', name: 'Unlike', features: ['sweepstakes'] }),
    ];
    const ranked = rankSimilarCasinos(source, candidates, 5);
    expect(ranked[0]?.casino.id).toBe('1');
    expect(ranked.some((m) => m.matchPercent >= 15)).toBe(true);
  });

  it('scoreInferredSimilarity ranks inferred pages against source', () => {
    const source = mockCasino({
      id: 'src',
      name: 'Pulsz',
      features: ['sweepstakes', 'no_phone', 'slots', 'gift_card_redeem'],
      signupRequirements: ['Email'],
    });
    const high = scoreInferredSimilarity(source, {
      name: 'McLuck',
      description: 'Social sweeps slots',
      features: ['sweepstakes', 'no_phone', 'slots', 'gift_card_redeem'],
      signupRequirements: ['Email'],
      bonusInfo: 'Welcome bonus',
      rating: 4.4,
    });
    const low = scoreInferredSimilarity(source, {
      name: 'SportsBook',
      description: 'Sports betting',
      features: ['sweepstakes', 'sports'],
      signupRequirements: ['Phone', 'ID'],
      bonusInfo: '',
      rating: 3.5,
    });
    expect(high).toBeGreaterThan(low);
  });
});
