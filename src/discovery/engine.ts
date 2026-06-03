import * as cheerio from 'cheerio';
import type { CasinoFeature, DiscoveryProgressEvent, DiscoveryResult, DiscoveryPhase, DiscoveryLiveStats } from '../shared/types.js';
import { inferFeaturesFromText } from '../shared/feature-inference.js';
import { addCasino, getKnownHosts, logDiscovery, getBlockedUrls, isUrlBlocked, markDiscoverySeen, getAllCasinos, touchLastCheckedAt, queueDiscoveryBanReview } from '../database/index.js';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import { inferRating } from '../shared/rating.js';
import {
  isDiscoveryCandidateUrl,
  isBlockedDomain,
  validateSweepstakesPage,
  sanitizeCasinoName,
} from './filters.js';
import { getVerifiedCuratedDiscoveries } from '../shared/verified-casinos.js';
import { buildSearchQueries, SEARCH_PAGES_DEEP, SEARCH_PAGES_QUICK } from './queries.js';
import { collectFreeSearchLinks, extractCasinoUrlsFromHtml } from './free-search.js';
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

const URL_IN_TEXT_REGEX = /https?:\/\/(?:www\.)?[a-z0-9][-a-z0-9]{0,62}\.[a-z]{2,24}(?:\/[^\s"'<>]*)?/gi;

const CURATED_DISCOVERIES: RawDiscovery[] = getVerifiedCuratedDiscoveries();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const features = inferFeaturesFromText(combined);
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
  sessionHosts: Set<string>,
  urls: Set<string>,
  searchPages: number,
  onProgress?: DiscoveryProgressCallback,
): Promise<number> {
  let checked = 0;
  throwIfCancelled();

  const links = await collectFreeSearchLinks(query, searchPages, (engine, q, linkCount) => {
    checked++;
    onProgress?.({ type: 'search_engine', engine, query: q, linkCount });
  });

  for (const link of links) {
    const host = casinoHostKey(link);
    if (!knownHosts.has(host) && !sessionHosts.has(host)) {
      urls.add(link);
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
      for (const link of extractCasinoUrlsFromHtml(html, root)) {
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
    knownHosts.has(host) || sessionHosts.has(host);

  const recordRejection = (root: string, host: string, rejectReason: string) => {
    rejected++;
    sessionHosts.add(host);
    markDiscoverySeen(root, 'rejected', rejectReason);
    queueDiscoveryBanReview(root, rejectReason);
    onProgress?.({ type: 'url_rejected', url: host, reason: rejectReason });
  };

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
      markDiscoverySeen(root, 'blocked', 'blocklist');
      return false;
    }

    if (!isDiscoveryCandidateUrl(root) || isBlockedDomain(root)) {
      recordRejection(root, host, 'URL pre-filter');
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
      deep ? 100 : 40,
    );
    sourcesChecked += crawled;
    onProgress?.({
      type: 'crawl_summary',
      crawled,
      linksQueued,
      label: `Crawled ${crawled} known sites → ${linksQueued} new hosts queued`,
    });
  }

  setPhase('search', `Running ${searchQueries.length} searches via free web search (DDG Lite, DDG, Bing, Brave — ${config.searchPages} pages each)…`);
  for (queryIndex = 0; queryIndex < searchQueries.length && timeLeft() > 0; queryIndex++) {
    throwIfCancelled();
    const query = searchQueries[queryIndex];
    onProgress?.({ type: 'search_query', query });
    try {
      sourcesChecked += await collectFromSearch(
        query,
        knownHosts,
        sessionHosts,
        pendingFromSearch,
        config.searchPages,
        onProgress,
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

      scanned++;
      webAnalyzes++;
      onProgress?.({ type: 'url_scanning', url: host });
      emitProgress();

      try {
        const { raw: analyzed, rejectReason } = await analyzeUrl(root, knownHosts);
        if (!analyzed) {
          recordRejection(root, host, rejectReason ?? 'validation failed');
          await sleep(config.delayMs / 3);
          processed++;
          continue;
        }

        found++;
        touchLastCheckedAt(root);
        if (ingestDiscovery(analyzed, knownHosts)) {
          added++;
          markDiscoverySeen(root, 'added', 'verified sweeps');
          addedCasinos.push({ name: analyzed.name, url: analyzed.url });
          onProgress?.({ type: 'url_added', url: analyzed.url, name: analyzed.name });

          if (config.crawlLinks) {
            const pageHtml = await fetchPage(analyzed.url);
            if (pageHtml) {
              for (const link of extractCasinoUrlsFromHtml(pageHtml, analyzed.url)) enqueue(link);
            }
          }
        } else {
          skipped++;
          markDiscoverySeen(root, 'skipped', 'duplicate');
        }
      } catch (e) {
        recordRejection(root, host, 'scan error');
        errors.push(`${host}: ${e instanceof Error ? e.message : 'fail'}`);
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
