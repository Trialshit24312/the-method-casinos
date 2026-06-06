/**
 * Strict filters — discovery must never add news, adult, social, or generic sites.
 * Only real sweepstakes casino operators pass validation.
 */

import { casinoHostKey, getOperatorRootHost, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';

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
  // News / media — not operators (list sites handled via isSweepstakesDirectoryUrl)
  'schema.org', 'w3.org', 'example.com', 'example.org',
  'hackerone.', 'livescore.', 'pokerfuse.', 'oddspedia.',
  'soo-foo.', 'sweepstate.', 'stakester.',
  'bonus.com', 'bonuses.com', 'bonuses.', 'casinobonus', 'playtoday.',
  'sportsbook', 'draftkings.', 'fanduel.',
  'nj.com', 'al.com', 'silive.', 'mlive.', 'pennlive.', 'cleveland.com',
  'syracuse.com', 'masslive.', 'oregonlive.', 'chicagotribune.',
  // Third-party scripts, CDNs, widgets — never sweepstakes operators
  'googletagmanager.', 'google-analytics.', 'googleadservices.', 'doubleclick.',
  'googleapis.', 'gstatic.', 'googleusercontent.', 'facebook.', 'fbcdn.',
  'whatsapp.', 'rankmath.', 'optinmonster.', 'yoast.', 'fontawesome.',
  'cloudflare.', 'cloudfront.', 'jsdelivr.', 'unpkg.', 'bootstrapcdn.',
  'jquery.', 'typekit.', 'hotjar.', 'segment.', 'sentry.io', 'stripe.com',
  'addthis.', 'sharethis.', 'disqus.', 'gravatar.', 'wp-content', 'wp-includes',
  'elementor.', 'wordfence.', 'jetpack.', 'scoresandodds.', 'oddsshark.',
  'scoreboard.', 'sportradar.', 'taboola.', 'outbrain.', 'criteo.',
];

/** Hostname substrings / labels that are never casino operators (analytics, CDNs, plugins). */
const NON_OPERATOR_HOST_FRAGMENTS = [
  'googletagmanager', 'google-analytics', 'gtag', 'doubleclick', 'googleadservices',
  'googleapis', 'gstatic', 'facebook', 'fbcdn', 'whatsapp', 'rankmath', 'optinmonster',
  'yoast', 'fontawesome', 'cloudflare', 'cloudfront', 'jsdelivr', 'unpkg', 'bootstrap',
  'jquery', 'typekit', 'hotjar', 'segment.', 'addthis', 'sharethis', 'disqus',
  'gravatar', 'wp-content', 'wp-includes', 'elementor', 'wordfence', 'scoresandodds',
  'oddsshark', 'taboola', 'outbrain', 'criteo', 'mailchimp', 'hubspot', 'intercom',
  'zendesk', 'recaptcha', 'newrelic', 'datadog', 'cookiebot', 'onetrust',
];

const NON_OPERATOR_HOST_PREFIXES = ['cdn', 'static', 'assets', 'js.', 'img.', 'media.', 'track.', 'analytics.'];

const LONG_CASINO_BRAND_HINTS = [
  'sweep', 'sweeps', 'casino', 'slots', 'spin', 'coins', 'social', 'vegas', 'bonanza',
  'fortune', 'million', 'jackpot', 'chumba', 'pulsz', 'mcluck', 'wowvegas', 'crowncoin',
  'stake', 'luckyland', 'modo', 'sportzino', 'realprize', 'funzpoints', 'high5',
];

const SHORT_CASINO_BRAND_PREFIXES = ['play', 'win', 'luck', 'game', 'fun', 'gold', 'roll', 'prize', 'spin'];

