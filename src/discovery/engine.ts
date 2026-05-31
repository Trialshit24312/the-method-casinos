import * as cheerio from 'cheerio';
import type { CasinoFeature, DiscoveryProgressEvent, DiscoveryResult, DiscoveryPhase, DiscoveryLiveStats } from '../shared/types.js';
import { addCasino, getKnownUrls, logDiscovery, getBlockedUrls, isUrlBlocked, getDiscoverySeenUrls, markDiscoverySeen, getAllCasinos } from '../database/index.js';
import { ensureHttps, normalizeUrl } from '../shared/utils.js';
import { inferRating } from '../shared/rating.js';
import {
  isDiscoveryCandidateUrl,
  isBlockedDomain,
  validateSweepstakesPage,
  sanitizeCasinoName,
} from './filters.js';
import { getVerifiedCuratedDiscoveries } from '../shared/verified-casinos.js';
import { buildSearchQueries, SEARCH_PAGES_DEEP, SEARCH_PAGES_QUICK } from './queries.js';

export type DiscoveryProgressCallback = (event: DiscoveryProgressEvent) => void;

interface RawDiscovery {
  name: string;
  url: string;
  description: string;
  features: CasinoFeature[];
  signupRequirements: string[];
  bonusInfo?: string;
  rating?: number;
  source: string;
}

interface ScanConfig {
  mode: 'quick' | 'deep';
  maxDurationMs: number;
  delayMs: number;
  maxWebAnalyzes: number;
  searchPages: number;
  crawlLinks: boolean;
  crawlKnownCasinos: boolean;
}

const QUICK_CONFIG: ScanConfig = {
  mode: 'quick',
  maxDurationMs: 8 * 60 * 1000,
  delayMs: 200,
  maxWebAnalyzes: 200,
  searchPages: SEARCH_PAGES_QUICK,
  crawlLinks: false,
  crawlKnownCasinos: true,
};

const DEEP_CONFIG: ScanConfig = {
  mode: 'deep',
  maxDurationMs: 30 * 60 * 1000,
  delayMs: 250,
  maxWebAnalyzes: 800,
  searchPages: SEARCH_PAGES_DEEP,
  crawlLinks: true,
  crawlKnownCasinos: true,
};

const FETCH_TIMEOUT_MS = 12_000;

const VPN_BLOCKED_KEYWORDS = ['vpn not allowed', 'vpn blocked', 'no vpn', 'vpn prohibited', 'vpn detected', 'disable vpn'];
const VPN_ALLOWED_KEYWORDS = ['vpn allowed', 'vpn friendly', 'works with vpn', 'vpn ok', 'vpn supported'];
const GEO_RESTRICTED_KEYWORDS = ['geo restricted', 'not available in your region', 'not available in your state', 'region locked'];
const NO_PHONE_KEYWORDS = ['no phone', 'email only', 'email signup', 'no verification', 'no sms'];
const SLOT_KEYWORDS = ['slots', 'slot games', 'spin', 'jackpot'];
const LIVE_KEYWORDS = ['live dealer', 'live casino', 'live games'];

const URL_IN_TEXT_REGEX = /https?:\/\/(?:www\.)?[a-z0-9][-a-z0-9]{0,62}\.[a-z]{2,24}(?:\/[^\s"'<>]*)?/gi;

const CURATED_DISCOVERIES: RawDiscovery[] = getVerifiedCuratedDiscoveries();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveRedirectUrl(href: string, baseUrl: string): string | null {
  try {
    let absolute = href;
    if (href.startsWith('//')) absolute = `https:${href}`;
    else if (href.startsWith('/')) absolute = new URL(href, baseUrl).href;
    else if (!href.startsWith('http')) absolute = new URL(href, baseUrl).href;

    const parsed = new URL(absolute);

    if (parsed.hostname.includes('duckduckgo.com') && parsed.searchParams.has('uddg')) {
      return decodeURIComponent(parsed.searchParams.get('uddg')!);
    }
    if (parsed.hostname.includes('bing.com') && parsed.pathname.includes('ck/a')) {
      const u = parsed.searchParams.get('u');
      if (u) {
        try {
          return atob(u.startsWith('a1') ? u.slice(2) : u);
        } catch {
          return decodeURIComponent(u);
        }
      }
    }

    return absolute;
  } catch {
    return null;
  }
}

function extractUrlsFromHtml(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const $ = cheerio.load(html);

  $('a.result__a, a.result-link, a[data-testid="result-title-a"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const resolved = resolveRedirectUrl(href, baseUrl);
    if (resolved && isDiscoveryCandidateUrl(resolved) && !isBlockedDomain(resolved)) {
      links.add(ensureHttps(resolved.split('#')[0].replace(/\/+$/, '') || resolved));
    }
  });

  $('li.b_algo h2 a, .b_algo cite').each((_, el) => {
    const href = $(el).attr('href') || $(el).text();
    if (!href) return;
    const resolved = resolveRedirectUrl(href.startsWith('http') ? href : `https://${href}`, baseUrl);
    if (resolved && isDiscoveryCandidateUrl(resolved) && !isBlockedDomain(resolved)) {
      links.add(ensureHttps(resolved.split('#')[0].replace(/\/+$/, '') || resolved));
    }
  });

  const textUrls = html.match(URL_IN_TEXT_REGEX) || [];
  for (const raw of textUrls) {
    const clean = raw.replace(/[),.;]+$/, '');
    if (isDiscoveryCandidateUrl(clean) && !isBlockedDomain(clean)) {
      links.add(ensureHttps(clean.split('#')[0]));
    }
  }

  return [...links];
}

