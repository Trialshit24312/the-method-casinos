import { describe, it, expect } from 'vitest';
import { validateSweepstakesPage, sanitizeCasinoName } from '../src/discovery/filters.js';

describe('validateSweepstakesPage', () => {
  it('accepts pages with strong sweepstakes signals', () => {
    const result = validateSweepstakesPage(
      'Chumba Casino - Sweepstakes',
      'Play sweepstakes slots with Gold Coins',
      'Sign up for free sweeps coins and sweepstakes casino games no purchase necessary',
      'https://chumbacasino.com',
    );
    expect(result.valid).toBe(true);
  });

  it('rejects news sites', () => {
    const result = validateSweepstakesPage(
      'Best Casinos News',
      'Latest casino news',
      'Read our blog and reviews about online gambling news today',
      'https://example.com',
    );
    expect(result.valid).toBe(false);
  });
});

describe('sanitizeCasinoName', () => {
  it('falls back to brand for generic page titles', () => {
    expect(sanitizeCasinoName('VIP Program | Moonspin', 'https://moonspin.us')).toBe('Moonspin');
    expect(sanitizeCasinoName('Sign Up for Free', 'https://yaycasino.com')).toBe('Yaycasino');
  });
});