const STRONG_HOST_HINTS = [
  'casino', 'sweep', 'sweeps', 'chumba', 'pulsz', 'mcluck', 'stake.us', 'stakeus',
  'wowvegas', 'crowncoin', 'fortunecoins', 'luckyland', 'high5casino', 'globalpoker',
  'modo.us', 'zulacasino', 'hellomillions', 'jackpota', 'funzpoints', 'sportzino',
  'realprize', 'spinblitz', 'goldenhearts', 'getfliff', 'babacasino', 'megabonanza',
  'moonspin', 'nolimitcoins', 'taofortune', 'rollingriches', 'sweepslots',
  'chipnwin', 'luckybird', 'acornfun', 'vivaro', 'pulszbingo', 'slots',
  'vegas', 'bonanza', 'million', 'fortune', 'coins', 'playfame', 'lonestar',
  'spree', 'rolla', 'spinfinite', 'scrooge', 'myprize', 'funrize', 'stackr',
  'lucky', 'spin', 'win', 'prize', 'social', 'play', 'game', 'fun', 'gold',
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
  'gold coins', 'social casino', 'no purchase necessary',
  'free sweeps', 'sweepstakes model', 'sweeps coin', 'play for free',
  'redeem sweeps', 'sweeps coins casino', 'sc coins', 'sweepscash',
  'purchase necessary', 'redeem prizes', 'redeemable', 'social gaming',
  'free to play', 'sweeps cash prizes', 'fun coins', 'sweep coins casino',
  'no purchase', 'gold coin', 'sweepstakes gaming', 'sweeps model',
];

const STRONG_HOSTNAME_MARKERS = ['casino', 'sweep', 'sweeps', 'slots', 'pulsz', 'chumba', 'mcluck', 'vegas', 'coins'];

/** Hosts/paths that publish large sweepstakes casino lists — crawl for outbound operator links only. */
const DIRECTORY_HOST_FRAGMENTS = [
  'sweepskings', 'sweepslounge', 'playusa.', 'dimers.', 'legalsportsreport.',
  'casino.org', 'gambling.com', 'deadspin.', 'oddschecker.',
  'vegasinsider.', 'askgamblers.', 'onlinecasino', 'playtoday.', 'sigma.world',
  'next.io', 'ballislife.', 'lines.com',
  'igamingfuture.', 'gamingamerica.', 'pantagraph.', 'rg.org', 'covers.com',
  'pokernews.', 'oddspedia.',
];

const DIRECTORY_PATH_PATTERN =
  /\/(sweepstakes?|social-casinos?|sweeps?)(-casinos?)?(\/|$)|\/(list|directory|guide|roundup|reviews?)(\/|$)|((all|complete|full|master)[-_]?(list|guide))|sweepstakes?[-_]casinos?[-_]list/i;

export function isSweepstakesDirectoryUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.toLowerCase();
    const path = `${u.pathname}${u.search}`.toLowerCase();
    if (DIRECTORY_HOST_FRAGMENTS.some((frag) => host.includes(frag))) return true;
    if (DIRECTORY_PATH_PATTERN.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

export interface PageValidationResult {
  valid: boolean;
  reason?: string;
  sweepsKeywordCount: number;
}

export function isBlockedDomain(url: string): boolean {
  if (isSweepstakesDirectoryUrl(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (isNonOperatorInfrastructureHost(host)) return true;
    return BLOCKED_DOMAIN_FRAGMENTS.some((frag) => host.includes(frag));
  } catch {
    return true;
  }
}

/** Analytics, CDNs, WordPress plugins, social widgets — not sweepstakes operators. */
export function isNonOperatorInfrastructureHost(hostOrUrl: string): boolean {
  try {
    const host = hostOrUrl.includes('://')
      ? new URL(hostOrUrl).hostname.toLowerCase()
      : hostOrUrl.toLowerCase().replace(/^www\./, '');
    const operatorRoot = getOperatorRootHost(host) ?? host;
    const brand = operatorRoot.split('.')[0] ?? host;

    if (NON_OPERATOR_HOST_FRAGMENTS.some(
      (frag) => host.includes(frag) || brand === frag || brand.startsWith(frag),
    )) {
      return true;
    }

    if (brandMatchesCasinoPattern(brand, operatorRoot)) {
      return false;
    }

    if (NON_OPERATOR_HOST_PREFIXES.some((p) => host.startsWith(p) || host.includes(`.${p}`))) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

function brandMatchesCasinoPattern(brand: string, operatorRoot: string): boolean {
  if (STRONG_HOST_HINTS.some((hint) => {
    const needle = hint.replace('.', '');
    return brand.includes(needle) || operatorRoot.includes(hint);
  })) {
    return true;
  }
  if (LONG_CASINO_BRAND_HINTS.some((h) => brand.includes(h))) return true;
  return SHORT_CASINO_BRAND_PREFIXES.some((h) => brand.startsWith(h) || brand.endsWith(h));
}

/** Queue from search results — operators or sweepstakes list pages (mined for links). */
export function shouldQueueSearchUrl(url: string): boolean {
  if (isSweepstakesDirectoryUrl(url)) return true;
  if (isBlockedDomain(url)) return false;
  try {
    const root = toCasinoRootUrl(url);
    const host = casinoHostKey(root);
    if (!isValidCasinoHost(host)) return false;
    return isDiscoveryCandidateUrl(root);
  } catch {
    return false;
  }
}

/** Broader net for discovery queue — strict page validation still required before add. */
export function isDiscoveryCandidateUrl(url: string): boolean {
  if (isBlockedDomain(url)) return false;
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '');
    if (isNonOperatorInfrastructureHost(host)) return false;
    const operatorRoot = getOperatorRootHost(host);
    if (!operatorRoot) return false;

    const parts = operatorRoot.split('.');
    const tld = parts[parts.length - 1] ?? '';
    const brand = parts[0] ?? '';

    if (brandMatchesCasinoPattern(brand, operatorRoot)) return true;

    // Most US sweepstakes operators use .us domains
    if (tld === 'us' && brand.length >= 3 && /^[a-z0-9-]+$/.test(brand)) {
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

  if (isNonOperatorInfrastructureHost(host)) {
    return { valid: false, reason: 'third-party / infrastructure host', sweepsKeywordCount: 0 };
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
  const isUsOperator = host.endsWith('.us');

  if (sweepsKeywordCount >= 2) {
    return { valid: true, sweepsKeywordCount };
  }

  if (sweepsKeywordCount >= 1 && (hostHasMarker || isUsOperator)) {
    return { valid: true, sweepsKeywordCount };
  }

  if (hostHasMarker && (
    combined.includes('gold coins') ||
    combined.includes('sweeps coins') ||
    combined.includes('social casino') ||
    combined.includes('free to play') ||
    combined.includes('no purchase')
  )) {
    return { valid: true, sweepsKeywordCount: Math.max(sweepsKeywordCount, 1) };
  }

  if ((hostHasMarker || isUsOperator) && combined.includes('sweepstakes') && (
    combined.includes('casino') || combined.includes('coins') || combined.includes('play')
  )) {
    return { valid: true, sweepsKeywordCount: Math.max(sweepsKeywordCount, 1) };
  }

  if (isUsOperator && sweepsKeywordCount >= 1) {
    return { valid: true, sweepsKeywordCount };
  }

  // Operator-shaped .us / casino hosts — queue for review even when page copy is thin (SPA / bot wall)
  if (isUsOperator && brandFromHost(host).length >= 3) {
    return { valid: true, sweepsKeywordCount: Math.max(sweepsKeywordCount, 1) };
  }

  if (hostHasMarker && (tldIsOperator(host) || combined.includes('casino') || combined.includes('sweeps'))) {
    return { valid: true, sweepsKeywordCount: Math.max(sweepsKeywordCount, 1) };
  }

  return { valid: false, reason: 'insufficient sweepstakes signals', sweepsKeywordCount };
}

function brandFromHost(host: string): string {
  return host.replace(/^www\./, '').split('.')[0] ?? '';
}

function tldIsOperator(host: string): boolean {
  const tld = host.split('.').pop() ?? '';
  return tld === 'us' || tld === 'com' || tld === 'io';
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
