import { describe, it, expect, beforeEach } from 'vitest';
import { createOAuthState, verifyOAuthState, parseOAuthState } from '../src/server/auth.js';

describe('OAuth state', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-for-vitest';
  });

  it('creates and verifies signed state tokens', () => {
    const state = createOAuthState();
    expect(verifyOAuthState(state)).toBe(true);
    expect(verifyOAuthState('tampered')).toBe(false);
  });

  it('embeds and restores post-login redirect path', () => {
    const state = createOAuthState('/discovery');
    const parsed = parseOAuthState(state);
    expect(parsed.valid).toBe(true);
    expect(parsed.next).toBe('/discovery');
  });

  it('rejects tampered signatures', () => {
    const state = createOAuthState('/dashboard');
    const tampered = `${state.slice(0, -1)}0`;
    expect(parseOAuthState(tampered).valid).toBe(false);
  });
});
