/**
 * Strict filters — discovery must never add news, adult, social, or generic sites.
 * Only real sweepstakes casino operators pass validation.
 */

import { casinoHostKey, getOperatorRootHost } from '../shared/utils.js';

const BLOCKED_DOMAIN_FRAGMENTS = [
  'google.', 'duckduckgo.', 'bing.', 'yahoo.', 'facebook.', 'twitter.', 'x.com',
  'youtube.', 'reddit.', 'wikipedia.', 'amazon.', 'apple.com', 'play.google',
  'instagram.', 'tiktok.', 'linkedin.', 'pinterest.', 'tumblr.',
  'cnn.com', 'bbc.', 'nytimes', 'forbes.', 'washingtonpost', 'theguardian',
  'reuters.', 'bloomberg.', 'cnbc.', 'espn.', 'foxnews.', 'nbcnews.',
  'pokernews.', 'casino.org', 'casino.guru', 'gambling.com', 'covers.com', 'oddschecker.',
  'booming-games.', 'playson', 'evolution.com', 'netent.', 'pragmaticplay.',
  'trustpilot.', 'scamadviser.', 'whois.', 'virustotal.',
  'medium.com', 'substack.', 'wordpress.', 'blogspot.', 'tumblr.',
  'porn', 'xxx.', 'xvideos', 'xnxx', 'xhamster', 'redtube', 'onlyfans',
  'chaturbate', 'adult', 'sex.', 'nude', 'hentai', 'cam4.',
  'opera.com', 'microsoft.com', 'google.com/chrome', 'mozilla.org', 'brave.com',
  'github.', 'stackoverflow.', 'wikipedia.',
];

const STRONG_HOST_HINTS = [
  'casino', 'sweep', 'sweeps', 'chumba', 'pulsz', 'mcluck', 'stake.us', 'stakeus',
  'wowvegas', 'crowncoin', 'fortunecoins', 'luckyland', 'high5casino', 'globalpoker',
  'modo.us', 'zulacasino', 'hellomillions', 'jackpota', 'funzpoints', 'sportzino',
  'realprize', 'spinblitz', 'goldenhearts', 'getfliff', 'babacasino', 'megabonanza',
  'moonspin', 'nolimitcoins', 'taofortune', 'rollingriches', 'sweepslots',
  'chipnwin', 'luckybird', 'acornfun', 'vivaro', 'pulszbingo', 'slots',
  'vegas', 'bonanza', 'million', 'fortune', 'coins', 'playfame',
];

const ADULT_KEYWORDS = [
  'porn', 'xxx', 'adult content', 'nude', 'naked', 'escort', 'webcam girl',
  'onlyfans', 'hentai', 'sex video', '18+ video',
];

const NEWS_KEYWORDS = [
  'breaking news', 'latest news', 'journalism', 'newsletter', 'press release',
  'reporter', 'headline news', 'op-ed', 'editorial board',
];

const GENERIC_REJECT_KEYWORDS = [
  'shop now', 'e-commerce', 'online store', 'buy now', 'free shipping',
  'web hosting', 'domain registration', 'job openings', 'careers page',
  'university', 'college degree', 'insurance quote',
];

const SWEEPS_KEYWORDS = [
  'sweepstakes casino', 'sweeps coins', 'sweep coins', 'sweeps cash',
  'gold coins', 'social casino', 'no purchase necessary', 'sweeps coins',
  'free sweeps', 'sweepstakes model', 'sweeps coin', 'play for free',
  'redeem sweeps', 'sweeps coins casino',
];

const STRONG_HOSTNAME_MARKERS = ['casino', 'sweep', 'sweeps', 'slots', 'pulsz', 'chumba', 'mcluck', 'vegas', 'coins'];

export interface PageValidationResult {
  valid: boolean;
  reason?: string;
  sweepsKeywordCount: number;
}

export function isBlockedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAIN_FRAGMENTS.some((frag) => host.includes(frag));
  } catch {
    return true;
  }
}

export function isCasinoCandidateUrl(url: string): boolean {
  return isDiscoveryCandidateUrl(url);
}

/** Broader net for discovery queue — strict page validation still required before add. */
export function isDiscoveryCandidateUrl(url: string): boolean {
  if (isBlockedDomain(url)) return false;
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '');
    const operatorRoot = getOperatorRootHost(host);
    if (!operatorRoot) return false;

    if (STRONG_HOST_HINTS.some((hint) => operatorRoot.includes(hint.replace('.', '')))) {
      return true;
    }

    const parts = operatorRoot.split('.');
    const tld = parts[parts.length - 1] ?? '';
    const discoveryHints = [
      'sweep', 'sweeps', 'casino', 'slots', 'spin', 'coins', 'social',
      'play', 'win', 'luck', 'vegas', 'bonanza', 'fortune', 'million', 'jackpot', 'game',
    ];
    if ((tld === 'us' || tld === 'com' || tld === 'io') && discoveryHints.some((h) => operatorRoot.includes(h))) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function validateSweepstakesPage(
  title: string,
  metaDesc: string,
  bodyText: string,
  url: string,
): PageValidationResult {
  const combined = `${title} ${metaDesc} ${bodyText}`.toLowerCase();
  const host = new URL(url).hostname.toLowerCase();

  if (isBlockedDomain(url)) {
    return { valid: false, reason: 'blocked domain', sweepsKeywordCount: 0 };
  }

  if (ADULT_KEYWORDS.some((k) => combined.includes(k))) {
    return { valid: false, reason: 'adult content', sweepsKeywordCount: 0 };
  }

  if (NEWS_KEYWORDS.some((k) => combined.includes(k))) {
    return { valid: false, reason: 'news/media site', sweepsKeywordCount: 0 };
  }

  if (GENERIC_REJECT_KEYWORDS.some((k) => combined.includes(k))) {
    return { valid: false, reason: 'generic non-casino site', sweepsKeywordCount: 0 };
  }

  const sweepsKeywordCount = SWEEPS_KEYWORDS.filter((k) => combined.includes(k)).length;
  const hostHasMarker = STRONG_HOSTNAME_MARKERS.some((m) => host.includes(m));

  if (sweepsKeywordCount >= 2) {
    return { valid: true, sweepsKeywordCount };
  }

  if (sweepsKeywordCount >= 1 && hostHasMarker) {
    return { valid: true, sweepsKeywordCount };
  }

  if (hostHasMarker && combined.includes('sweepstakes') && combined.includes('casino')) {
    return { valid: true, sweepsKeywordCount };
  }

  return { valid: false, reason: 'insufficient sweepstakes signals', sweepsKeywordCount };
}

export function sanitizeCasinoName(title: string, url: string): string {
  const host = casinoHostKey(url);
  const brand = host.split('.')[0];
  const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);

  const cleaned = title
    .split('|')[0]
    .split('-')[0]
    .split('–')[0]
    .split(':')[0]
    .trim()
    .slice(0, 80);

  const rejectTitlePatterns = [
    'news', 'blog', 'review', 'guide', 'best ', 'top ',
    'sign up', 'signup', 'sign-up', 'log in', 'login', 'register',
    'vip program', 'vip ', 'social casino', 'sweepstakes rules', 'rules',
    'terms', 'privacy', 'support', 'help', 'contact', 'promo', 'welcome',
    'free coins', 'free sweeps', 'official site', 'home page', 'homepage',
  ];

  const lower = cleaned.toLowerCase();
  if (
    !cleaned ||
    cleaned.length < 3 ||
    rejectTitlePatterns.some((p) => lower.includes(p)) ||
    lower === 'casino' ||
    lower === 'home'
  ) {
    return brandName;
  }

  return cleaned;
}
