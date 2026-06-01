import * as cheerio from 'cheerio';
import type { CasinoFeature, DiscoveryProgressEvent, DiscoveryResult, DiscoveryPhase, DiscoveryLiveStats } from '../shared/types.js';
import { addCasino, getKnownHosts, logDiscovery, getBlockedUrls, isUrlBlocked, getDiscoverySeenHosts, markDiscoverySeen, getAllCasinos, touchLastCheckedAt } from '../database/index.js';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import { inferRating } from '../shared/rating.js';
import {
  isDiscoveryCandidateUrl,
  isBlockedDomain,
  validateSweepstakesPage,
  sanitizeCasinoName,
  shouldQueueSearchUrl,
} from './filters.js';
import { getVerifiedCuratedDiscoveries } from '../shared/verified-casinos.js';
import { buildSearchQueries, SEARCH_PAGES_DEEP, SEARCH_PAGES_QUICK } from './queries.js';
import { isSerperEnabled, searchSerper } from './serper.js';
import { beginDiscoveryRun, endDiscoveryRun, throwIfCancelled } from './run-state.js';
import { notifyDiscoveryComplete } from '../shared/notify.js';

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

function resolveRedirectUrl(href: string, baseUrl: string, depth = 0): string | null {
  if (depth > 4) return null;
  try {
    let absolute = href;
    if (href.startsWith('//')) absolute = `https:${href}`;
    else if (href.startsWith('/')) absolute = new URL(href, baseUrl).href;
    else if (!href.startsWith('http')) absolute = new URL(href, baseUrl).href;

    const parsed = new URL(absolute);

    if (parsed.hostname.includes('duckduckgo.com')) {
      const raw = absolute;
      const adDomain = raw.match(/ad_domain=([a-z0-9.-]+\.[a-z]{2,})/i)?.[1];
      if (adDomain) return `https://${adDomain.replace(/^www\./, '')}`;

      if (parsed.searchParams.has('uddg')) {
        const uddg = decodeURIComponent(parsed.searchParams.get('uddg')!);
        const nested = resolveRedirectUrl(uddg, baseUrl, depth + 1);
        if (nested) return nested;
      }
    }

    if (parsed.hostname.includes('bing.com') && parsed.pathname.includes('ck/a')) {
      const u = parsed.searchParams.get('u');
      if (u) {
        try {
          const decoded = atob(u.startsWith('a1') ? u.slice(2) : u);
          return resolveRedirectUrl(decoded, baseUrl, depth + 1) ?? decoded;
        } catch {
          return resolveRedirectUrl(decodeURIComponent(u), baseUrl, depth + 1);
        }
      }
    }

    return absolute;
  } catch {
    return null;
  }
}

function normalizeLinkToRoot(href: string, baseUrl: string): string | null {
  const resolved = resolveRedirectUrl(href, baseUrl);
  if (!resolved || isBlockedDomain(resolved) || !shouldQueueSearchUrl(resolved)) return null;
  try {
    const root = toCasinoRootUrl(resolved);
    if (!isValidCasinoHost(casinoHostKey(root))) return null;
    return root;
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
    const root = normalizeLinkToRoot(href, baseUrl);
    if (root) links.add(root);
  });

  $('a.result__url, span.result__url').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim().split(/\s/)[0]?.replace(/^www\./, '');
    const candidates = [href, text].filter(Boolean) as string[];
    for (const raw of candidates) {
      const guess = raw.startsWith('http') ? raw : `https://${raw.split('/')[0]}`;
      const root = normalizeLinkToRoot(guess, baseUrl);
      if (root) links.add(root);
    }
  });

  $('li.b_algo h2 a, .b_algo cite').each((_, el) => {
    const href = $(el).attr('href') || $(el).text();
    if (!href) return;
    const root = normalizeLinkToRoot(href.startsWith('http') ? href : `https://${href}`, baseUrl);
    if (root) links.add(root);
  });

  const textUrls = html.match(URL_IN_TEXT_REGEX) || [];
  for (const raw of textUrls) {
    const clean = raw.replace(/[),.;]+$/, '');
    const root = normalizeLinkToRoot(clean, baseUrl);
    if (root) links.add(root);
  }

  return [...links];
}

