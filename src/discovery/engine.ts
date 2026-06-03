import * as cheerio from 'cheerio';
import type { CasinoFeature, DiscoveryProgressEvent, DiscoveryResult, DiscoveryPhase, DiscoveryLiveStats } from '../shared/types.js';
import { inferFeaturesFromText } from '../shared/feature-inference.js';
import {
  addCasino,
  getKnownHosts,
  logDiscovery,
  getBlockedUrls,
  isUrlBlocked,
  markDiscoverySeen,
  getAllCasinos,
  touchLastCheckedAt,
  banRejectedDiscovery,
  setCasinoHealth,
} from '../database/index.js';
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
import { mineOperatorsFromDirectoryPage, mineAllListSites, type ListOperatorResult } from './directory-miner.js';
import { persistDatabaseNow } from '../shared/remote-db-sync.js';
import { isSweepstakesDirectoryUrl } from './filters.js';
import { getSweepstakesListSiteUrls, isListSiteDiscoveryEnabled, isWebSearchDiscoveryEnabled } from './list-sources.js';
import { claimListSitesForRun, markListSiteCrawled, releaseListSitesForRun } from './list-site-coordinator.js';
import {
  beginDiscoveryRun,
  endDiscoveryRun,
  getMaxConcurrentDiscoveries,
  throwIfCancelled,
  tryBeginDiscoveryRun,
} from './run-state.js';
import { notifyDiscoveryComplete, notifyPendingDiscovery } from '../shared/notify.js';

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

const FETCH_TIMEOUT_MS = 18_000;

const URL_IN_TEXT_REGEX = /https?:\/\/(?:www\.)?[a-z0-9][-a-z0-9]{0,62}\.[a-z]{2,24}(?:\/[^\s"'<>]*)?/gi;

const CURATED_DISCOVERIES: RawDiscovery[] = getVerifiedCuratedDiscoveries();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string, retries = 2): Promise<string | null> {
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

function analyzeHtmlContent(
  root: string,
  host: string,
  html: string,
): { raw: RawDiscovery | null; rejectReason?: string } {
  const $ = cheerio.load(html);
  const title = $('title').text().trim() || host;
  const bodyText = $('body').text().replace(/\s+/g, ' ').slice(0, 8000);
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

  return analyzeHtmlContent(root, host, html);
}

/** Validate using HTML fetched in the user's browser (avoids server/datacenter blocks). */
export function analyzeUrlFromClientHtml(
  url: string,
  html: string,
  knownHosts: Set<string>,
): { raw: RawDiscovery | null; rejectReason?: string } {
  const root = toCasinoRootUrl(url);
  const host = casinoHostKey(root);

  if (knownHosts.has(host)) return { raw: null, rejectReason: 'already known' };
  if (!isValidCasinoHost(host)) return { raw: null, rejectReason: 'invalid hostname' };
  if (isBlockedDomain(root) || !isDiscoveryCandidateUrl(root)) {
    return { raw: null, rejectReason: 'not a casino candidate URL' };
  }

  const trimmed = html?.trim();
  if (!trimmed || trimmed.length < 200) {
    return { raw: null, rejectReason: 'fetch failed' };
  }

  return analyzeHtmlContent(root, host, trimmed.slice(0, 500_000));
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
  if (result) {
    knownHosts.add(host);
    return true;
  }
  return false;
}

export function persistDiscovery(raw: RawDiscovery, knownHosts: Set<string>): { saved: boolean; reason?: string } {
  const root = toCasinoRootUrl(raw.url);
  const host = casinoHostKey(root);
  if (knownHosts.has(host)) return { saved: false, reason: 'already known' };
  if (isUrlBlocked(root)) return { saved: false, reason: 'blocked' };
  if (ingestDiscovery(raw, knownHosts)) return { saved: true };
  return { saved: false, reason: 'duplicate or insert failed' };
}

const HARD_REJECT_REASONS = [
  'adult content',
  'news/media site',
  'generic non-casino site',
  'blocked domain',
  'not a casino candidate URL',
  'invalid hostname',
  'already known',
];

/** Save operator-shaped URL as pending when auto-validation could not confirm (shows in Review Queue). */
export function saveDiscoveryCandidateForReview(
  url: string,
  reason: string,
  knownHosts: Set<string>,
): { name: string; url: string } | null {
  const root = toCasinoRootUrl(url);
  const host = casinoHostKey(root);
  if (knownHosts.has(host) || !isValidCasinoHost(host)) return null;
  if (isUrlBlocked(root) || !isDiscoveryCandidateUrl(root)) return null;

  const brand = host.split('.')[0] ?? host;
  const name = brand.charAt(0).toUpperCase() + brand.slice(1);

  const casino = addCasino({
    name,
    url: root,
    description: `Auto-discovered — needs your review (${reason}). Confirm sweepstakes operator before approving.`,
    features: [],
    signupRequirements: ['Email'],
    bonusInfo: '',
    source: 'web_scan',
    verified: false,
    reviewStatus: 'pending',
  });

  if (!casino) return null;

  setCasinoHealth(casino.id, 'stale', `Discovery scan: ${reason}`);
  knownHosts.add(host);
  markDiscoverySeen(root, 'added', `pending review: ${reason}`);
  void notifyPendingDiscovery({ name: casino.name, url: root, reason });
  return { name: casino.name, url: root };
}

export function isSoftDiscoveryReject(reason: string): boolean {
  const lower = reason.toLowerCase();
  if (HARD_REJECT_REASONS.some((h) => lower.includes(h))) return false;
  return (
    lower.includes('insufficient sweepstakes')
    || lower.includes('fetch failed')
    || lower.includes('validation failed')
    || lower.includes('scan error')
  );
}

async function collectFromSearch(
  query: string,
  knownHosts: Set<string>,
  sessionHosts: Set<string>,
  urls: Set<string>,
  searchPages: number,
  onProgress: DiscoveryProgressCallback | undefined,
  runId: string | undefined,
): Promise<number> {
  let checked = 0;
  throwIfCancelled(runId);

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
      for (const link of extractCasinoUrlsFromHtml(html, root, 'page')) {
        if (enqueue(link)) linksQueued++;
      }
    }
    await sleep(150);
  }

  return { crawled, linksQueued };
}