function inferFeatures(text: string): CasinoFeature[] {
  const lower = text.toLowerCase();
  const features: CasinoFeature[] = ['sweepstakes'];
  if (NO_PHONE_KEYWORDS.some((k) => lower.includes(k))) features.push('no_phone', 'email_only');
  if (SLOT_KEYWORDS.some((k) => lower.includes(k))) features.push('slots');
  if (LIVE_KEYWORDS.some((k) => lower.includes(k))) features.push('live_games');
  if (lower.includes('table') || lower.includes('poker') || lower.includes('blackjack')) features.push('table_games');
  if (lower.includes('sport')) features.push('sports');
  if (lower.includes('crypto') || lower.includes('bitcoin')) features.push('crypto');
  if (lower.includes('instant') || lower.includes('no download')) features.push('instant_play');
  if (VPN_BLOCKED_KEYWORDS.some((k) => lower.includes(k))) features.push('vpn_blocked');
  else if (VPN_ALLOWED_KEYWORDS.some((k) => lower.includes(k))) features.push('vpn_allowed');
  if (GEO_RESTRICTED_KEYWORDS.some((k) => lower.includes(k))) features.push('geo_restricted');
  if (lower.includes('no kyc')) features.push('no_kyc');
  if (lower.includes('daily bonus') || lower.includes('login bonus')) features.push('daily_bonus');
  if (lower.includes('welcome bonus') || lower.includes('welcome offer')) features.push('welcome_bonus');
  if (lower.includes('signup bonus') || lower.includes('sign-up bonus') || lower.includes('sign up bonus')) features.push('signup_bonus');
  if (lower.includes('no wagering') || lower.includes('zero wagering')) features.push('no_wagering');
  if (lower.includes('multiple states') || lower.includes('multi-state') || lower.includes('available in')) features.push('multi_state');
  if (lower.includes('pragmatic play') || lower.includes('pragmatic')) features.push('pragmatic_play');
  if (lower.includes('gift card')) features.push('gift_card_redeem');
  if (lower.includes('paypal')) features.push('paypal_redeem');
  if (lower.includes('mobile app')) features.push('mobile_app');
  if (lower.includes('bingo')) features.push('bingo');
  if (lower.includes('fish game') || lower.includes('fish shoot')) features.push('fish_games');
  if (lower.includes('poker')) features.push('poker');
  if (lower.includes('wheel') || lower.includes('spin wheel')) features.push('wheel_spin');
  if (lower.includes('no deposit') || lower.includes('free bonus')) features.push('no_deposit_bonus');
  if (lower.includes('venmo')) features.push('venmo_redeem');
  if (lower.includes('apple pay')) features.push('apple_pay');
  if (lower.includes('us only') || lower.includes('usa only')) features.push('us_only');
  if (lower.includes('progressive jackpot') || lower.includes('progressive')) features.push('progressive_jackpot');
  if (lower.includes('social') || lower.includes('friends')) features.push('social_features');
  if (lower.includes('web only') || lower.includes('browser only')) features.push('web_only');
  if (lower.includes('new casino') || lower.includes('just launched')) features.push('new_casino');
  if (lower.includes('cash app')) features.push('cash_app');
  if (lower.includes('zelle')) features.push('zelle_redeem');
  if (lower.includes('scratch')) features.push('scratch_cards');
  if (lower.includes('tournament')) features.push('tournaments');
  if (lower.includes('vip')) features.push('vip_program');
  if (lower.includes('android')) features.push('android_app');
  if (lower.includes('ios') || lower.includes('iphone')) features.push('ios_app');
  if (lower.includes('plinko')) features.push('plinko');
  if (lower.includes('keno')) features.push('keno');
  if (lower.includes('free spin')) features.push('free_spins');
  if (lower.includes('loyalty') || lower.includes('vip tier')) features.push('loyalty_program');
  if (lower.includes('blackjack')) features.push('blackjack');
  if (lower.includes('roulette')) features.push('roulette');
  if (lower.includes('crash game') || lower.includes('aviator')) features.push('crash_games');
  if (lower.includes('megaways')) features.push('megaways');
  if (lower.includes('hold and win') || lower.includes('hold & win')) features.push('hold_and_win');
  if (lower.includes('debit card')) features.push('debit_card_redeem');
  if (lower.includes('ach') || lower.includes('direct bank')) features.push('ach_redeem');
  if (lower.includes('live chat') || lower.includes('24/7 support')) features.push('live_chat');
  if (!features.includes('no_phone') && lower.includes('sign up')) features.push('email_only');
  return [...new Set(features)];
}

