import { VERIFIED_CASINO_SEEDS } from '../shared/verified-casinos.js';

const BASE_QUERIES = [
  'sweepstakes casino no phone required 2026',
  'new social casino sweeps coins list',
  'free sweeps casino email signup',
  'best sweepstakes slots casino usa',
  'sweepstakes casino live dealer',
  'alternative chumba pulsz new casino',
  'sweepstakes casino no verification',
  'social casino gold coins free',
  'new sweepstakes gaming sites',
  'no purchase sweepstakes casino',
  'sweepstakes casino vpn allowed',
  'free social casino instant play',
  'sweepstakes poker casino usa',
  'sweepstakes casino gift card redeem',
  'low minimum redeem sweepstakes',
  'wow vegas alternatives sweepstakes',
  'mcluck pulsz similar casinos',
  'new sweeps casino launch 2026',
  'social casino sweeps cash redeem',
  'play for free sweeps coins casino',
  'sweepstakes slots no deposit bonus',
  'fish games sweepstakes casino',
  'bingo sweepstakes casino online',
  'pragmatic play sweepstakes casino',
  'stake.us alternative sweepstakes',
  'lonestar casino sweepstakes',
  'texas sweepstakes casino online',
  'california social casino sweeps',
  'florida sweepstakes casino legal',
  'sweepstakes casino app no phone',
];

const SUFFIXES = [
  'signup bonus',
  'free coins',
  'promo code',
  'review',
  'login',
  'official site',
  'new player',
  'no purchase',
  'redeem prizes',
  'daily bonus',
];

const PREFIXES = ['new', 'best', 'top', 'free', 'legal', 'real', 'trusted', 'popular'];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

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

/** Build a large rotating query list — different order every scan. */
export function buildSearchQueries(deep: boolean): string[] {
  const queries: string[] = [...BASE_QUERIES];

  for (const seed of VERIFIED_CASINO_SEEDS) {
    const name = seed.name.replace(/\s+casino$/i, '').trim();
    queries.push(`${name} sweepstakes casino`);
    queries.push(`${name} sweeps coins`);
    queries.push(`site:${new URL(seed.url).hostname.replace(/^www\./, '')}`);
  }

  for (const letter of ALPHABET) {
    queries.push(`${letter} sweepstakes casino usa`);
    queries.push(`social casino ${letter} sweeps`);
  }

  for (const prefix of PREFIXES) {
    queries.push(`${prefix} sweepstakes casino 2026`);
    queries.push(`${prefix} social casino sweeps coins`);
  }

  for (const suffix of SUFFIXES) {
    queries.push(`sweepstakes casino ${suffix}`);
    queries.push(`social casino ${suffix}`);
  }

  const operators = ['chumba', 'pulsz', 'mcluck', 'stake us', 'wow vegas', 'fortune coins', 'luckyland', 'modo'];
  for (const op of operators) {
    queries.push(`casinos like ${op}`);
    queries.push(`${op} competitor sweepstakes`);
    queries.push(`alternative to ${op} casino`);
  }

  const shuffled = shuffle(uniqueStrings(queries));
  const limit = deep ? Math.min(90, shuffled.length) : Math.min(45, shuffled.length);
  return shuffled.slice(0, limit);
}

export const SEARCH_PAGES_QUICK = 3;
export const SEARCH_PAGES_DEEP = 5;
