import { describe, it, expect } from 'vitest';
import { createOAuthState, verifyOAuthState } from '../src/server/auth.js';

describe('OAuth state', () => {
  it('creates and verifies signed state tokens', () => {
    process.env.SESSION_SECRET = 'test-secret-for-vitest';
    const state = createOAuthState();
    expect(verifyOAuthState(state)).toBe(true);
    expect(verifyOAuthState('tampered')).toBe(false);
  });
});
