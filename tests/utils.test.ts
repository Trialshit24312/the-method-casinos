import { describe, it, expect } from 'vitest';
import {
  casinoHostKey,
  toCasinoRootUrl,
  isValidCasinoHost,
  getOperatorRootHost,
} from '../src/shared/utils.js';

describe('casinoHostKey', () => {
  it('normalizes www and paths to hostname', () => {
    expect(casinoHostKey('https://www.chumbacasino.com/vip')).toBe('chumbacasino.com');
    expect(toCasinoRootUrl('https://www.chumbacasino.com/vip')).toBe('https://chumbacasino.com');
  });

  it('rejects invalid support subdomains', () => {
    expect(isValidCasinoHost('support.yaycasino.com')).toBe(false);
    expect(isValidCasinoHost('yaycasino.com')).toBe(true);
  });

  it('collapses CDN/login subdomains to operator root', () => {
    expect(getOperatorRootHost('cdn4.wowvegas.com')).toBe('wowvegas.com');
    expect(getOperatorRootHost('login.chumbacasino.com')).toBe('chumbacasino.com');
    expect(getOperatorRootHost('play.globalpoker.com')).toBe('globalpoker.com');
    expect(casinoHostKey('https://cdn4.wowvegas.com/assets/app.js')).toBe('wowvegas.com');
    expect(isValidCasinoHost('cdn4.wowvegas.com')).toBe(false);
    expect(isValidCasinoHost('wowvegas.com')).toBe(true);
  });

  it('rejects invalid partial hostnames', () => {
    expect(getOperatorRootHost('offers.fortunecoins')).toBeNull();
    expect(getOperatorRootHost('sweeps.high')).toBeNull();
  });
});
