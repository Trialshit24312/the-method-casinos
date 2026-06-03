import { VERIFIED_CASINO_SEEDS } from '../shared/verified-casinos.js';
import { isWebSearchDiscoveryEnabled } from './list-sources.js';

/** Optional — only when DISCOVERY_WEB_SEARCH=1 (default is list-site crawl only). */
const SWEEPSTAKES_LIST_QUERIES = [
  'complete list of US sweepstakes casinos',
  'full list sweepstakes casino sites USA',
  'all sweepstakes casinos list gold coins',
  'every social casino sweeps coins list',
  'sweepstakes casino directory USA 2026',
  'master list sweepstakes gaming sites',
  'alphabetical list sweepstakes casinos',
  'how many sweepstakes casinos complete list',
  'new sweepstakes casinos list 2026',
  'all legal US sweepstakes casino brands',
  'social casino operators list sweeps cash',
  'sweepstakes casino comparison all sites',
  'full database sweepstakes casino USA',
  'sweepstakes casino sites list no purchase',
  'list of sweepstakes casinos like chumba',
  'all pulsz mcluck competitors list sweepstakes',
  'sweepstakes casino roundup list .us',
  'social casino sites list redeem prizes',
  'US sweepstakes slots casinos full list',
  'sweepstakes casino index all operators',
  'catalog of sweepstakes casinos USA',
  'sweepstakes gaming sites complete guide list',
  'best sweepstakes casinos full ranked list',
  'new social casino launches list sweeps',
  'sweepstakes casino brands list email signup',
  'all .us sweepstakes casino websites',
  'sweepstakes casino list free sweeps coins',
  'social sweeps casino directory no phone',
  'online sweepstakes casino list 2026 USA',
  '"sweepstakes casino" "list" "gold coins"',
  '"social casino" "list" "sweeps coins"',
  'inurl:sweepstakes-casinos list',
  'inurl:social-casinos sweepstakes list USA',
  'sweepstakes casino wiki list sites',
  'reddit list of sweepstakes casinos',
  'sweepstakes casino spreadsheet list sites',
  'form list sweepstakes casinos signup',
];

/** Direct operator discovery — always sweepstakes-scoped. */
const SWEEPSTAKES_OPERATOR_QUERIES = [
  'new sweepstakes casino launch site:.us 2026',
  'undiscovered sweepstakes casino sweeps coins',
  '"sweepstakes casino" "no purchase necessary" signup',
  '"social casino" "sweeps coins" site:.us -wikipedia',
  'brand new sweepstakes casino email signup',
  'sweepstakes casino .us no phone verification',
  'new sweeps casino competitor chumba pulsz',
];

const TOP_OPERATORS = [
  'chumba', 'pulsz', 'mcluck', 'wow vegas', 'fortune coins', 'luckyland',
  'stake us', 'modo', 'global poker', 'high 5 casino', 'crowncoins',
];

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

/** Web search queries — empty unless DISCOVERY_WEB_SEARCH=1. */
export function buildSearchQueries(deep: boolean): string[] {
  if (!isWebSearchDiscoveryEnabled()) return [];

  const queries: string[] = [...SWEEPSTAKES_LIST_QUERIES, ...SWEEPSTAKES_OPERATOR_QUERIES];

  for (const op of TOP_OPERATORS) {
    queries.push(`${op} alternative sweepstakes casino`);
    queries.push(`sites like ${op} sweepstakes list`);
  }

  for (const seed of VERIFIED_CASINO_SEEDS.slice(0, deep ? 40 : 18)) {
    const name = seed.name.replace(/\s+casino$/i, '').trim();
    queries.push(`${name} sweepstakes casino official`);
    queries.push(`alternatives to ${name} sweepstakes`);
  }

  const year = String(new Date().getFullYear());
  queries.push(`new sweepstakes casino list ${year}`);
  queries.push(`latest sweepstakes casinos added ${year}`);

  const shuffled = shuffle(uniqueStrings(queries));
  const limit = deep ? 55 : 30;
  const start = Math.floor(Math.random() * Math.max(1, shuffled.length));
  const rotated = [...shuffled.slice(start), ...shuffled.slice(0, start)];

  return rotated.slice(0, limit);
}

export const SEARCH_PAGES_QUICK = 6;
export const SEARCH_PAGES_DEEP = 12;
