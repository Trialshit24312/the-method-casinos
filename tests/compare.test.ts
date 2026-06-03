import { describe, it, expect } from 'vitest';
import { compareCasinos } from '../src/shared/compare.js';
import type { Casino } from '../src/shared/types.js';

function mock(id: string, features: Casino['features'], rating = 4.5): Casino {
  return {
    id,
    name: id,
    url: `https://${id}.com`,
    urlNormalized: id,
    description: '',
    features,
    signupRequirements: ['Email'],
    verified: true,
    active: true,
    reviewStatus: 'approved',
    rating,
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trackables: [],
  };
}

describe('compareCasinos', () => {
  it('finds shared and unique features', () => {
    const a = mock('a', ['sweepstakes', 'slots', 'no_phone']);
    const b = mock('b', ['sweepstakes', 'slots', 'vpn_allowed']);
    const result = compareCasinos(a, b);
    expect(result.sharedFeatures).toEqual(['sweepstakes', 'slots']);
    expect(result.onlyA).toContain('no_phone');
    expect(result.onlyB).toContain('vpn_allowed');
  });
});
