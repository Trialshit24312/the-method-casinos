import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import type { Casino, CasinoInput, SearchFilters, Stats, CasinoFeature, BlockedSite, BlockedSiteInput, BlockReason, ReviewStatus, SiteReport, SiteReportInput, CatalogHealthStatus } from '../shared/types.js';
import { normalizeUrl, ensureHttps, casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import { resolveRating } from '../shared/rating.js';
import { normalizeTrackables } from '../shared/trackables.js';
import { rankSimilarCasinos, type SimilarCasinoMatch } from '../shared/similarity.js';
import { STALE_CATALOG_DAYS } from '../shared/freshness.js';
import { VERIFIED_CASINO_SEEDS } from '../shared/verified-casinos.js';
import { getDataDir, getDbPath, maybeMigrateLegacyDatabase } from '../shared/data-path.js';
import { logPersistenceStatus } from '../shared/persistence.js';
import { commitCatalogWrite, commitCatalogWriteAndWait, registerCatalogDatabase } from '../shared/catalog-persist.js';
import type { DiscoveryLiveStats, DiscoveryProgressEvent, DiscoveryResult } from '../shared/types.js';

let db: Database.Database;

export function initDatabase(): Database.Database {
  const dataDir = getDataDir();
  maybeMigrateLegacyDatabase(dataDir);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'casinos.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
  registerCatalogDatabase(() => db);
  logPersistenceStatus();

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
      review_status TEXT NOT NULL DEFAULT 'approved',
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

    CREATE TABLE IF NOT EXISTS discovery_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_reports (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      url_normalized TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      reported_by TEXT NOT NULL DEFAULT 'anonymous',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_site_reports_status ON site_reports(status);
  `);

  migrateSchema();
  seedInitialCasinos();
  seedBlockedSites();
  backfillMissingRatings();
  backfillVpnFeatures();
  recoverDiscoveryLiveOnBoot();
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
  if (!names.has('review_status')) {
    db.exec("ALTER TABLE casinos ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved'");
    db.exec("UPDATE casinos SET review_status = 'pending' WHERE verified = 0 AND source IN ('web_scan', 'discovery')");
    db.exec("UPDATE casinos SET review_status = 'approved' WHERE verified = 1");
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_casinos_review_status ON casinos(review_status)');

  if (!names.has('approved_by')) {
    db.exec('ALTER TABLE casinos ADD COLUMN approved_by TEXT');
  }
  if (!names.has('approved_at')) {
    db.exec('ALTER TABLE casinos ADD COLUMN approved_at TEXT');
  }
  db.exec(`
    UPDATE casinos
    SET approved_at = COALESCE(approved_at, created_at)
    WHERE verified = 1 AND review_status = 'approved' AND approved_at IS NULL
  `);
  if (!names.has('health_status')) {
    db.exec("ALTER TABLE casinos ADD COLUMN health_status TEXT NOT NULL DEFAULT 'ok'");
  }
  if (!names.has('health_note')) {
    db.exec("ALTER TABLE casinos ADD COLUMN health_note TEXT NOT NULL DEFAULT ''");
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_site_reports_open_host
    ON site_reports(url_normalized) WHERE status = 'open'
  `);

  const reportCols = db.prepare('PRAGMA table_info(site_reports)').all() as { name: string }[];
  const reportNames = new Set(reportCols.map((c) => c.name));
  if (!reportNames.has('reviewed_at')) {
    db.exec('ALTER TABLE site_reports ADD COLUMN reviewed_at TEXT');
  }
  if (!reportNames.has('reviewed_by')) {
    db.exec('ALTER TABLE site_reports ADD COLUMN reviewed_by TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id TEXT NOT NULL,
      casino_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, casino_id),
      FOREIGN KEY (casino_id) REFERENCES casinos(id) ON DELETE CASCADE
    );
  `);
  const favCols = db.prepare('PRAGMA table_info(user_favorites)').all() as { name: string }[];
  if (!favCols.some((c) => c.name === 'note')) {
    db.exec('ALTER TABLE user_favorites ADD COLUMN note TEXT');
  }

  const logCols = db.prepare('PRAGMA table_info(discovery_log)').all() as { name: string }[];
  const logNames = new Set(logCols.map((c) => c.name));
  if (!logNames.has('mode')) {
    db.exec("ALTER TABLE discovery_log ADD COLUMN mode TEXT NOT NULL DEFAULT 'quick'");
  }
  if (!logNames.has('rejected')) {
    db.exec('ALTER TABLE discovery_log ADD COLUMN rejected INTEGER NOT NULL DEFAULT 0');
  }
  if (!logNames.has('blocked')) {
    db.exec('ALTER TABLE discovery_log ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0');
  }
  if (!logNames.has('duration_ms')) {
    db.exec('ALTER TABLE discovery_log ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 0');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS discovery_live (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      running INTEGER NOT NULL DEFAULT 0,
      mode TEXT,
      started_at INTEGER,
      phase_label TEXT NOT NULL DEFAULT '',
      stats_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT,
      updated_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO discovery_live (id, running, phase_label, stats_json, updated_at)
    VALUES (1, 0, '', '{}', datetime('now'));

    CREATE TABLE IF NOT EXISTS discovery_live_events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      event_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_discovery_live_events_seq ON discovery_live_events(seq);

    CREATE TABLE IF NOT EXISTS discovery_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Normalize legacy url_normalized values to hostname keys
  const legacyRows = db.prepare('SELECT id, url, url_normalized FROM casinos').all() as {
    id: string;
    url: string;
    url_normalized: string;
  }[];
  const normStmt = db.prepare('UPDATE casinos SET url_normalized = ?, url = ? WHERE id = ?');
  for (const row of legacyRows) {
    const root = toCasinoRootUrl(row.url);
    const host = casinoHostKey(root);
    if (row.url_normalized !== host || row.url !== root) {
      normStmt.run(host, root, row.id);
    }
  }

  const blockedRows = db.prepare('SELECT id, url, url_normalized FROM blocked_sites').all() as {
    id: string;
    url: string;
    url_normalized: string;
  }[];
  const blockNorm = db.prepare('UPDATE blocked_sites SET url_normalized = ?, url = ? WHERE id = ?');
  for (const row of blockedRows) {
    const root = toCasinoRootUrl(row.url);
    const host = casinoHostKey(root);
    if (row.url_normalized !== host || row.url !== root) {
      blockNorm.run(host, root, row.id);
    }
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
    reviewStatus: (row.review_status as ReviewStatus) || 'approved',
    active: Boolean(row.active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    approvedAt: (row.approved_at as string) || null,
    lastCheckedAt: (row.last_checked_at as string) || null,
    healthStatus: ((row.health_status as string) || 'ok') as Casino['healthStatus'],
    healthNote: (row.health_note as string) || '',
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

/** Wipe casinos, reload verified catalog. Blocklist preserved unless preserveBlocklist=false. */
export function resetCatalogToVerified(options: { preserveBlocklist?: boolean } = {}): {
  casinosRemoved: number;
  blockedRemoved: number;
  casinosAdded: number;
} {
  const preserveBlocklist = options.preserveBlocklist !== false;
  const casinosBefore = db.prepare('SELECT COUNT(*) as c FROM casinos').get() as { c: number };
  const blockedBefore = db.prepare('SELECT COUNT(*) as c FROM blocked_sites').get() as { c: number };

  db.prepare('DELETE FROM casinos').run();
  if (!preserveBlocklist) {
    db.prepare('DELETE FROM blocked_sites').run();
  }
  db.prepare('DELETE FROM discovery_log').run();

  const casinosAdded = insertVerifiedCasinos('verified');

  return {
    casinosRemoved: casinosBefore.c,
    blockedRemoved: preserveBlocklist ? 0 : blockedBefore.c,
    casinosAdded,
  };
}

export function addCasino(input: CasinoInput): Casino | null {
  const url = toCasinoRootUrl(ensureHttps(input.url));
  const host = casinoHostKey(url);
  if (!isValidCasinoHost(host)) return null;

  const urlNormalized = host;
  const now = new Date().toISOString();

  if (isUrlBlocked(url)) return null;

  const existingRow = db.prepare('SELECT * FROM casinos WHERE url_normalized = ?').get(urlNormalized) as
    | Record<string, unknown>
    | undefined;
  if (existingRow) {
    const existing = rowToCasino(existingRow);
    const wantsPending = (input.reviewStatus ?? (input.verified ? 'approved' : 'pending')) === 'pending';
    if (wantsPending && existing.reviewStatus === 'pending' && existing.active) {
      commitCatalogWrite('addCasino:existing-pending');
      return existing;
    }
    return null;
  }

  const hostDuplicate = db.prepare('SELECT url FROM casinos').all() as { url: string }[];
  if (hostDuplicate.some((row) => casinoHostKey(row.url) === host)) {
    const match = hostDuplicate.find((row) => casinoHostKey(row.url) === host);
    if (match) {
      const row = db.prepare('SELECT * FROM casinos WHERE url = ?').get(match.url) as Record<string, unknown> | undefined;
      if (row) {
        const existing = rowToCasino(row);
        if (existing.reviewStatus === 'pending' && existing.active) {
          commitCatalogWrite('addCasino:host-duplicate-pending');
          return existing;
        }
      }
    }
    return null;
  }

  const reviewStatus: ReviewStatus = input.reviewStatus
    ?? (input.verified ? 'approved' : 'pending');

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
    reviewStatus,
    active: reviewStatus !== 'rejected',
    createdAt: now,
    updatedAt: now,
    approvedAt: reviewStatus === 'approved' ? now : null,
    lastCheckedAt: null,
    healthStatus: 'ok',
    healthNote: '',
  };

  db.prepare(`
    INSERT INTO casinos (id, name, url, url_normalized, description, features, signup_requirements,
      bonus_info, cash_out_before_blocked, trackables, rating, source, verified, review_status, active, created_at, updated_at)
    VALUES (@id, @name, @url, @urlNormalized, @description, @features, @signupRequirements,
      @bonusInfo, @cashOutBeforeBlocked, @trackables, @rating, @source, @verified, @reviewStatus, @active, @createdAt, @updatedAt)
  `).run({
    ...casino,
    features: JSON.stringify(casino.features),
    signupRequirements: JSON.stringify(casino.signupRequirements),
    trackables: JSON.stringify(casino.trackables),
    verified: casino.verified ? 1 : 0,
    reviewStatus: casino.reviewStatus,
    active: casino.active ? 1 : 0,
  });

  commitCatalogWrite(`addCasino:${casino.name}`);

  return casino;
}

export function updateCasino(id: string, input: Partial<CasinoInput>): Casino | null {
  const existing = getCasinoById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const url = input.url ? toCasinoRootUrl(ensureHttps(input.url)) : existing.url;
  const urlNormalized = input.url ? casinoHostKey(url) : existing.urlNormalized;
  const updated: Casino = {
    ...existing,
    name: input.name ?? existing.name,
    url,
    urlNormalized,
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
    reviewStatus: input.reviewStatus
      ?? (input.verified === true ? 'approved' : existing.reviewStatus),
    updatedAt: now,
  };
  const active = updated.reviewStatus !== 'rejected' ? 1 : 0;
  if (input.verified === true && updated.reviewStatus === 'approved') {
    updated.verified = true;
  }

  db.prepare(`
    UPDATE casinos SET name=@name, url=@url, url_normalized=@urlNormalized, description=@description,
      features=@features, signup_requirements=@signupRequirements, bonus_info=@bonusInfo,
      cash_out_before_blocked=@cashOutBeforeBlocked, trackables=@trackables,
      rating=@rating, verified=@verified, review_status=@reviewStatus, active=@active, updated_at=@updatedAt
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
    reviewStatus: updated.reviewStatus,
    active,
    updatedAt: updated.updatedAt,
  });

  commitCatalogWrite(`updateCasino:${updated.name}`);
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

  if (filters.catalogOnly) {
    conditions.push("review_status = 'approved'");
    conditions.push('verified = 1');
  }

  if (filters.pendingOnly) {
    conditions.push("review_status = 'pending'");
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

  const orderBy = filters.pendingOnly
    ? 'created_at DESC'
    : 'rating DESC, name ASC';

  const sql = `
    SELECT * FROM casinos
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderBy}
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

export function getAllCasinos(catalogOnly = false): Casino[] {
  if (catalogOnly) {
    return searchCasinos({ catalogOnly: true, limit: 500 });
  }
  const rows = db.prepare('SELECT * FROM casinos WHERE active = 1 ORDER BY rating DESC').all();
  return rows.map((r) => rowToCasino(r as Record<string, unknown>));
}

export function getPendingCasinos(): Casino[] {
  return searchCasinos({ pendingOnly: true, limit: 200 });
}

/** Top-rated verified catalog entries. */
export function getFeaturedCasinos(limit = 10): Casino[] {
  return searchCasinos({ catalogOnly: true, limit: Math.min(limit, 25) });
}

/** Recently approved verified catalog entries (same ordering as new arrivals). */
export function getRecentCasinos(limit = 10): Casino[] {
  const rows = db.prepare(`
    SELECT * FROM casinos
    WHERE active = 1 AND review_status = 'approved' AND verified = 1
      AND approved_at IS NOT NULL
    ORDER BY approved_at DESC
    LIMIT @limit
  `).all({ limit: Math.min(limit, 25) });
  return rows.map((r) => rowToCasino(r as Record<string, unknown>));
}

/** Verified catalog entries not checked within STALE_CATALOG_DAYS (or never). */
export function getStaleCatalogCasinos(limit = 20, maxAgeDays = 90): Casino[] {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = db.prepare(`
    SELECT * FROM casinos
    WHERE active = 1 AND review_status = 'approved' AND verified = 1
      AND (last_checked_at IS NULL OR last_checked_at < @cutoff)
    ORDER BY CASE WHEN last_checked_at IS NULL THEN 0 ELSE 1 END, last_checked_at ASC, rating DESC
    LIMIT @limit
  `).all({ cutoff, limit });
  return rows.map((r) => rowToCasino(r as Record<string, unknown>));
}

export function countStaleCatalogCasinos(maxAgeDays = 90): number {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const row = db.prepare(`
    SELECT COUNT(*) as c FROM casinos
    WHERE active = 1 AND review_status = 'approved' AND verified = 1
      AND health_status != 'failed'
      AND (last_checked_at IS NULL OR last_checked_at < @cutoff)
  `).get({ cutoff }) as { c: number };
  return row.c;
}

export function countFailedHealthCasinos(): number {
  const row = db.prepare(`
    SELECT COUNT(*) as c FROM casinos
    WHERE active = 1 AND review_status = 'approved' AND verified = 1 AND health_status = 'failed'
  `).get() as { c: number };
  return row.c;
}

export function setCasinoHealth(id: string, status: CatalogHealthStatus, note = ''): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE casinos SET health_status = @status, health_note = @note, updated_at = @now WHERE id = @id
  `).run({ id, status, note: note.slice(0, 500), now });
}