export interface DiscoveryRunOptions {
  runId?: string;
  /** When false, caller manages run registration (e.g. pre-registered worker id). */
  registerRun?: boolean;
}

export async function runDiscovery(
  deep = false,
  onProgress?: DiscoveryProgressCallback,
  options?: DiscoveryRunOptions,
): Promise<DiscoveryResult> {
  const registerRun = options?.registerRun !== false;
  let runId = options?.runId;
  if (registerRun) {
    const started = runId ? beginDiscoveryRun(runId) : tryBeginDiscoveryRun();
    if (!started) {
      throw new Error(`Maximum concurrent discovery runs (${getMaxConcurrentDiscoveries()}) reached`);
    }
    runId = started.runId;
  }
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

    if (isSoftDiscoveryReject(rejectReason)) {
      const saved = saveDiscoveryCandidateForReview(root, rejectReason, knownHosts);
      if (saved) {
        added++;
        found++;
        addedCasinos.push(saved);
        onProgress?.({
          type: 'url_added',
          url: saved.url,
          name: saved.name,
          needsReview: true,
          reviewNote: rejectReason,
        });
        return;
      }
    }

    const banned = banRejectedDiscovery(root, rejectReason);
    onProgress?.(banned
      ? { type: 'url_blocked', url: root }
      : { type: 'url_rejected', url: host, reason: rejectReason });
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

  const handleListOperator = (url: string): ListOperatorResult => {
    const savedPending = saveDiscoveryCandidateForReview(url, 'from sweepstakes list site', knownHosts);
    if (savedPending) {
      added++;
      found++;
      addedCasinos.push(savedPending);
      onProgress?.({
        type: 'url_added',
        url: savedPending.url,
        name: savedPending.name,
        needsReview: true,
        reviewNote: 'Listed on roundup site',
      });
      return 'saved';
    }
    if (enqueue(url)) return 'queued';
    return 'skipped';
  };

  if (isListSiteDiscoveryEnabled()) {
    const listUrls = runId ? claimListSitesForRun(runId, deep) : getSweepstakesListSiteUrls(deep);
    setPhase('lists', `Crawling ${listUrls.length} list sites (rotating, non-overlapping)…`);
    const { sitesCrawled, saved: listSaved, queued: listQueued } = await mineAllListSites(
      listUrls,
      fetchPage,
      handleListOperator,
      (siteUrl, saved, queued) => {
        markListSiteCrawled(siteUrl);
        onProgress?.({
          type: 'crawl_summary',
          crawled: 1,
          linksQueued: saved + queued,
          label: `List site ${new URL(siteUrl).hostname} → ${saved} saved, ${queued} queued`,
        });
      },
    );
    sourcesChecked += sitesCrawled;
    await persistDatabaseNow();
    onProgress?.({
      type: 'crawl_summary',
      crawled: sitesCrawled,
      linksQueued: listSaved + listQueued,
      label: `List sites done: ${listSaved} saved to Review Queue, ${listQueued} queued for scan`,
    });
    emitProgress();

    while (queueIndex < urlQueue.length && timeLeft() > 0 && webAnalyzes < config.maxWebAnalyzes) {
      const processed = await processQueueBatch(3);
      if (processed === 0) break;
    }
  }

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

  if (isWebSearchDiscoveryEnabled() && searchQueries.length > 0) {
  setPhase('search', `Web search — ${searchQueries.length} queries (DDG, Bing, Brave)…`);
  for (queryIndex = 0; queryIndex < searchQueries.length && timeLeft() > 0; queryIndex++) {
    throwIfCancelled(runId);
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
        runId,
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
  } else if (!isListSiteDiscoveryEnabled()) {
    setPhase('search', 'No list sites or web search configured — enable list sites (default) or DISCOVERY_WEB_SEARCH=1');
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

      if (isSweepstakesDirectoryUrl(root)) {
        webAnalyzes++;
        onProgress?.({ type: 'url_scanning', url: `${host} (list page)` });
        const mined = await mineOperatorsFromDirectoryPage(root, fetchPage, handleListOperator);
        sourcesChecked++;
        onProgress?.({
          type: 'crawl_summary',
          crawled: 1,
          linksQueued: mined.saved + mined.queued,
          label: `Mined list ${host} → ${mined.saved} saved, ${mined.queued} queued`,
        });
        processed++;
        await sleep(config.delayMs / 2);
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
  await persistDatabaseNow();
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
    if (runId) releaseListSitesForRun(runId);
    if (registerRun && runId) endDiscoveryRun(runId);
  }
}

export { CURATED_DISCOVERIES, ingestDiscovery, analyzeUrl };
