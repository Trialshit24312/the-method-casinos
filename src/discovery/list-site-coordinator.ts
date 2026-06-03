import { casinoHostKey, toCasinoRootUrl } from '../shared/utils.js';
import { getDatabase, markDiscoverySeen } from '../database/index.js';
import { getMaxConcurrentDiscoveries } from './run-state.js';
import { getAllSweepstakesListSiteUrls } from './list-sources.js';

const LIST_CRAWL_OUTCOME = 'list_crawl';
const CLAIM_LEASE_MS = 50 * 60 * 1000;

const claims = new Map<string, { runId: string; until: number }>();

function listPageKey(url: string): string {
  try {
    return casinoHostKey(toCasinoRootUrl(url));
  } catch {
    return url.toLowerCase();
  }
}

function pruneExpiredClaims(): void {
  const now = Date.now();
  for (const [key, claim] of claims) {
    if (claim.until <= now) claims.delete(key);
  }
}

function isClaimedByOther(pageUrl: string, runId: string): boolean {
  const key = listPageKey(pageUrl);
  const claim = claims.get(key);
  return Boolean(claim && claim.runId !== runId && claim.until > Date.now());
}

function getLastListCrawlAt(pageUrl: string): number {
  const key = listPageKey(pageUrl);
  try {
    const row = getDatabase().prepare(`
      SELECT last_seen_at FROM discovery_seen
      WHERE url_normalized = ? AND outcome = ?
    `).get(key, LIST_CRAWL_OUTCOME) as { last_seen_at: string } | undefined;
    if (!row?.last_seen_at) return 0;
    const t = Date.parse(row.last_seen_at);
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

/** Prefer list pages not crawled recently; shuffle ties for variety. */
function listRecrawlMinMs(): number {
  const hours = parseInt(process.env.DISCOVERY_LIST_RECRAWL_HOURS ?? '12', 10);
  return (Number.isFinite(hours) && hours >= 0 ? hours : 12) * 3600_000;
}

function isListSiteEligible(pageUrl: string, forceAll = false): boolean {
  if (forceAll) return true;
  const last = getLastListCrawlAt(pageUrl);
  if (last === 0) return true;
  return Date.now() - last >= listRecrawlMinMs();
}

function sortListSitesByStaleness(urls: string[]): string[] {
  return [...urls].sort((a, b) => {
    const diff = getLastListCrawlAt(a) - getLastListCrawlAt(b);
    if (diff !== 0) return diff;
    return Math.random() - 0.5;
  });
}

function sitesPerRun(deep: boolean, poolSize: number): number {
  const slots = getMaxConcurrentDiscoveries();
  if (deep) {
    return Math.max(4, Math.ceil(poolSize / slots));
  }
  return Math.max(3, Math.min(8, Math.ceil(poolSize / (slots * 2))));
}

/**
 * Assign list/directory URLs exclusive to this discovery run so parallel scans
 * do not hammer the same roundup pages at once.
 */
export function claimListSitesForRun(runId: string, deep: boolean): string[] {
  pruneExpiredClaims();
  const pool = getAllSweepstakesListSiteUrls();
  let eligible = pool.filter((u) => !isClaimedByOther(u, runId) && isListSiteEligible(u));
  if (eligible.length < sitesPerRun(deep, pool.length)) {
    eligible = pool.filter((u) => !isClaimedByOther(u, runId));
  }
  const sorted = sortListSitesByStaleness(eligible);
  const count = Math.min(sitesPerRun(deep, pool.length), sorted.length);
  const picked = sorted.slice(0, count);
  const until = Date.now() + CLAIM_LEASE_MS;
  for (const url of picked) {
    claims.set(listPageKey(url), { runId, until });
  }
  return picked;
}

export function releaseListSitesForRun(runId: string): void {
  for (const [key, claim] of claims) {
    if (claim.runId === runId) claims.delete(key);
  }
}

export function markListSiteCrawled(pageUrl: string): void {
  markDiscoverySeen(pageUrl, LIST_CRAWL_OUTCOME, 'list site paged');
}