export function getCatalogHealthIssues(limit = 50): Casino[] {
  const cutoff = new Date(Date.now() - STALE_CATALOG_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = db.prepare(`
    SELECT * FROM casinos
    WHERE active = 1 AND review_status = 'approved' AND verified = 1
      AND (
        health_status = 'failed'
        OR last_checked_at IS NULL
        OR last_checked_at < @cutoff
      )
    ORDER BY
      CASE WHEN health_status = 'failed' THEN 0 ELSE 1 END,
      CASE WHEN last_checked_at IS NULL THEN 0 ELSE 1 END,
      last_checked_at ASC,
      rating DESC
    LIMIT @limit
  `).all({ cutoff, limit });
  return rows.map((r) => rowToCasino(r as Record<string, unknown>));
}

export function unlistCasino(id: string): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE casinos SET active = 0, updated_at = @now WHERE id = @id
  `).run({ id, now });
  return result.changes > 0;
}

export function getCasinoBySlug(slug: string): Casino | null {
  const trimmed = slug.trim();
  const byId = getCasinoById(trimmed);
  if (byId?.active && byId.reviewStatus === 'approved' && byId.verified) return byId;

  const host = trimmed.toLowerCase().replace(/^www\./, '');
  const row = db.prepare(`
    SELECT * FROM casinos
    WHERE url_normalized = @host AND active = 1 AND review_status = 'approved' AND verified = 1
  `).get({ host });
  return row ? rowToCasino(row as Record<string, unknown>) : null;
}

export interface FavoriteEntry {
  casino: Casino;
  note: string | null;
}

export function getUserFavorites(userId: string): FavoriteEntry[] {
  const rows = db.prepare(`
    SELECT c.*, f.note as favorite_note FROM user_favorites f
    JOIN casinos c ON c.id = f.casino_id
    WHERE f.user_id = @userId AND c.active = 1
    ORDER BY f.created_at DESC
  `).all({ userId }) as Record<string, unknown>[];
  return rows.map((r) => {
    const note = typeof r.favorite_note === 'string' ? r.favorite_note : null;
    const { favorite_note: _fn, ...casinoRow } = r;
    return { casino: rowToCasino(casinoRow), note: note?.trim() ? note : null };
  });
}

export function setUserFavoriteNote(userId: string, casinoId: string, note: string): boolean {
  const trimmed = note.trim().slice(0, 500);
  const result = db.prepare(`
    UPDATE user_favorites SET note = @note
    WHERE user_id = @userId AND casino_id = @casinoId
  `).run({ userId, casinoId, note: trimmed || null });
  return result.changes > 0;
}

export function addUserFavorite(userId: string, casinoId: string): boolean {
  const casino = getCasinoById(casinoId);
  if (!casino || !casino.active || casino.reviewStatus !== 'approved' || !casino.verified) {
    return false;
  }
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO user_favorites (user_id, casino_id, created_at)
    VALUES (@userId, @casinoId, @now)
  `).run({ userId, casinoId, now });
  return true;
}

