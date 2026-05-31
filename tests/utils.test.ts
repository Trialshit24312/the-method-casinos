import { describe, it, expect } from 'vitest';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../src/shared/utils.js';

describe('casinoHostKey', () => {
  it('normalizes www and paths to hostname', () => {
    expect(casinoHostKey('https://www.chumbacasino.com/vip')).toBe('chumbacasino.com');
    expect(toCasinoRootUrl('https://www.chumbacasino.com/vip')).toBe('https://chumbacasino.com');
  });

  it('rejects invalid support subdomains', () => {
    expect(isValidCasinoHost('support.yaycasino.com')).toBe(false);
    expect(isValidCasinoHost('yaycasino.com')).toBe(true);
  });
});