async function fetchPage(url: string, retries = 1): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      return await res.text();
    } catch {
      if (attempt < retries) await sleep(400);
    }
  }
  return null;
}

function buildDdgUrl(query: string, page = 0): string {
  const base = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  return page > 0 ? `${base}&s=${page * 30}` : base;
}

function buildBingUrl(query: string, page = 0): string {
  const first = 1 + page * 10;
  return `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=50`;
}

async function analyzeUrl(url: string, knownUrls: Set<string>): Promise<{ raw: RawDiscovery | null; rejectReason?: string }> {
  if (knownUrls.has(normalizeUrl(url))) return { raw: null, rejectReason: 'already known' };
  if (isBlockedDomain(url) || !isDiscoveryCandidateUrl(url)) {
    return { raw: null, rejectReason: 'not a casino candidate URL' };
  }

  const html = await fetchPage(ensureHttps(url));
  if (!html) return { raw: null, rejectReason: 'fetch failed' };

  const $ = cheerio.load(html);
  const title = $('title').text().trim() || new URL(url).hostname;
  const bodyText = $('body').text().replace(/\s+/g, ' ').slice(0, 6000);
  const metaDesc = $('meta[name="description"]').attr('content') || '';

  const validation = validateSweepstakesPage(title, metaDesc, bodyText, url);
  if (!validation.valid) {
    return { raw: null, rejectReason: validation.reason ?? 'validation failed' };
  }

  const combined = `${title} ${metaDesc} ${bodyText}`.toLowerCase();
  const features = inferFeatures(combined);
  const name = sanitizeCasinoName(title, url);

  return {
    raw: {
      name,
      url: ensureHttps(url),
      description: metaDesc || `Verified sweepstakes casino — ${features.slice(0, 4).join(', ')}`,
      features,
      signupRequirements: features.includes('email_only') ? ['Email', 'Password'] : ['Email'],
      bonusInfo: combined.includes('bonus') ? 'Bonus offers available' : '',
      rating: inferRating(features, { source: 'web_scan' }),
      source: 'web_scan',
    },
  };
}

function ingestDiscovery(raw: RawDiscovery, knownUrls: Set<string>): boolean {
  if (isUrlBlocked(raw.url)) return false;
  if (knownUrls.has(normalizeUrl(raw.url))) return false;
  const result = addCasino({
    name: raw.name,
    url: raw.url,
    description: raw.description,
    features: raw.features,
    signupRequirements: raw.signupRequirements,
    bonusInfo: raw.bonusInfo,
    rating: raw.rating ?? inferRating(raw.features, { source: raw.source }),
    source: raw.source,
    verified: false,
  });
  if (result) knownUrls.add(normalizeUrl(raw.url));
  return result !== null;
}

async function collectFromSearch(
  query: string,
  knownUrls: Set<string>,
  seenUrls: Set<string>,
  urls: Set<string>,
  searchPages: number,
  onProgress?: DiscoveryProgressCallback,
): Promise<number> {
  let checked = 0;

  for (let page = 0; page < searchPages; page++) {
    const engines: { engine: 'duckduckgo' | 'bing'; url: string }[] = [
      { engine: 'duckduckgo', url: buildDdgUrl(query, page) },
      { engine: 'bing', url: buildBingUrl(query, page) },
    ];

    for (const { engine, url: searchUrl } of engines) {
      checked++;
      onProgress?.({ type: 'search_engine', engine, query: page > 0 ? `${query} (p${page + 1})` : query });
      const html = await fetchPage(searchUrl);
      if (html) {
        for (const link of extractUrlsFromHtml(html, searchUrl)) {
          const key = normalizeUrl(link);
          if (!knownUrls.has(key) && !seenUrls.has(key)) urls.add(link);
        }
      }
      await sleep(180);
    }
  }

  return checked;
}