export function removeUserFavorite(userId: string, casinoId: string): boolean {
  const result = db.prepare(`
    DELETE FROM user_favorites WHERE user_id = @userId AND casino_id = @casinoId
  `).run({ userId, casinoId });
  return result.changes > 0;
}

export function isUserFavorite(userId: string, casinoId: string): boolean {
  const row = db.prepare(`
    SELECT 1 FROM user_favorites WHERE user_id = @userId AND casino_id = @casinoId
  `).get({ userId, casinoId });
  return Boolean(row);
}

export function approveCasino(id: string, approvedBy?: string): Casino | null {
  const existing = getCasinoById(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE casinos SET verified = 1, review_status = 'approved', active = 1, updated_at = @now,
      approved_by = @approvedBy, approved_at = @now,
      health_status = 'ok', health_note = ''
    WHERE id = @id
  `).run({ id, now, approvedBy: approvedBy ?? null });
  if (result.changes === 0) return null;

  markDiscoverySeen(existing.url, 'added', 'admin approved');
  const approved = getCasinoById(id);
  if (!approved?.verified || approved.reviewStatus !== 'approved') return null;
  commitCatalogWrite(`approveCasino:${approved.name}`);
  return approved;
}

export async function approveAllPendingCasinos(approvedBy?: string, limit = 50): Promise<{ approved: number; ids: string[] }> {
  const pending = getPendingCasinos().slice(0, Math.min(limit, 100));
  const ids: string[] = [];
  for (const casino of pending) {
    const approved = approveCasino(casino.id, approvedBy);
    if (approved) ids.push(approved.id);
  }
  if (ids.length > 0) await commitCatalogWriteAndWait('approveAllPending');
  return { approved: ids.length, ids };
}

export function rejectCasino(id: string): boolean {
  const existing = getCasinoById(id);
  if (!existing) return false;
  banRejectedDiscovery(existing.url, 'admin rejected', 'admin');
  markDiscoverySeen(existing.url, 'rejected', 'admin rejected');
  const result = db.prepare('DELETE FROM casinos WHERE id = ?').run(id);
  if (result.changes > 0) commitCatalogWrite('rejectCasino');
  return result.changes > 0;
}

export function touchLastCheckedAt(url: string): void {
  const host = casinoHostKey(url);
  const now = new Date().toISOString();
  db.prepare('UPDATE casinos SET last_checked_at = @now WHERE url_normalized = @host')
    .run({ now, host });
}

export function findSimilarCasinos(casinoId: string, limit = 8): { source: Casino; matches: SimilarCasinoMatch[] } | null {
  const source = getCasinoById(casinoId);
  if (!source) return null;
  const all = getAllCasinos(true);
  return { source, matches: rankSimilarCasinos(source, all, limit) };
}

export function findSimilarCasinosByQuery(query: string, limit = 8): { source: Casino; matches: SimilarCasinoMatch[] } | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const results = searchCasinos({ query: trimmed, catalogOnly: true, limit: 10 });
  if (!results.length) return null;

  const q = trimmed.toLowerCase();
  const source = [...results].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const score = (name: string) => {
      if (name === q) return 100;
      if (name.startsWith(q)) return 80;
      if (name.includes(q)) return 60;
      if (q.includes(name.split(/\s+/)[0] ?? '')) return 40;
      return 0;
    };
    const diff = score(bName) - score(aName);
    if (diff !== 0) return diff;
    return b.rating - a.rating;
  })[0];

  return findSimilarCasinos(source.id, limit);
}

export function getKnownUrls(): Set<string> {
  const rows = db.prepare('SELECT url_normalized FROM casinos').all() as { url_normalized: string }[];
  return new Set(rows.map((r) => r.url_normalized));
}

export function getKnownHosts(): Set<string> {
  const rows = db.prepare('SELECT url FROM casinos').all() as { url: string }[];
  return new Set(rows.map((r) => casinoHostKey(r.url)));
}

/** Audit log of past discovery outcomes — does not skip future scans. */
export function getDiscoverySeenUrls(): Set<string> {
  const rows = db.prepare('SELECT url_normalized FROM discovery_seen').all() as { url_normalized: string }[];
  return new Set(rows.map((r) => r.url_normalized));
}

export function getDiscoverySeenHosts(): Set<string> {
  const rows = db.prepare('SELECT url_normalized FROM discovery_seen').all() as { url_normalized: string }[];
  return new Set(rows.map((r) => {
    const v = r.url_normalized;
    if (!v.includes('://') && !v.includes('/')) return v;
    try {
      return casinoHostKey(v.startsWith('http') ? v : `https://${v}`);
    } catch {
      return v.toLowerCase();
    }
  }));
}