function inferFeatures(text: string): CasinoFeature[] {
  const lower = text.toLowerCase();
  const features: CasinoFeature[] = ['sweepstakes'];
  if (NO_PHONE_KEYWORDS.some((k) => lower.includes(k))) {
    features.push('no_phone');
    if (lower.includes('email only') || lower.includes('email signup') || lower.includes('no phone')) {
      features.push('email_only');
    }
  }
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

async function analyzeUrl(url: string, knownHosts: Set<string>): Promise<{ raw: RawDiscovery | null; rejectReason?: string }> {
  const root = toCasinoRootUrl(url);
  const host = casinoHostKey(root);

  if (knownHosts.has(host)) return { raw: null, rejectReason: 'already known' };
  if (!isValidCasinoHost(host)) return { raw: null, rejectReason: 'invalid hostname' };
  if (isBlockedDomain(root) || !isDiscoveryCandidateUrl(root)) {
    return { raw: null, rejectReason: 'not a casino candidate URL' };
  }

  const html = await fetchPage(root);
  if (!html) return { raw: null, rejectReason: 'fetch failed' };

  const $ = cheerio.load(html);
  const title = $('title').text().trim() || host;
  const bodyText = $('body').text().replace(/\s+/g, ' ').slice(0, 6000);
  const metaDesc = $('meta[name="description"]').attr('content') || '';

  const validation = validateSweepstakesPage(title, metaDesc, bodyText, root);
  if (!validation.valid) {
    return { raw: null, rejectReason: validation.reason ?? 'validation failed' };
  }

  const combined = `${title} ${metaDesc} ${bodyText}`.toLowerCase();
  const features = inferFeatures(combined);
  const name = sanitizeCasinoName(title, root);

  return {
    raw: {
      name,
      url: root,
      description: metaDesc || `Verified sweepstakes casino — ${features.slice(0, 4).join(', ')}`,
      features,
      signupRequirements: features.includes('email_only') ? ['Email', 'Password'] : ['Email'],
      bonusInfo: combined.includes('bonus') ? 'Bonus offers available' : '',
      rating: inferRating(features, { source: 'web_scan' }),
      source: 'web_scan',
    },
  };
}

function ingestDiscovery(raw: RawDiscovery, knownHosts: Set<string>): boolean {
  const root = toCasinoRootUrl(raw.url);
  const host = casinoHostKey(root);
  if (knownHosts.has(host)) return false;
  if (isUrlBlocked(root)) return false;

  const result = addCasino({
    name: raw.name,
    url: root,
    description: raw.description,
    features: raw.features,
    signupRequirements: raw.signupRequirements,
    bonusInfo: raw.bonusInfo,
    rating: raw.rating ?? inferRating(raw.features, { source: raw.source }),
    source: raw.source,
    verified: false,
    reviewStatus: 'pending',
  });
  if (result) knownHosts.add(host);
  return result !== null;
}

async function collectFromSearch(
  query: string,
  knownHosts: Set<string>,
  seenHosts: Set<string>,
  sessionHosts: Set<string>,
  urls: Set<string>,
  searchPages: number,
  onProgress?: DiscoveryProgressCallback,
  errors?: string[],
): Promise<number> {
  let checked = 0;
  throwIfCancelled();

  if (isSerperEnabled()) {
    for (let page = 1; page <= searchPages; page++) {
      throwIfCancelled();
      checked++;
      onProgress?.({ type: 'search_engine', engine: 'serper', query: page > 1 ? `${query} (p${page})` : query });
      const { links: serperLinks, error } = await searchSerper(query, page);
      if (error && errors && !errors.some((e) => e.includes('Serper'))) {
        errors.push(`Serper: ${error}`);
      }
      for (const link of serperLinks) {
        const host = casinoHostKey(link);
        if (!knownHosts.has(host) && !seenHosts.has(host) && !sessionHosts.has(host)) {
          urls.add(link);
        }
      }
      await sleep(120);
    }
    return checked;
  }

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
          const host = casinoHostKey(link);
          if (!knownHosts.has(host) && !seenHosts.has(host) && !sessionHosts.has(host)) {
            urls.add(link);
          }
        }
      }
      await sleep(180);
    }
  }

  return checked;
}