async function crawlKnownCasinosForLinks(
  enqueue: (url: string) => void,
  onProgress?: DiscoveryProgressCallback,
  limit = 40,
): Promise<number> {
  const casinos = getAllCasinos();
  const shuffled = casinos.sort(() => Math.random() - 0.5).slice(0, limit);
  let crawled = 0;

  for (const casino of shuffled) {
    onProgress?.({ type: 'url_scanning', url: casino.url });
    const html = await fetchPage(casino.url);
    crawled++;
    if (html) {
      for (const link of extractUrlsFromHtml(html, casino.url)) enqueue(link);
    }
    await sleep(150);
  }

  return crawled;
}

export async function runDiscovery(deep = false, onProgress?: DiscoveryProgressCallback): Promise<DiscoveryResult> {
  const config = deep ? DEEP_CONFIG : QUICK_CONFIG;
  const searchQueries = buildSearchQueries(deep);
  const startTime = Date.now();
  const errors: string[] = [];
  let scanned = 0;
  let found = 0;
  let added = 0;
  let skipped = 0;
  let blocked = 0;
  let rejected = 0;
  let sourcesChecked = 0;
  let webAnalyzes = 0;
  let phase: DiscoveryPhase = 'search';
  let queryIndex = 0;
  const addedCasinos: { name: string; url: string }[] = [];

  const knownUrls = getKnownUrls();
  const seenUrls = getDiscoverySeenUrls();
  const blockedUrls = getBlockedUrls();
  const urlQueue: string[] = [];
  const queued = new Set<string>();
  const pendingFromSearch = new Set<string>();
  const curatedByUrl = new Map(CURATED_DISCOVERIES.map((c) => [normalizeUrl(c.url), c]));
  const sessionSeen = new Set<string>();

  const emitProgress = () => {
    const stats: DiscoveryLiveStats = {
      scanned,
      queued: urlQueue.length - queueIndex,
      added,
      rejected,
      skipped,
      blocked,
      sourcesChecked,
      phase,
      queryIndex,
      queryTotal: searchQueries.length,
    };
    onProgress?.({ type: 'progress', stats });
  };

  const setPhase = (next: DiscoveryPhase, label: string) => {
    phase = next;
    onProgress?.({ type: 'phase', phase: next, label });
    emitProgress();
  };

  const shouldSkipUrl = (key: string): boolean =>
    knownUrls.has(key) || seenUrls.has(key) || sessionSeen.has(key);

  const enqueue = (url: string, silent = false): boolean => {
    const key = normalizeUrl(url);
    if (shouldSkipUrl(key) || queued.has(key)) return false;

    if (blockedUrls.has(key) || isUrlBlocked(url)) {
      blocked++;
      markDiscoverySeen(url, 'blocked', 'blocklist');
      if (!silent) onProgress?.({ type: 'url_blocked', url });
      return false;
    }

    if (!isDiscoveryCandidateUrl(url) || isBlockedDomain(url)) {
      markDiscoverySeen(url, 'rejected', 'URL pre-filter');
      return false;
    }

    queued.add(key);
    urlQueue.push(ensureHttps(url));
    emitProgress();
    return true;
  };

  const timeLeft = () => config.maxDurationMs - (Date.now() - startTime);
  let queueIndex = 0;

  // Only add missing verified operators (silent — no re-scanning known catalog)
  setPhase('curated', 'Checking for missing verified operators…');
  for (const raw of CURATED_DISCOVERIES) {
    const key = normalizeUrl(raw.url);
    if (knownUrls.has(key)) continue;
    if (ingestDiscovery(raw, knownUrls)) {
      added++;
      found++;
      addedCasinos.push({ name: raw.name, url: raw.url });
      onProgress?.({ type: 'url_added', url: raw.url, name: raw.name });
    }
  }
  emitProgress();

  if (config.crawlKnownCasinos) {
    setPhase('crawl', `Mining links from ${deep ? 'all' : 'sample'} known casinos…`);
    sourcesChecked += await crawlKnownCasinosForLinks(
      (url) => { enqueue(url, true); },
      onProgress,
      deep ? 80 : 25,
    );
  }

  setPhase('search', `Running ${searchQueries.length} unique searches (${config.searchPages} pages each)…`);
  for (queryIndex = 0; queryIndex < searchQueries.length && timeLeft() > 0; queryIndex++) {
    const query = searchQueries[queryIndex];
    onProgress?.({ type: 'search_query', query });
    try {
      sourcesChecked += await collectFromSearch(
        query,
        knownUrls,
        seenUrls,
        pendingFromSearch,
        config.searchPages,
        onProgress,
      );
      for (const u of pendingFromSearch) enqueue(u, true);
      pendingFromSearch.clear();
    } catch (e) {
      errors.push(`Search: ${e instanceof Error ? e.message : 'unknown'}`);
    }
    emitProgress();

    // Analyze queue between searches so we don't only search forever
    while (queueIndex < urlQueue.length && timeLeft() > 0 && webAnalyzes < config.maxWebAnalyzes) {
      const processed = await processQueueBatch(1);
      if (processed === 0) break;
    }

    await sleep(config.delayMs);
  }

  setPhase('analyze', 'Validating remaining candidate URLs…');
  while (queueIndex < urlQueue.length && timeLeft() > 0 && webAnalyzes < config.maxWebAnalyzes) {
    await processQueueBatch(1);
  }

  async function processQueueBatch(batchSize: number): Promise<number> {
    let processed = 0;

    while (processed < batchSize && queueIndex < urlQueue.length && timeLeft() > 0 && webAnalyzes < config.maxWebAnalyzes) {
      const url = urlQueue[queueIndex++];
      const key = normalizeUrl(url);
      sessionSeen.add(key);

      if (knownUrls.has(key)) continue;

      if (blockedUrls.has(key) || isUrlBlocked(url)) {
        blocked++;
        markDiscoverySeen(url, 'blocked', 'blocklist');
        continue;
      }

      const curated = curatedByUrl.get(key);
      if (curated) {
        found++;
        if (ingestDiscovery(curated, knownUrls)) {
          added++;
          addedCasinos.push({ name: curated.name, url: curated.url });
          onProgress?.({ type: 'url_added', url, name: curated.name });
        }
        continue;
      }

      if (seenUrls.has(key)) continue;

      scanned++;
      webAnalyzes++;
      onProgress?.({ type: 'url_scanning', url });
      emitProgress();

      try {
        const { raw: analyzed, rejectReason } = await analyzeUrl(url, knownUrls);
        if (!analyzed) {
          rejected++;
          markDiscoverySeen(url, 'rejected', rejectReason ?? 'validation failed');
          onProgress?.({ type: 'url_rejected', url, reason: rejectReason ?? 'not a sweepstakes casino' });
          await sleep(config.delayMs / 3);
          processed++;
          continue;
        }

        found++;
        if (ingestDiscovery(analyzed, knownUrls)) {
          added++;
          markDiscoverySeen(url, 'added', 'verified sweeps');
          addedCasinos.push({ name: analyzed.name, url: analyzed.url });
          onProgress?.({ type: 'url_added', url, name: analyzed.name });

          if (config.crawlLinks) {
            const pageHtml = await fetchPage(analyzed.url);
            if (pageHtml) {
              for (const link of extractUrlsFromHtml(pageHtml, analyzed.url)) enqueue(link, true);
            }
          }
        } else {
          skipped++;
          markDiscoverySeen(url, 'skipped', 'duplicate');
        }
      } catch (e) {
        rejected++;
        markDiscoverySeen(url, 'rejected', 'scan error');
        errors.push(`${url.slice(0, 60)}: ${e instanceof Error ? e.message : 'fail'}`);
        onProgress?.({ type: 'url_rejected', url, reason: 'scan error' });
      }

      emitProgress();
      processed++;
      await sleep(config.delayMs);
    }

    return processed;
  }

  const durationMs = Date.now() - startTime;
  logDiscovery(found, added, skipped, errors);

  const result: DiscoveryResult = {
    scanned,
    found,
    added,
    skipped,
    blocked,
    rejected,
    durationMs,
    sourcesChecked,
    errors,
    mode: config.mode,
    addedCasinos: addedCasinos.slice(0, 50),
  };
  onProgress?.({ type: 'complete', result });
  return result;
}

export { CURATED_DISCOVERIES, ingestDiscovery, analyzeUrl };