export function markDiscoverySeen(url: string, outcome: string, reason = ''): void {
  const host = casinoHostKey(url);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO discovery_seen (url_normalized, outcome, reason, last_seen_at)
    VALUES (@urlNormalized, @outcome, @reason, @lastSeenAt)
    ON CONFLICT(url_normalized) DO UPDATE SET
      outcome = excluded.outcome,
      reason = excluded.reason,
      last_seen_at = excluded.last_seen_at
  `).run({ urlNormalized: host, outcome, reason, lastSeenAt: now });
}

export function clearDiscoverySeen(): number {
  const result = db.prepare('DELETE FROM discovery_seen').run();
  return result.changes;
}

export function urlExists(url: string): boolean {
  const host = casinoHostKey(url);
  const row = db.prepare('SELECT id FROM casinos WHERE url_normalized = ?').get(host);
  return Boolean(row);
}

export function getStats(): Stats {
  const total = db.prepare('SELECT COUNT(*) as c FROM casinos WHERE active = 1').get() as { c: number };
  const verified = db.prepare('SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND verified = 1').get() as { c: number };
  const pendingReview = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND review_status = 'pending'").get() as { c: number };
  const noPhone = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%no_phone%'").get() as { c: number };
  const emailOnly = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%email_only%'").get() as { c: number };
  const slots = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%slots%'").get() as { c: number };
  const live = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%live_games%'").get() as { c: number };
  const vpnAllowed = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%vpn_allowed%'").get() as { c: number };
  const vpnBlocked = db.prepare("SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND features LIKE '%vpn_blocked%'").get() as { c: number };
  const blockedSites = db.prepare('SELECT COUNT(*) as c FROM blocked_sites WHERE active = 1').get() as { c: number };
  const openReports = db.prepare("SELECT COUNT(*) as c FROM site_reports WHERE status = 'open'").get() as { c: number };
  const lastDiscovery = db.prepare('SELECT ran_at FROM discovery_log ORDER BY id DESC LIMIT 1').get() as { ran_at: string } | undefined;

  return {
    totalCasinos: total.c,
    verifiedCasinos: verified.c,
    pendingReview: pendingReview.c,
    openReports: openReports.c,
    noPhoneCasinos: noPhone.c,
    emailOnlyCasinos: emailOnly.c,
    withSlots: slots.c,
    withLiveGames: live.c,
    vpnAllowedCasinos: vpnAllowed.c,
    vpnBlockedCasinos: vpnBlocked.c,
    blockedSites: blockedSites.c,
    lastDiscoveryAt: lastDiscovery?.ran_at ?? null,
    staleCatalogCasinos: countStaleCatalogCasinos(),
    failedHealthCasinos: countFailedHealthCasinos(),
  };
}

export function logDiscovery(
  found: number,
  added: number,
  skipped: number,
  errors: string[],
  meta: { mode?: string; rejected?: number; blocked?: number; durationMs?: number } = {},
): void {
  db.prepare(`
    INSERT INTO discovery_log (ran_at, found, added, skipped, errors, mode, rejected, blocked, duration_ms)
    VALUES (@ranAt, @found, @added, @skipped, @errors, @mode, @rejected, @blocked, @durationMs)
  `).run({
    ranAt: new Date().toISOString(),
    found,
    added,
    skipped,
    errors: JSON.stringify(errors),
    mode: meta.mode ?? 'quick',
    rejected: meta.rejected ?? 0,
    blocked: meta.blocked ?? 0,
    durationMs: meta.durationMs ?? 0,
  });
}

export interface DiscoveryHistoryEntry {
  id: number;
  ranAt: string;
  found: number;
  added: number;
  skipped: number;
  rejected: number;
  blocked: number;
  mode: string;
  durationMs: number;
  errors: string[];
}

export function getRecentlyApprovedCasinos(limit = 24): Casino[] {
  const rows = db.prepare(`
    SELECT * FROM casinos
    WHERE active = 1 AND review_status = 'approved' AND verified = 1
      AND approved_at IS NOT NULL
    ORDER BY approved_at DESC
    LIMIT @limit
  `).all({ limit: Math.min(limit, 50) });
  return rows.map((r) => rowToCasino(r as Record<string, unknown>));
}

export function getDiscoveryMeta(key: string): string | null {
  const row = db.prepare('SELECT value FROM discovery_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setDiscoveryMeta(key: string, value: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO discovery_meta (key, value, updated_at) VALUES (@key, @value, @now)
    ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @now
  `).run({ key, value, now });
}

