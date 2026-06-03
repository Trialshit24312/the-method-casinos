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
    const parts = state.split('.');
    const sig = parts[parts.length - 1]!;
    const flipped = sig[0] === 'a' ? 'b' : 'a';
    parts[parts.length - 1] = flipped + sig.slice(1);
    expect(parseOAuthState(parts.join('.')).valid).toBe(false);
  });
});

describe('Discord avatar URLs', () => {
  it('builds png and gif avatar URLs with size param', async () => {
    const { getAvatarUrl } = await import('../src/server/auth.js');
    expect(getAvatarUrl({
      id: '123456789012345678',
      username: 'test',
      discriminator: '0',
      avatar: 'abc123hash',
      isAdmin: false,
    })).toBe('https://cdn.discordapp.com/avatars/123456789012345678/abc123hash.png?size=128');

    expect(getAvatarUrl({
      id: '123456789012345678',
      username: 'test',
      discriminator: '0',
      avatar: 'a_animatedhash',
      isAdmin: false,
    })).toContain('.gif?size=128');
  });

  it('falls back to default embed avatar when no hash', async () => {
    const { getAvatarUrl } = await import('../src/server/auth.js');
    const url = getAvatarUrl({
      id: '123456789012345678',
      username: 'test',
      discriminator: '0',
      avatar: null,
      isAdmin: false,
    });
    expect(url).toContain('/embed/avatars/');
  });
});
