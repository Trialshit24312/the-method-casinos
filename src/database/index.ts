import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import type { Casino, CasinoInput, SearchFilters, Stats, CasinoFeature, BlockedSite, BlockedSiteInput } from '../shared/types.js';
import { normalizeUrl, ensureHttps } from '../shared/utils.js';
import { resolveRating } from '../shared/rating.js';
import { normalizeTrackables } from '../shared/trackables.js';
import { rankSimilarCasinos, type SimilarCasinoMatch } from '../shared/similarity.js';
import { VERIFIED_CASINO_SEEDS } from '../shared/verified-casinos.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'casinos.db');

let db: Database.Database;

export function initDatabase(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS casinos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      url_normalized TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      features TEXT NOT NULL DEFAULT '[]',
      signup_requirements TEXT NOT NULL DEFAULT '[]',
      bonus_info TEXT NOT NULL DEFAULT '',
      rating REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      verified INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_checked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_casinos_url_normalized ON casinos(url_normalized);
    CREATE INDEX IF NOT EXISTS idx_casinos_active ON casinos(active);
    CREATE INDEX IF NOT EXISTS idx_casinos_verified ON casinos(verified);

    CREATE TABLE IF NOT EXISTS discovery_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ran_at TEXT NOT NULL,
      found INTEGER NOT NULL DEFAULT 0,
      added INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      errors TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocked_sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      url_normalized TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL DEFAULT 'scam',
      severity TEXT NOT NULL DEFAULT 'high',
      description TEXT NOT NULL DEFAULT '',
      reported_by TEXT NOT NULL DEFAULT 'admin',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_blocked_url_normalized ON blocked_sites(url_normalized);
    CREATE INDEX IF NOT EXISTS idx_blocked_active ON blocked_sites(active);

    CREATE TABLE IF NOT EXISTS discovery_seen (
      url_normalized TEXT PRIMARY KEY,
      outcome TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      last_seen_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_discovery_seen_at ON discovery_seen(last_seen_at);
  `);

  migrateSchema();
  seedInitialCasinos();
  seedBlockedSites();
  backfillMissingRatings();
  backfillVpnFeatures();
  return db;
}

function migrateSchema(): void {
  const cols = db.prepare('PRAGMA table_info(casinos)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));

  if (!names.has('cash_out_before_blocked')) {
    db.exec('ALTER TABLE casinos ADD COLUMN cash_out_before_blocked REAL');
  }
  if (!names.has('trackables')) {
    db.exec("ALTER TABLE casinos ADD COLUMN trackables TEXT NOT NULL DEFAULT '[]'");
  }
}

function backfillMissingRatings(): void {
  const rows = db.prepare('SELECT id, features, verified, source, rating FROM casinos WHERE rating <= 0').all() as {
    id: string;
    features: string;
    verified: number;
    source: string;
    rating: number;
  }[];

  if (!rows.length) return;

  const stmt = db.prepare('UPDATE casinos SET rating = @rating, updated_at = @updatedAt WHERE id = @id');
  const now = new Date().toISOString();

  for (const row of rows) {
    const features = JSON.parse(row.features) as CasinoFeature[];
    const rating = resolveRating(0, features, {
      verified: Boolean(row.verified),
      source: row.source,
    });
    stmt.run({ id: row.id, rating, updatedAt: now });
  }
}

const VPN_BLOCKED_NAMES = ['stake.us', 'stake us'];

function backfillVpnFeatures(): void {
  const rows = db.prepare('SELECT id, name, features FROM casinos').all() as {
    id: string;
    name: string;
    features: string;
  }[];

  const stmt = db.prepare('UPDATE casinos SET features = @features, updated_at = @updatedAt WHERE id = @id');
  const now = new Date().toISOString();

  for (const row of rows) {
    const features = JSON.parse(row.features) as CasinoFeature[];
    const hasVpnTag = features.some((f) =>
      f === 'vpn_allowed' || f === 'vpn_blocked' || f === 'geo_restricted',
    );
    if (hasVpnTag) continue;

    const nameLower = row.name.toLowerCase();
    const isKnownBlocker = VPN_BLOCKED_NAMES.some((n) => nameLower.includes(n.replace('.', '')) || nameLower.includes('stake'));

    if (isKnownBlocker) {
      features.push('vpn_blocked', 'geo_restricted');
    } else if (features.includes('sweepstakes')) {
      features.push('vpn_allowed');
    }

    stmt.run({ id: row.id, features: JSON.stringify([...new Set(features)]), updatedAt: now });
  }
}

function rowToCasino(row: Record<string, unknown>): Casino {
  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    urlNormalized: row.url_normalized as string,
    description: row.description as string,
    features: JSON.parse(row.features as string),
    signupRequirements: JSON.parse(row.signup_requirements as string),
    bonusInfo: row.bonus_info as string,
    cashOutBeforeBlocked: row.cash_out_before_blocked != null ? (row.cash_out_before_blocked as number) : null,
    trackables: row.trackables ? JSON.parse(row.trackables as string) : [],
    rating: row.rating as number,
    source: row.source as string,
    verified: Boolean(row.verified),
    active: Boolean(row.active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastCheckedAt: (row.last_checked_at as string) || null,
  };
}

function seedInitialCasinos(): void {
  const count = db.prepare('SELECT COUNT(*) as c FROM casinos').get() as { c: number };
  if (count.c > 0) return;
  insertVerifiedCasinos('seed');
}

function insertVerifiedCasinos(source: string): number {
  let added = 0;
  for (const seed of VERIFIED_CASINO_SEEDS) {
    const casino = addCasino({ ...seed, source, verified: true });
    if (casino) added++;
  }
  return added;
}

/** Wipe all casinos & blocked sites, reload verified catalog only. */
export function resetCatalogToVerified(): {
  casinosRemoved: number;
  blockedRemoved: number;
  casinosAdded: number;
} {
  const casinosBefore = db.prepare('SELECT COUNT(*) as c FROM casinos').get() as { c: number };
  const blockedBefore = db.prepare('SELECT COUNT(*) as c FROM blocked_sites').get() as { c: number };

  db.prepare('DELETE FROM casinos').run();
  db.prepare('DELETE FROM blocked_sites').run();
  db.prepare('DELETE FROM discovery_log').run();

  const casinosAdded = insertVerifiedCasinos('verified');

  return {
    casinosRemoved: casinosBefore.c,
    blockedRemoved: blockedBefore.c,
    casinosAdded,
  };
}

export function addCasino(input: CasinoInput): Casino | null {
  const url = ensureHttps(input.url);
  const urlNormalized = normalizeUrl(url);
  const now = new Date().toISOString();

  if (isUrlBlocked(url)) return null;

  const existing = db.prepare('SELECT id FROM casinos WHERE url_normalized = ?').get(urlNormalized);
  if (existing) return null;

  const casino: Casino = {
    id: nanoid(12),
    name: input.name,
    url,
    urlNormalized,
    description: input.description || '',
    features: input.features || [],
    signupRequirements: input.signupRequirements || [],
    bonusInfo: input.bonusInfo || '',
    cashOutBeforeBlocked: input.cashOutBeforeBlocked ?? null,
    trackables: normalizeTrackables(input.trackables),
    rating: resolveRating(input.rating, input.features || [], {
      verified: input.verified,
      source: input.source,
    }),
    source: input.source || 'manual',
    verified: input.verified ?? false,
    active: true,
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: null,
  };

  db.prepare(`
    INSERT INTO casinos (id, name, url, url_normalized, description, features, signup_requirements,
      bonus_info, cash_out_before_blocked, trackables, rating, source, verified, active, created_at, updated_at)
    VALUES (@id, @name, @url, @urlNormalized, @description, @features, @signupRequirements,
      @bonusInfo, @cashOutBeforeBlocked, @trackables, @rating, @source, @verified, @active, @createdAt, @updatedAt)
  `).run({
    ...casino,
    features: JSON.stringify(casino.features),
    signupRequirements: JSON.stringify(casino.signupRequirements),
    trackables: JSON.stringify(casino.trackables),
    verified: casino.verified ? 1 : 0,
    active: 1,
  });

  return casino;
}

export function updateCasino(id: string, input: Partial<CasinoInput>): Casino | null {
  const existing = getCasinoById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: Casino = {
    ...existing,
    name: input.name ?? existing.name,
    url: input.url ? ensureHttps(input.url) : existing.url,
    urlNormalized: input.url ? normalizeUrl(ensureHttps(input.url)) : existing.urlNormalized,
    description: input.description ?? existing.description,
    features: input.features ?? existing.features,
    signupRequirements: input.signupRequirements ?? existing.signupRequirements,
    bonusInfo: input.bonusInfo ?? existing.bonusInfo,
    cashOutBeforeBlocked: input.cashOutBeforeBlocked !== undefined
      ? input.cashOutBeforeBlocked
      : existing.cashOutBeforeBlocked,
    trackables: input.trackables !== undefined
      ? normalizeTrackables(input.trackables)
      : existing.trackables,
    rating: input.rating ?? existing.rating,
    verified: input.verified ?? existing.verified,
    updatedAt: now,
  };

  db.prepare(`
    UPDATE casinos SET name=@name, url=@url, url_normalized=@urlNormalized, description=@description,
      features=@features, signup_requirements=@signupRequirements, bonus_info=@bonusInfo,
      cash_out_before_blocked=@cashOutBeforeBlocked, trackables=@trackables,
      rating=@rating, verified=@verified, updated_at=@updatedAt
    WHERE id=@id
  `).run({
    id,
    name: updated.name,
    url: updated.url,
    urlNormalized: updated.urlNormalized,
    description: updated.description,
    features: JSON.stringify(updated.features),
    signupRequirements: JSON.stringify(updated.signupRequirements),
    bonusInfo: updated.bonusInfo,
    cashOutBeforeBlocked: updated.cashOutBeforeBlocked,
    trackables: JSON.stringify(updated.trackables),
    rating: updated.rating,
    verified: updated.verified ? 1 : 0,
    updatedAt: updated.updatedAt,
  });

  return updated;
}

export function deleteCasino(id: string): boolean {
  const result = db.prepare('DELETE FROM casinos WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getCasinoById(id: string): Casino | null {
  const row = db.prepare('SELECT * FROM casinos WHERE id = ?').get(id);
  return row ? rowToCasino(row as Record<string, unknown>) : null;
}

export function searchCasinos(filters: SearchFilters = {}): Casino[] {
  const conditions: string[] = ['active = 1'];
  const params: Record<string, unknown> = {};

  if (filters.query) {
    conditions.push('(name LIKE @query OR description LIKE @query OR url LIKE @query)');
    params.query = `%${filters.query}%`;
  }

  if (filters.noPhone) {
    conditions.push("features LIKE '%no_phone%'");
  }

  if (filters.emailOnly) {
    conditions.push("features LIKE '%email_only%'");
  }

  if (filters.verifiedOnly) {
    conditions.push('verified = 1');
  }

  if (filters.vpnAllowed) {
    conditions.push("features LIKE '%vpn_allowed%'");
  }

  if (filters.features?.length) {
    for (let i = 0; i < filters.features.length; i++) {
      conditions.push(`features LIKE @feat${i}`);
      params[`feat${i}`] = `%${filters.features[i]}%`;
    }
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const sql = `
    SELECT * FROM casinos
    WHERE ${conditions.join(' AND ')}
    ORDER BY rating DESC, name ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rows = db.prepare(sql).all(params);
  return rows.map((r) => rowToCasino(r as Record<string, unknown>));
}

export function getRandomCasino(filters: SearchFilters = {}): Casino | null {
  const results = searchCasinos({ ...filters, limit: 100 });
  if (!results.length) return null;
  return results[Math.floor(Math.random() * results.length)];
}

export function getAllCasinos(): Casino[] {
  const rows = db.prepare('SELECT * FROM casinos WHERE active = 1 ORDER BY rating DESC').all();
  return rows.map((r) => rowToCasino(r as Record<string, unknown>));
}

export function findSimilarCasinos(casinoId: string, limit = 8): { source: Casino; matches: SimilarCasinoMatch[] } | null {
  const source = getCasinoById(casinoId);
  if (!source) return null;
  const all = getAllCasinos();
  return { source, matches: rankSimilarCasinos(source, all, limit) };
}

export function findSimilarCasinosByQuery(query: string, limit = 8): { source: Casino; matches: SimilarCasinoMatch[] } | null {
  const results = searchCasinos({ query, limit: 1 });
  if (!results.length) return null;
  return findSimilarCasinos(results[0].id, limit);
}

export function getKnownUrls(): Set<string> {
  const rows = db.prepare('SELECT url_normalized FROM casinos').all() as { url_normalized: string }[];
  return new Set(rows.map((r) => r.url_normalized));
}

/** URLs already scanned and rejected/skipped — skip re-checking every run. */
export function getDiscoverySeenUrls(): Set<string> {
  const rows = db.prepare('SELECT url_normalized FROM discovery_seen').all() as { url_normalized: string }[];
  return new Set(rows.map((r) => r.url_normalized));
}

export function markDiscoverySeen(url: string, outcome: string, reason = ''): void {
  const urlNormalized = normalizeUrl(ensureHttps(url));
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO discovery_seen (url_normalized, outcome, reason, last_seen_at)
    VALUES (@urlNormalized, @outcome, @reason, @lastSeenAt)
    ON CONFLICT(url_normalized) DO UPDATE SET
      outcome = excluded.outcome,
      reason = excluded.reason,
      last_seen_at = excluded.last_seen_at
  `).run({ urlNormalized, outcome, reason, lastSeenAt: now });
}

export function clearDiscoverySeen(): number {
  const result = db.prepare('DELETE FROM discovery_seen').run();
  return result.changes;
}

export function urlExists(url: string): boolean {
  const normalized = normalizeUrl(url);
  const row = db.prepare('SELECT id FROM casinos WHERE url_normalized = ?').get(normalized);
  return Boolean(row);
}

export function getStats(): Stats {
  const total = db.prepare('SELECT COUNT(*) as c FROM casinos WHERE active = 1').get() as { c: number };
  const verified = db.prepare('SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND verified = 1').get() as { c: number };
  const noPhone = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%no_phone%'").get() as { c: number };
  const emailOnly = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%email_only%'").get() as { c: number };
  const slots = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%slots%'").get() as { c: number };
  const live = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%live_games%'").get() as { c: number };
  const vpnAllowed = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%vpn_allowed%'").get() as { c: number };
  const vpnBlocked = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%vpn_blocked%'").get() as { c: number };
  const blockedSites = db.prepare('SELECT COUNT(*) as c FROM blocked_sites WHERE active = 1').get() as { c: number };
  const lastDiscovery = db.prepare('SELECT ran_at FROM discovery_log ORDER BY id DESC LIMIT 1').get() as { ran_at: string } | undefined;

  return {
    totalCasinos: total.c,
    verifiedCasinos: verified.c,
    noPhoneCasinos: noPhone.c,
    emailOnlyCasinos: emailOnly.c,
    withSlots: slots.c,
    withLiveGames: live.c,
    vpnAllowedCasinos: vpnAllowed.c,
    vpnBlockedCasinos: vpnBlocked.c,
    blockedSites: blockedSites.c,
    lastDiscoveryAt: lastDiscovery?.ran_at ?? null,
  };
}

export function logDiscovery(found: number, added: number, skipped: number, errors: string[]): void {
  db.prepare(`
    INSERT INTO discovery_log (ran_at, found, added, skipped, errors)
    VALUES (@ranAt, @found, @added, @skipped, @errors)
  `).run({
    ranAt: new Date().toISOString(),
    found,
    added,
    skipped,
    errors: JSON.stringify(errors),
  });
}

export function getDatabase(): Database.Database {
  return db;
}

function rowToBlockedSite(row: Record<string, unknown>): BlockedSite {
  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    urlNormalized: row.url_normalized as string,
    reason: row.reason as BlockedSite['reason'],
    severity: row.severity as BlockedSite['severity'],
    description: row.description as string,
    reportedBy: row.reported_by as string,
    active: Boolean(row.active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function seedBlockedSites(): void {
  // Intentionally empty — blocked sites are admin-added only (no fabricated example URLs).
}

export function getBlockedUrls(): Set<string> {
  const rows = db.prepare('SELECT url_normalized FROM blocked_sites WHERE active = 1').all() as { url_normalized: string }[];
  return new Set(rows.map((r) => r.url_normalized));
}

export function isUrlBlocked(url: string): boolean {
  const normalized = normalizeUrl(ensureHttps(url));
  const row = db.prepare('SELECT id FROM blocked_sites WHERE url_normalized = ? AND active = 1').get(normalized);
  return Boolean(row);
}

export function getAllBlockedSites(): BlockedSite[] {
  const rows = db.prepare('SELECT * FROM blocked_sites WHERE active = 1 ORDER BY severity DESC, created_at DESC').all();
  return rows.map((r) => rowToBlockedSite(r as Record<string, unknown>));
}

export function searchBlockedSites(query?: string): BlockedSite[] {
  if (!query?.trim()) return getAllBlockedSites();
  const rows = db.prepare(`
    SELECT * FROM blocked_sites WHERE active = 1
    AND (name LIKE @q OR url LIKE @q OR description LIKE @q OR reason LIKE @q)
    ORDER BY severity DESC, created_at DESC
  `).all({ q: `%${query.trim()}%` });
  return rows.map((r) => rowToBlockedSite(r as Record<string, unknown>));
}

export function getBlockedSiteById(id: string): BlockedSite | null {
  const row = db.prepare('SELECT * FROM blocked_sites WHERE id = ?').get(id);
  return row ? rowToBlockedSite(row as Record<string, unknown>) : null;
}

export function addBlockedSite(input: BlockedSiteInput): BlockedSite | null {
  const url = ensureHttps(input.url);
  const urlNormalized = normalizeUrl(url);
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM blocked_sites WHERE url_normalized = ?').get(urlNormalized);
  if (existing) return null;

  const site: BlockedSite = {
    id: nanoid(12),
    name: input.name,
    url,
    urlNormalized,
    reason: input.reason,
    severity: input.severity ?? 'high',
    description: input.description || '',
    reportedBy: input.reportedBy || 'admin',
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO blocked_sites (id, name, url, url_normalized, reason, severity, description, reported_by, active, created_at, updated_at)
    VALUES (@id, @name, @url, @urlNormalized, @reason, @severity, @description, @reportedBy, 1, @createdAt, @updatedAt)
  `).run({
    ...site,
    reportedBy: site.reportedBy,
  });

  if (input.removeCasino) {
    db.prepare('DELETE FROM casinos WHERE url_normalized = ?').run(urlNormalized);
  }

  return site;
}