export interface AdminInsights {
  pendingCount: number;
  openReports: number;
  pendingBySource: { source: string; count: number }[];
  discoveryLast7d: { runs: number; added: number; rejected: number };
  recentRuns: DiscoveryHistoryEntry[];
  catalogGrowth30d: number;
}

export function getAdminInsights(): AdminInsights {
  const pendingCount = (db.prepare(
    "SELECT COUNT(*) as c FROM casinos WHERE active = 1 AND review_status = 'pending'",
  ).get() as { c: number }).c;

  const openReports = (db.prepare(
    "SELECT COUNT(*) as c FROM site_reports WHERE status = 'open'",
  ).get() as { c: number }).c;

  const pendingBySource = (db.prepare(`
    SELECT COALESCE(source, 'unknown') as source, COUNT(*) as count
    FROM casinos WHERE active = 1 AND review_status = 'pending'
    GROUP BY source ORDER BY count DESC
  `).all() as { source: string; count: number }[]);

  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d7 = db.prepare(`
    SELECT COUNT(*) as runs, COALESCE(SUM(added), 0) as added, COALESCE(SUM(rejected), 0) as rejected
    FROM discovery_log WHERE ran_at >= ?
  `).get(cutoff7d) as { runs: number; added: number; rejected: number };

  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const growth = (db.prepare(`
    SELECT COUNT(*) as c FROM casinos
    WHERE review_status = 'approved' AND verified = 1 AND COALESCE(approved_at, created_at) >= ?
  `).get(cutoff30d) as { c: number }).c;

  return {
    pendingCount,
    openReports,
    pendingBySource,
    discoveryLast7d: {
      runs: d7.runs,
      added: d7.added,
      rejected: d7.rejected,
    },
    recentRuns: getDiscoveryHistory(12),
    catalogGrowth30d: growth,
  };
}

export interface PublicFeedItem {
  type: 'approval' | 'discovery';
  at: string;
  title: string;
  detail: string;
  casinoId?: string;
  casinoSlug?: string;
}

