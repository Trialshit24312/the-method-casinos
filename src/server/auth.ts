import type { Request, Response, NextFunction } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { DashboardUser } from '../shared/types.js';
import { parseAdminIds } from '../shared/utils.js';
import { getDiscordRedirectUri } from '../shared/site.js';

declare module 'express-session' {
  interface SessionData {
    user?: DashboardUser;
    loginRedirect?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user?.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

const DISCORD_API = 'https://discord.com/api/v10';

function oauthSecret(): string {
  return process.env.SESSION_SECRET || 'dev-secret-change-me';
}

/** Signed state — carries optional post-login path without relying on session cookies. */
export function createOAuthState(nextPath?: string): string {
  const nonce = randomBytes(16).toString('hex');
  const safeNext =
    nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '';
  const payload = safeNext ? `${nonce}|${safeNext}` : nonce;
  const sig = createHmac('sha256', oauthSecret()).update(payload).digest('hex');
  if (!safeNext) return `${nonce}.${sig}`;
  const nextEnc = Buffer.from(safeNext, 'utf8').toString('base64url');
  return `${nonce}.${nextEnc}.${sig}`;
}

export function verifyOAuthState(state: string): boolean {
  return parseOAuthState(state).valid;
}

export function parseOAuthState(state: string): { valid: boolean; next?: string } {
  const parts = state.split('.');
  if (parts.length === 2) {
    const [nonce, sig] = parts;
    if (!nonce || !sig || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(sig)) {
      return { valid: false };
    }
    const expected = createHmac('sha256', oauthSecret()).update(nonce).digest('hex');
    try {
      const valid = timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
      return { valid };
    } catch {
      return { valid: false };
    }
  }

  if (parts.length === 3) {
    const [nonce, nextEnc, sig] = parts;
    if (!nonce || !nextEnc || !sig || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(sig)) {
      return { valid: false };
    }
    let nextPath = '';
    try {
      nextPath = Buffer.from(nextEnc, 'base64url').toString('utf8');
    } catch {
      return { valid: false };
    }
    if (!nextPath.startsWith('/') || nextPath.startsWith('//')) {
      return { valid: false };
    }
    const payload = `${nonce}|${nextPath}`;
    const expected = createHmac('sha256', oauthSecret()).update(payload).digest('hex');
    try {
      const valid = timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
      return valid ? { valid: true, next: nextPath } : { valid: false };
    } catch {
      return { valid: false };
    }
  }

  return { valid: false };
}

export async function exchangeCode(code: string): Promise<DashboardUser> {
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
  const redirectUri = getDiscordRedirectUri();

  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Failed to exchange OAuth code: ${body}`);
  }

  const tokens = (await tokenRes.json()) as { access_token: string };

  const userRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error('Failed to fetch Discord user');
  }

  const user = (await userRes.json()) as {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  };

  const admins = parseAdminIds(process.env.ADMIN_DISCORD_IDS);

  return {
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
    avatar: user.avatar,
    isAdmin: admins.has(user.id),
  };
}

export function getDiscordAuthUrl(state: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const redirectUri = getDiscordRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export function getAvatarUrl(user: DashboardUser): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }
  const index = Number(BigInt(user.id) >> 22n) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
