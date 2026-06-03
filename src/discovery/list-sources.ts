/**
 * Known sites that publish large sweepstakes casino lists (hundreds of links).
 * Discovery crawls these directly — no generic web search required.
 */

export const SWEEPSTAKES_LIST_SITE_URLS: string[] = [
  'https://www.sweepskings.com/',
  'https://www.sweepskings.com/sweepstakes-casinos',
  'https://www.sweepslounge.com/',
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

/** URLs to crawl: built-in list + optional DISCOVERY_LIST_SITE_URLS (comma or newline). */
export function getSweepstakesListSiteUrls(deep: boolean): string[] {
  const extra = process.env.DISCOVERY_LIST_SITE_URLS?.trim();
  const fromEnv = extra
    ? extra.split(/[\n,]+/).map((u) => u.trim()).filter((u) => u.startsWith('http'))
    : [];

  const merged = [...SWEEPSTAKES_LIST_SITE_URLS, ...fromEnv];
  const unique = [...new Set(merged)];

  if (deep) return unique;
  return unique.slice(0, Math.min(10, unique.length));
}