export function getPublicFeed(limit = 10): PublicFeedItem[] {
  const items: PublicFeedItem[] = [];
  for (const c of getRecentlyApprovedCasinos(Math.min(limit, 8))) {
    items.push({
      type: 'approval',
      at: c.approvedAt ?? c.updatedAt,
      title: c.name,
      detail: 'Approved to catalog',
      casinoId: c.id,
      casinoSlug: c.urlNormalized || c.id,
    });
  }
  for (const r of getDiscoveryHistory(5)) {
    items.push({
      type: 'discovery',
      at: r.ranAt,
      title: `${r.mode} discovery scan`,
      detail: `+${r.added} queued · ${r.rejected} rejected`,
    });
  }
  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export function exportVerifiedCasinosCsv(): string {
  const rows = searchCasinos({ catalogOnly: true, limit: 500 });
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    'name,url,rating,features,signup_requirements,last_checked',
    ...rows.map((c) => [
      escape(c.name),
      escape(c.url),
      String(c.rating),
      escape(c.features.join(';')),
      escape(c.signupRequirements.join(';')),
      escape(c.lastCheckedAt ?? ''),
    ].join(',')),
  ];
  return lines.join('\n');
}

export function exportPendingCasinosCsv(): string {
  const rows = getPendingCasinos();
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    'name,url,source,rating,created_at,health_note',
    ...rows.map((c) => [
      escape(c.name),
      escape(c.url),
      escape(c.source),
      String(c.rating),
      escape(c.createdAt),
      escape(c.healthNote ?? ''),
    ].join(',')),
  ];
  return lines.join('\n');
}

export function getDiscoveryHistory(limit = 20): DiscoveryHistoryEntry[] {
  const rows = db.prepare(`
    SELECT id, ran_at, found, added, skipped, errors, mode, rejected, blocked, duration_ms
    FROM discovery_log ORDER BY id DESC LIMIT ?
  `).all(limit) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: r.id as number,
    ranAt: r.ran_at as string,
    found: r.found as number,
    added: r.added as number,
    skipped: r.skipped as number,
    rejected: (r.rejected as number) ?? 0,
    blocked: (r.blocked as number) ?? 0,
    mode: (r.mode as string) ?? 'quick',
    durationMs: (r.duration_ms as number) ?? 0,
    errors: JSON.parse((r.errors as string) || '[]') as string[],
  }));
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
  return new Set(rows.map((r) => casinoHostKey(r.url_normalized.includes('://') ? r.url_normalized : `https://${r.url_normalized}`)));
}

export function isUrlBlocked(url: string): boolean {
  const host = casinoHostKey(url);
  const row = db.prepare('SELECT id FROM blocked_sites WHERE url_normalized = ? AND active = 1').get(host);
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
  const url = toCasinoRootUrl(ensureHttps(input.url));
  const urlNormalized = casinoHostKey(url);
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

  commitCatalogWrite(`addBlockedSite:${site.name}`);
  return site;
}