async function crawlKnownCasinosForLinks(
  enqueue: (url: string) => boolean,
  limit = 40,
): Promise<{ crawled: number; linksQueued: number }> {
  const casinos = getAllCasinos(true);
  const shuffled = casinos.sort(() => Math.random() - 0.5).slice(0, limit);
  let crawled = 0;
  let linksQueued = 0;

  for (const casino of shuffled) {
    const root = toCasinoRootUrl(casino.url);
    const html = await fetchPage(root);
    crawled++;
    if (html) {
      for (const link of extractUrlsFromHtml(html, root)) {
        if (enqueue(link)) linksQueued++;
      }
    }
    await sleep(150);
  }

  return { crawled, linksQueued };
}

export async function runDiscovery(deep = false, onProgress?: DiscoveryProgressCallback): Promise<DiscoveryResult> {
  beginDiscoveryRun();
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
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  try {
  const knownHosts = getKnownHosts();
  const seenHosts = getDiscoverySeenHosts();
  const blockedUrls = getBlockedUrls();
  const urlQueue: string[] = [];
  const queuedHosts = new Set<string>();
  const pendingFromSearch = new Set<string>();
  const curatedByHost = new Map(CURATED_DISCOVERIES.map((c) => [casinoHostKey(c.url), c]));
  const sessionHosts = new Set<string>();

  heartbeat = setInterval(() => {
    onProgress?.({ type: 'heartbeat', ts: Date.now() });
  }, 15_000);

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

  const shouldSkipHost = (host: string): boolean =>
    knownHosts.has(host) || seenHosts.has(host) || sessionHosts.has(host);

  const enqueue = (url: string): boolean => {
    let root: string;
    let host: string;
    try {
      root = toCasinoRootUrl(url);
      host = casinoHostKey(root);
    } catch {
      return false;
    }
    if (!isValidCasinoHost(host)) return false;
    if (shouldSkipHost(host) || queuedHosts.has(host)) return false;

    if (blockedUrls.has(host) || isUrlBlocked(root)) {
      blocked++;
      sessionHosts.add(host);
      seenHosts.add(host);
      markDiscoverySeen(root, 'blocked', 'blocklist');
      return false;
    }

    if (!isDiscoveryCandidateUrl(root) || isBlockedDomain(root)) {
      sessionHosts.add(host);
      seenHosts.add(host);
      markDiscoverySeen(root, 'rejected', 'URL pre-filter');
      return false;
    }

    queuedHosts.add(host);
    urlQueue.push(root);
    emitProgress();
    return true;
  };

  const timeLeft = () => config.maxDurationMs - (Date.now() - startTime);
  let queueIndex = 0;

  // Only add missing verified operators (silent — no re-scanning known catalog)
  setPhase('curated', 'Checking for missing verified operators…');
  for (const raw of CURATED_DISCOVERIES) {
    const host = casinoHostKey(raw.url);
    if (knownHosts.has(host)) continue;
    if (ingestDiscovery(raw, knownHosts)) {
      added++;
      found++;
      addedCasinos.push({ name: raw.name, url: toCasinoRootUrl(raw.url) });
      onProgress?.({ type: 'url_added', url: toCasinoRootUrl(raw.url), name: raw.name });
    }
  }
  emitProgress();

  if (config.crawlKnownCasinos) {
    setPhase('crawl', `Mining links from ${deep ? 'all' : 'sample'} known casinos…`);
    const { crawled, linksQueued } = await crawlKnownCasinosForLinks(
      enqueue,
      deep ? 80 : 25,
    );
    sourcesChecked += crawled;
    onProgress?.({
      type: 'crawl_summary',
      crawled,
      linksQueued,
      label: `Crawled ${crawled} known sites → ${linksQueued} new hosts queued`,
    });
  }

  const searchEngineLabel = isSerperEnabled() ? 'Serper (Google)' : 'DuckDuckGo + Bing';
  if (!isSerperEnabled()) {
    errors.push('Serper not configured — using DuckDuckGo/Bing fallback (often returns 0 results on Render). Add SERPER_API_KEY to environment.');
  }
  setPhase('search', `Running ${searchQueries.length} unique searches via ${searchEngineLabel} (${config.searchPages} pages each)…`);
  for (queryIndex = 0; queryIndex < searchQueries.length && timeLeft() > 0; queryIndex++) {
    throwIfCancelled();
    const query = searchQueries[queryIndex];
    onProgress?.({ type: 'search_query', query });
    try {
      sourcesChecked += await collectFromSearch(
        query,
        knownHosts,
        seenHosts,
        sessionHosts,
        pendingFromSearch,
        config.searchPages,
        onProgress,
        errors,
      );
      for (const u of pendingFromSearch) enqueue(u);
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
      const root = toCasinoRootUrl(url);
      const host = casinoHostKey(root);
      sessionHosts.add(host);

      if (knownHosts.has(host)) continue;

      if (blockedUrls.has(host) || isUrlBlocked(root)) {
        blocked++;
        seenHosts.add(host);
        markDiscoverySeen(root, 'blocked', 'blocklist');
        continue;
      }

      const curated = curatedByHost.get(host);
      if (curated) {
        found++;
        if (ingestDiscovery(curated, knownHosts)) {
          added++;
          addedCasinos.push({ name: curated.name, url: root });
          onProgress?.({ type: 'url_added', url: root, name: curated.name });
        }
        continue;
      }

      if (seenHosts.has(host)) continue;

      scanned++;
      webAnalyzes++;
      onProgress?.({ type: 'url_scanning', url: host });
      emitProgress();

      try {
        const { raw: analyzed, rejectReason } = await analyzeUrl(root, knownHosts);
        if (!analyzed) {
          rejected++;
          seenHosts.add(host);
          markDiscoverySeen(root, 'rejected', rejectReason ?? 'validation failed');
          onProgress?.({ type: 'url_rejected', url: host, reason: rejectReason ?? 'not a sweepstakes casino' });
          await sleep(config.delayMs / 3);
          processed++;
          continue;
        }

        found++;
        touchLastCheckedAt(root);
        if (ingestDiscovery(analyzed, knownHosts)) {
          added++;
          seenHosts.add(host);
          markDiscoverySeen(root, 'added', 'verified sweeps');
          addedCasinos.push({ name: analyzed.name, url: analyzed.url });
          onProgress?.({ type: 'url_added', url: analyzed.url, name: analyzed.name });

          if (config.crawlLinks) {
            const pageHtml = await fetchPage(analyzed.url);
            if (pageHtml) {
              for (const link of extractUrlsFromHtml(pageHtml, analyzed.url)) enqueue(link);
            }
          }
        } else {
          skipped++;
          seenHosts.add(host);
          markDiscoverySeen(root, 'skipped', 'duplicate');
        }
      } catch (e) {
        rejected++;
        seenHosts.add(host);
        markDiscoverySeen(root, 'rejected', 'scan error');
        errors.push(`${host}: ${e instanceof Error ? e.message : 'fail'}`);
        onProgress?.({ type: 'url_rejected', url: host, reason: 'scan error' });
      }

      emitProgress();
      processed++;
      await sleep(config.delayMs);
    }

    return processed;
  }

  const durationMs = Date.now() - startTime;
  logDiscovery(found, added, skipped, errors, {
    mode: config.mode,
    rejected,
    blocked,
    durationMs,
  });

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
  void notifyDiscoveryComplete(result);
  return result;
  } catch (err) {
    if (err instanceof Error && err.message === 'Discovery cancelled') {
      errors.push('Cancelled by user');
    } else {
      throw err;
    }
    const durationMs = Date.now() - startTime;
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
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    endDiscoveryRun();
  }
}

export { CURATED_DISCOVERIES, ingestDiscovery, analyzeUrl };