export function updateBlockedSite(id: string, input: Partial<BlockedSiteInput>): BlockedSite | null {
  const existing = getBlockedSiteById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: BlockedSite = {
    ...existing,
    name: input.name ?? existing.name,
    url: input.url ? ensureHttps(input.url) : existing.url,
    urlNormalized: input.url ? normalizeUrl(ensureHttps(input.url)) : existing.urlNormalized,
    reason: input.reason ?? existing.reason,
    severity: input.severity ?? existing.severity,
    description: input.description ?? existing.description,
    reportedBy: input.reportedBy ?? existing.reportedBy,
    updatedAt: now,
  };

  db.prepare(`
    UPDATE blocked_sites SET name=@name, url=@url, url_normalized=@urlNormalized,
      reason=@reason, severity=@severity, description=@description, reported_by=@reportedBy, updated_at=@updatedAt
    WHERE id=@id
  `).run({
    id,
    name: updated.name,
    url: updated.url,
    urlNormalized: updated.urlNormalized,
    reason: updated.reason,
    severity: updated.severity,
    description: updated.description,
    reportedBy: updated.reportedBy,
    updatedAt: updated.updatedAt,
  });

  if (input.removeCasino) {
    db.prepare('DELETE FROM casinos WHERE url_normalized = ?').run(updated.urlNormalized);
  }

  return updated;
}

export function deleteBlockedSite(id: string): boolean {
  const result = db.prepare('DELETE FROM blocked_sites WHERE id = ?').run(id);
  return result.changes > 0;
}

export function removeCasinoByUrl(url: string): boolean {
  const normalized = normalizeUrl(ensureHttps(url));
  const result = db.prepare('DELETE FROM casinos WHERE url_normalized = ?').run(normalized);
  return result.changes > 0;
}

export function getCasinoByUrl(url: string): Casino | null {
  const normalized = normalizeUrl(ensureHttps(url));
  const row = db.prepare('SELECT * FROM casinos WHERE url_normalized = ? AND active = 1').get(normalized);
  return row ? rowToCasino(row as Record<string, unknown>) : null;
}

export function getBlockedSiteByUrl(url: string): BlockedSite | null {
  const normalized = normalizeUrl(ensureHttps(url));
  const row = db.prepare('SELECT * FROM blocked_sites WHERE url_normalized = ? AND active = 1').get(normalized);
  return row ? rowToBlockedSite(row as Record<string, unknown>) : null;
}