export function updateBlockedSite(id: string, input: Partial<BlockedSiteInput>): BlockedSite | null {
  const existing = getBlockedSiteById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const url = input.url ? toCasinoRootUrl(ensureHttps(input.url)) : existing.url;
  const urlNormalized = input.url ? casinoHostKey(url) : existing.urlNormalized;
  const updated: BlockedSite = {
    ...existing,
    name: input.name ?? existing.name,
    url,
    urlNormalized,
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
  const host = casinoHostKey(url);
  const result = db.prepare('DELETE FROM casinos WHERE url_normalized = ?').run(host);
  return result.changes > 0;
}

export function getCasinoByUrl(url: string): Casino | null {
  const host = casinoHostKey(url);
  const row = db.prepare('SELECT * FROM casinos WHERE url_normalized = ? AND active = 1').get(host);
  return row ? rowToCasino(row as Record<string, unknown>) : null;
}

export function getBlockedSiteByUrl(url: string): BlockedSite | null {
  const host = casinoHostKey(url);
  const row = db.prepare('SELECT * FROM blocked_sites WHERE url_normalized = ? AND active = 1').get(host);
  return row ? rowToBlockedSite(row as Record<string, unknown>) : null;
}

export function addSiteReport(input: SiteReportInput): SiteReport {
  const url = toCasinoRootUrl(ensureHttps(input.url));
  const host = casinoHostKey(url);
  const now = new Date().toISOString();

  const existing = db.prepare(`
    SELECT id, url, reason, reported_by, status, created_at
    FROM site_reports WHERE url_normalized = ? AND status = 'open'
  `).get(host) as Record<string, unknown> | undefined;

  if (existing) {
    const mergedReason = input.reason?.trim()
      ? `${existing.reason as string}; ${input.reason.trim()}`
      : (existing.reason as string);
    db.prepare('UPDATE site_reports SET reason = ? WHERE id = ?').run(mergedReason.slice(0, 500), existing.id);
    return {
      id: existing.id as string,
      url: existing.url as string,
      reason: mergedReason.slice(0, 500),
      reportedBy: existing.reported_by as string,
      status: 'open',
      createdAt: existing.created_at as string,
      reviewedAt: null,
      reviewedBy: null,
    };
  }

  const report: SiteReport = {
    id: nanoid(12),
    url,
    reason: input.reason?.trim() || 'User report',
    reportedBy: input.reportedBy || 'anonymous',
    status: 'open',
    createdAt: now,
    reviewedAt: null,
    reviewedBy: null,
  };

  db.prepare(`
    INSERT INTO site_reports (id, url, url_normalized, reason, reported_by, status, created_at)
    VALUES (@id, @url, @host, @reason, @reportedBy, @status, @createdAt)
  `).run({
    id: report.id,
    url: report.url,
    host,
    reason: report.reason,
    reportedBy: report.reportedBy,
    status: report.status,
    createdAt: report.createdAt,
  });

  return report;
}

function discoveryRejectToBlockReason(reason: string): BlockReason {
  const lower = reason.toLowerCase();
  if (lower.includes('phishing')) return 'phishing';
  if (lower.includes('malware')) return 'malware';
  if (lower.includes('scam')) return 'scam';
  if (lower.includes('spam')) return 'spam';
  if (lower.includes('news') || lower.includes('media')) return 'spam';
  if (lower.includes('adult')) return 'other';
  if (lower.includes('generic') || lower.includes('non-casino') || lower.includes('not a casino')) {
    return 'fake_casino';
  }
  return 'fake_casino';
}

/** Auto-ban a rejected discovery URL (blocklist + remove pending catalog row). */
export function banRejectedDiscovery(
  url: string,
  reason: string,
  reportedBy = 'discovery',
): BlockedSite | null {
  try {
    const root = toCasinoRootUrl(ensureHttps(url));
    const existingBlock = getBlockedSiteByUrl(root);
    if (existingBlock) return existingBlock;

    const catalog = getCasinoByUrl(root);
    if (catalog?.active && catalog.reviewStatus === 'approved') return null;

    const host = casinoHostKey(root);
    const brand = host.split('.')[0] ?? host;
    const name = brand.charAt(0).toUpperCase() + brand.slice(1);

    const site = addBlockedSite({
      name,
      url: root,
      reason: discoveryRejectToBlockReason(reason),
      severity: 'high',
      description: `Rejected discovery: ${reason}`,
      reportedBy,
      removeCasino: true,
    }) ?? getBlockedSiteByUrl(root);

    if (site) {
      markDiscoverySeen(root, 'blocked', reason);
      commitCatalogWrite(`banRejectedDiscovery:${host}`);
    }
    return site;
  } catch {
    return null;
  }
}

/** @deprecated Alias — discovery rejections are banned immediately, not queued for review. */
export function queueDiscoveryBanReview(url: string, reason: string): BlockedSite | null {
  return banRejectedDiscovery(url, reason, 'discovery');
}

export function getOpenSiteReports(): SiteReport[] {
  const rows = db.prepare(`
    SELECT id, url, reason, reported_by, status, created_at, reviewed_at, reviewed_by
    FROM site_reports WHERE status = 'open'
    ORDER BY created_at DESC
    LIMIT 100
  `).all();
  return rows.map((r) => mapSiteReport(r as Record<string, unknown>));
}

export function getClosedSiteReports(limit = 50): SiteReport[] {
  const rows = db.prepare(`
    SELECT id, url, reason, reported_by, status, created_at, reviewed_at, reviewed_by
    FROM site_reports WHERE status != 'open'
    ORDER BY COALESCE(reviewed_at, created_at) DESC
    LIMIT @limit
  `).all({ limit });
  return rows.map((r) => mapSiteReport(r as Record<string, unknown>));
}

function mapSiteReport(r: Record<string, unknown>): SiteReport {
  return {
    id: r.id as string,
    url: r.url as string,
    reason: r.reason as string,
    reportedBy: r.reported_by as string,
    status: r.status as SiteReport['status'],
    createdAt: r.created_at as string,
    reviewedAt: (r.reviewed_at as string) || null,
    reviewedBy: (r.reviewed_by as string) || null,
  };
}

export function dismissSiteReport(id: string, reviewedBy?: string): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE site_reports SET status = 'dismissed', reviewed_at = @now, reviewed_by = @reviewedBy
    WHERE id = @id
  `).run({ id, now, reviewedBy: reviewedBy ?? null });
  return result.changes > 0;
}

export function markSiteReportReviewed(id: string, reviewedBy?: string): boolean {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE site_reports SET status = 'reviewed', reviewed_at = @now, reviewed_by = @reviewedBy
    WHERE id = @id
  `).run({ id, now, reviewedBy: reviewedBy ?? null });
  return result.changes > 0;
}

const DISCOVERY_LIVE_EVENT_CAP = 400;

const emptyDiscoveryLiveStats = (): DiscoveryLiveStats => ({
  scanned: 0,
  queued: 0,
  added: 0,
  rejected: 0,
  skipped: 0,
  blocked: 0,
  sourcesChecked: 0,
  phase: 'curated',
  queryIndex: 0,
  queryTotal: 0,
});

function readDiscoveryLiveRow(): {
  running: boolean;
  mode: 'quick' | 'deep' | null;
  startedAt: number | null;
  phaseLabel: string;
  stats: DiscoveryLiveStats | null;
  result: DiscoveryResult | null;
} {
  const row = db.prepare(`
    SELECT running, mode, started_at, phase_label, stats_json, result_json
    FROM discovery_live WHERE id = 1
  `).get() as {
    running: number;
    mode: string | null;
    started_at: number | null;
    phase_label: string;
    stats_json: string;
    result_json: string | null;
  } | undefined;

  if (!row) {
    return {
      running: false,
      mode: null,
      startedAt: null,
      phaseLabel: '',
      stats: null,
      result: null,
    };
  }

  let stats: DiscoveryLiveStats | null = null;
  try {
    const parsed = JSON.parse(row.stats_json || '{}') as DiscoveryLiveStats;
    if (parsed && typeof parsed === 'object') stats = parsed;
  } catch {
    stats = null;
  }

  let result: DiscoveryResult | null = null;
  if (row.result_json) {
    try {
      result = JSON.parse(row.result_json) as DiscoveryResult;
    } catch {
      result = null;
    }
  }

  return {
    running: row.running === 1,
    mode: row.mode === 'deep' || row.mode === 'quick' ? row.mode : null,
    startedAt: row.started_at,
    phaseLabel: row.phase_label || '',
    stats,
    result,
  };
}

