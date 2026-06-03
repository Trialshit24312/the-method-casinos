import session, { type SessionData, Store } from 'express-session';
import type { Session } from 'express-session';
import { getDatabase } from '../database/index.js';

type SessionRecord = SessionData & { cookie?: Session['cookie'] };

const DEFAULT_SESSION_MS = (() => {
  const days = parseInt(process.env.SESSION_MAX_AGE_DAYS ?? '30', 10);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;
  return safeDays * 24 * 60 * 60 * 1000;
})();

export class SqliteSessionStore extends Store {
  constructor() {
    super();
    getDatabase().exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expired INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);
    `);
    this.purgeExpired();
  }

  purgeExpired(): number {
    try {
      const result = getDatabase().prepare('DELETE FROM sessions WHERE expired <= ?').run(Date.now());
      return result.changes;
    } catch {
      return 0;
    }
  }

  get(sid: string, callback: (err?: unknown, session?: SessionRecord | null) => void): void {
    try {
      const row = getDatabase().prepare(
        'SELECT sess FROM sessions WHERE sid = ? AND expired > ?',
      ).get(sid, Date.now()) as { sess: string } | undefined;
      if (!row) {
        callback(null, null);
        return;
      }
      const session = JSON.parse(row.sess) as SessionRecord;
      const maxAge = session.cookie?.maxAge ?? DEFAULT_SESSION_MS;
      if (session.cookie) {
        session.cookie.maxAge = maxAge;
        session.cookie.expires = new Date(Date.now() + maxAge);
      }
      this.set(sid, session);
      callback(null, session);
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, session: SessionRecord, callback?: (err?: unknown) => void): void {
    try {
      const expired = session.cookie?.expires
        ? new Date(session.cookie.expires).getTime()
        : Date.now() + (session.cookie?.maxAge ?? DEFAULT_SESSION_MS);
      getDatabase().prepare(`
        INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired
      `).run(sid, JSON.stringify(session), expired);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      getDatabase().prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, session: SessionRecord, callback?: (err?: unknown) => void): void {
    this.set(sid, session, callback);
  }
}
