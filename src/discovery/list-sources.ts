/**
 * Known sites that publish large sweepstakes casino lists (hundreds of links).
 * Discovery crawls these directly — no generic web search required.
 */

import { claimListSitesForRun } from './list-site-coordinator.js';

export const SWEEPSTAKES_LIST_SITE_URLS: string[] = [
  'https://www.sweepskings.com/',
  'https://www.sweepskings.com/sweepstakes-casinos',
  'https://www.sweepslounge.com/',
  'https://www.sweepslounge.com/sweepstakes-casinos',
  'https://www.playusa.com/sweepstakes-casinos/',
  'https://www.casino.org/sweepstakes-casinos/',
  'https://www.gambling.com/online-casinos/sweepstakes/',
  'https://www.dimers.com/sweepstakes-casinos/',
  'https://www.legalsportsreport.com/sweepstakes-casinos/',
  'https://deadspin.com/casinos/sweepstakes-casinos/',
  'https://www.ballislife.com/betting/sweepstakes-casinos/',
  'https://next.io/sweepstakes-casinos-us/',
  'https://www.oddschecker.com/us/sweepstakes-casinos',
  'https://www.covers.com/sweepstakes-casinos',
  'https://www.sigma.world/news/sweepstakes-casinos',
  'https://www.vegasinsider.com/sweepstakes-casinos',
  'https://www.askgamblers.com/online-casinos/sweepstakes',
  'https://www.casino.us/sweepstakes-casinos/',
  'https://www.online-casinos.com/sweepstakes-casinos/',
  'https://igamingfuture.com/sweepstakes-casinos/',
  'https://gamingamerica.com/sweepstakes-casinos/',
  'https://www.pennlive.com/sweepstakes-casinos/',
  'https://www.mlive.com/sweepstakes-casinos/',
  'https://www.syracuse.com/sweepstakes-casinos/',
  'https://www.oregonlive.com/sweepstakes-casinos/',
  'https://www.chicagotribune.com/sweepstakes-casinos/',
  'https://www.lines.com/sweepstakes-casinos',
  'https://www.pokernews.com/sweepstakes-casinos/',
  'https://www.oddspedia.com/us/sweepstakes-casinos',
];

export function isListSiteDiscoveryEnabled(): boolean {
  const off = process.env.DISCOVERY_LIST_SITES?.trim().toLowerCase();
  if (off === '0' || off === 'false') return false;
  return true;
}

export function isWebSearchDiscoveryEnabled(): boolean {
  const on = process.env.DISCOVERY_WEB_SEARCH?.trim().toLowerCase();
  return on === '1' || on === 'true';
}

/** Full built-in + env list (deduped). */
export function getAllSweepstakesListSiteUrls(): string[] {
  const extra = process.env.DISCOVERY_LIST_SITE_URLS?.trim();
  const fromEnv = extra
    ? extra.split(/[\n,]+/).map((u) => u.trim()).filter((u) => u.startsWith('http'))
    : [];

  return [...new Set([...SWEEPSTAKES_LIST_SITE_URLS, ...fromEnv])];
}

/**
 * List URLs for a discovery run. With runId, claims a non-overlapping rotating subset.
 * Without runId (legacy/tests), returns a rotating slice of the full pool.
 */
export function getSweepstakesListSiteUrls(deep: boolean, runId?: string): string[] {
  if (runId) {
    return claimListSitesForRun(runId, deep);
  }

  const unique = getAllSweepstakesListSiteUrls();
  const limit = deep ? unique.length : Math.min(10, unique.length);
  const offset = getLegacyListOffset(limit, unique.length);
  const rotated = [...unique.slice(offset), ...unique.slice(0, offset)];
  return rotated.slice(0, limit);
}

function getLegacyListOffset(batchSize: number, poolSize: number): number {
  if (poolSize <= batchSize) return 0;
  const cursor = parseInt(process.env.DISCOVERY_LIST_CURSOR ?? '0', 10) || 0;
  return cursor % poolSize;
}

/** Advance cursor after a legacy (non-claimed) list pass — used in tests only if needed. */
export function advanceLegacyListCursor(count: number): void {
  const pool = getAllSweepstakesListSiteUrls().length;
  if (pool === 0) return;
  const cur = parseInt(process.env.DISCOVERY_LIST_CURSOR ?? '0', 10) || 0;
  process.env.DISCOVERY_LIST_CURSOR = String((cur + count) % pool);
}