export function resetDiscoveryLiveStorage(mode: 'quick' | 'deep'): void {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM discovery_live_events').run();
  db.prepare(`
    UPDATE discovery_live SET
      running = 1,
      mode = @mode,
      started_at = @startedAt,
      phase_label = 'Starting…',
      stats_json = @statsJson,
      result_json = NULL,
      updated_at = @now
    WHERE id = 1
  `).run({
    mode,
    startedAt: Date.now(),
    statsJson: JSON.stringify(emptyDiscoveryLiveStats()),
    now,
  });
}

export function updateDiscoveryLiveStorage(patch: {
  phaseLabel?: string;
  stats?: DiscoveryLiveStats;
}): void {
  const current = readDiscoveryLiveRow();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE discovery_live SET
      phase_label = @phaseLabel,
      stats_json = @statsJson,
      updated_at = @now
    WHERE id = 1
  `).run({
    phaseLabel: patch.phaseLabel ?? current.phaseLabel,
    statsJson: JSON.stringify(patch.stats ?? current.stats ?? emptyDiscoveryLiveStats()),
    now,
  });
}

export function appendDiscoveryLiveEventStorage(event: DiscoveryProgressEvent): number {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO discovery_live_events (event_json, created_at) VALUES (@eventJson, @now)
  `).run({ eventJson: JSON.stringify(event), now });
  const seq = Number(result.lastInsertRowid);

  const count = db.prepare('SELECT COUNT(*) as c FROM discovery_live_events').get() as { c: number };
  if (count.c > DISCOVERY_LIVE_EVENT_CAP) {
    db.prepare(`
      DELETE FROM discovery_live_events
      WHERE seq NOT IN (
        SELECT seq FROM discovery_live_events ORDER BY seq DESC LIMIT ?
      )
    `).run(DISCOVERY_LIVE_EVENT_CAP);
  }

  return seq;
}

export function finishDiscoveryLiveStorage(result: DiscoveryResult): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE discovery_live SET
      running = 0,
      result_json = @resultJson,
      updated_at = @now
    WHERE id = 1
  `).run({ resultJson: JSON.stringify(result), now });
}

export function isDiscoveryLiveRunningStorage(): boolean {
  return readDiscoveryLiveRow().running;
}

export function getDiscoveryLiveStorage(sinceSeq = 0): {
  running: boolean;
  mode: 'quick' | 'deep' | null;
  startedAt: number | null;
  phaseLabel: string;
  stats: DiscoveryLiveStats | null;
  events: Array<DiscoveryProgressEvent & { seq: number }>;
  lastSeq: number;
  result: DiscoveryResult | null;
} {
  const row = readDiscoveryLiveRow();
  const events = (db.prepare(`
    SELECT seq, event_json FROM discovery_live_events
    WHERE seq >= ? ORDER BY seq ASC
  `).all(Math.max(0, sinceSeq)) as { seq: number; event_json: string }[])
    .map(({ seq, event_json }) => {
      try {
        const event = JSON.parse(event_json) as DiscoveryProgressEvent;
        return { seq, ...event };
      } catch {
        return null;
      }
    })
    .filter((e): e is DiscoveryProgressEvent & { seq: number } => e !== null);

  const lastSeqRow = db.prepare('SELECT MAX(seq) as maxSeq FROM discovery_live_events').get() as { maxSeq: number | null };

  return {
    running: row.running,
    mode: row.mode,
    startedAt: row.startedAt,
    phaseLabel: row.phaseLabel,
    stats: row.stats,
    events,
    lastSeq: lastSeqRow.maxSeq ?? -1,
    result: row.result,
  };
}

export function pauseDiscoveryLiveForRestart(label: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE discovery_live SET
      running = 0,
      phase_label = @label,
      updated_at = @now
    WHERE id = 1
  `).run({ label, now });
}

export function resumeDiscoveryLiveStorage(mode?: 'quick' | 'deep'): void {
  const row = readDiscoveryLiveRow();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE discovery_live SET
      running = 1,
      mode = COALESCE(@mode, mode),
      phase_label = 'Resuming…',
      result_json = NULL,
      updated_at = @now
    WHERE id = 1
  `).run({ mode: mode ?? row.mode, now });
}

export function recoverDiscoveryLiveOnBoot(): void {
  const row = readDiscoveryLiveRow();
  const sessionExists = hasDiscoverySession();

  if (sessionExists) {
    pauseDiscoveryLiveForRestart('Scan paused (server restart) — open Discovery and tap Resume');
    appendDiscoveryLiveEventStorage({
      type: 'phase',
      phase: 'analyze',
      label: 'Server restarted — progress saved. Resume when ready.',
    });
    return;
  }

  if (!row.running) return;

  const stats = row.stats ?? emptyDiscoveryLiveStats();
  finishDiscoveryLiveStorage({
    scanned: stats.scanned,
    found: stats.added + stats.rejected + stats.skipped,
    added: stats.added,
    skipped: stats.skipped,
    blocked: stats.blocked,
    rejected: stats.rejected,
    durationMs: row.startedAt ? Math.max(0, Date.now() - row.startedAt) : 0,
    sourcesChecked: stats.sourcesChecked,
    errors: ['Scan interrupted by server restart — casinos saved during scan are in the review queue'],
    mode: row.mode ?? 'quick',
    addedCasinos: [],
  });
}

export function saveDiscoverySession(state: unknown): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO discovery_session (id, state_json, updated_at) VALUES (1, @stateJson, @now)
    ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `).run({ stateJson: JSON.stringify(state), now });
}

export function loadDiscoverySession<T>(): T | null {
  const row = db.prepare('SELECT state_json FROM discovery_session WHERE id = 1').get() as { state_json: string } | undefined;
  if (!row?.state_json) return null;
  try {
    return JSON.parse(row.state_json) as T;
  } catch {
    return null;
  }
}

export function hasDiscoverySession(): boolean {
  return loadDiscoverySession() !== null;
}

export function clearDiscoverySession(): void {
  db.prepare('DELETE FROM discovery_session WHERE id = 1').run();
}
