import { createHash, randomBytes } from 'crypto';
import type { Response, Request } from 'express';
import type { DashboardUser } from '../shared/types.js';
import { getDatabase } from '../database/index.js';

const REMEMBER_COOKIE = 'method.remember';
const REMEMBER_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function ensureRememberTable(): void {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS remember_tokens (
      token_hash TEXT PRIMARY KEY,
      user_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_remember_expires ON remember_tokens(expires_at);
  `);
}

export function purgeExpiredRememberTokens(): number {
  ensureRememberTable();
  const result = getDatabase()
    .prepare('DELETE FROM remember_tokens WHERE expires_at <= ?')
    .run(Date.now());
  return result.changes;
}

export function createRememberToken(user: DashboardUser): string {
  ensureRememberTable();
  purgeExpiredRememberTokens();
  const raw = randomBytes(32).toString('base64url');
  const now = new Date().toISOString();
  getDatabase().prepare(`
    INSERT INTO remember_tokens (token_hash, user_json, expires_at, created_at)
    VALUES (@hash, @userJson, @expiresAt, @createdAt)
  `).run({
    hash: hashToken(raw),
    userJson: JSON.stringify(user),
    expiresAt: Date.now() + REMEMBER_MAX_AGE_MS,
    createdAt: now,
  });
  return raw;
}

export function verifyRememberToken(raw: string | undefined): DashboardUser | null {
  if (!raw?.trim()) return null;
  ensureRememberTable();
  const row = getDatabase().prepare(`
    SELECT user_json FROM remember_tokens
    WHERE token_hash = ? AND expires_at > ?
  `).get(hashToken(raw.trim()), Date.now()) as { user_json: string } | undefined;
  if (!row?.user_json) return null;
  try {
    return JSON.parse(row.user_json) as DashboardUser;
  } catch {
    return null;
  }
}

export function revokeRememberToken(raw: string | undefined): void {
  if (!raw?.trim()) return;
  ensureRememberTable();
  getDatabase().prepare('DELETE FROM remember_tokens WHERE token_hash = ?').run(hashToken(raw.trim()));
}

export function rememberCookieName(): string {
  return REMEMBER_COOKIE;
}

export function rememberCookieOptions(maxAge = REMEMBER_MAX_AGE_MS): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function setRememberCookie(res: Response, token: string): void {
  res.cookie(REMEMBER_COOKIE, token, rememberCookieOptions());
}

export function clearRememberCookie(res: Response): void {
  res.clearCookie(REMEMBER_COOKIE, rememberCookieOptions(0));
}

/** Restore session.user from persistent remember cookie when express session was lost. */
export function tryRestoreSessionFromRemember(req: Request, res: Response): Promise<boolean> {
  if (req.session.user) return Promise.resolve(true);
  const raw = req.cookies?.[REMEMBER_COOKIE] as string | undefined;
  const user = verifyRememberToken(raw);
  if (!user) {
    if (raw) clearRememberCookie(res);
    return Promise.resolve(false);
  }
  req.session.user = user;
  const days = parseInt(process.env.SESSION_MAX_AGE_DAYS ?? '30', 10);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;
  req.session.cookie.maxAge = safeDays * 24 * 60 * 60 * 1000;
  return new Promise((resolve) => {
    req.session.save((err) => resolve(!err));
  });
}
