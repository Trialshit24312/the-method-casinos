import type { DiscoveryProgressEvent, DiscoveryResult, DiscoveryPhase, DiscoveryLiveStats } from '../shared/types.js';
import {
  getKnownHosts,
  getBlockedUrls,
  isUrlBlocked,
  markDiscoverySeen,
  logDiscovery,
  banRejectedDiscovery,
  getAllCasinos,
  touchLastCheckedAt,
  saveDiscoverySession,
  loadDiscoverySession,
  clearDiscoverySession,
  hasDiscoverySession,
} from '../database/index.js';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import {
  shouldQueueSearchUrl,
  isSweepstakesDirectoryUrl,
} from './filters.js';
import { getVerifiedCuratedDiscoveries } from '../shared/verified-casinos.js';
import { buildSearchQueries, SEARCH_PAGES_DEEP, SEARCH_PAGES_QUICK } from './queries.js';
import { collectFreeSearchLinks, extractCasinoUrlsFromHtml, normalizeSearchLink } from './free-search.js';
import { extractOperatorLinksFromListPage, mineOperatorsFromDirectoryPage } from './directory-miner.js';
import { isListSiteDiscoveryEnabled, isWebSearchDiscoveryEnabled } from './list-sources.js';
import { beginDiscoveryRun, canStartDiscoveryRun, endDiscoveryRun, getMaxConcurrentDiscoveries, throwIfCancelled } from './run-state.js';
import { claimListSitesForRun, markListSiteCrawled, releaseListSitesForRun } from './list-site-coordinator.js';
import { beginDiscoveryLive, pushDiscoveryLiveEvent, finishDiscoveryLive } from './live-state.js';
import { resumeDiscoveryLiveStorage } from '../database/index.js';
import {
  ingestDiscovery,
  persistDiscovery,
  analyzeUrl,
  analyzeUrlFromClientHtml,
  CURATED_DISCOVERIES,
  saveDiscoveryCandidateForReview,
  isSoftDiscoveryReject,
} from './engine.js';
import { notifyDiscoveryComplete } from '../shared/notify.js';
import { commitCatalogWriteAndWait } from '../shared/catalog-persist.js';

type ProgressPublisher = (event: DiscoveryProgressEvent) => void;

const CRAWL_BATCH_SIZE = 5;
const QUERIES_PER_STEP_QUICK = 2;
const QUERIES_PER_STEP_DEEP = 3;
const ANALYZE_BATCH_QUICK = 2;
const ANALYZE_BATCH_DEEP = 4;
const BROWSER_VALIDATE_BATCH = 3;

let stepLock: Promise<void> = Promise.resolve();

function publish(onProgress: ProgressPublisher | undefined, event: DiscoveryProgressEvent): void {
  const sink = onProgress ?? pushDiscoveryLiveEvent;
  sink(event);
}

const FETCH_TIMEOUT_MS = 12_000;

interface ScanConfig {
  mode: 'quick' | 'deep';
  maxDurationMs: number;
  delayMs: number;
  maxWebAnalyzes: number;
  searchPages: number;
  crawlLinks: boolean;
  crawlKnownCasinos: boolean;
  crawlLimit: number;
}

const QUICK_CONFIG: ScanConfig = {
  mode: 'quick',
  maxDurationMs: 12 * 60 * 1000,
  delayMs: 120,
  maxWebAnalyzes: 450,
  searchPages: SEARCH_PAGES_QUICK,
  crawlLinks: false,
  crawlKnownCasinos: true,
  crawlLimit: 80,
};

const DEEP_CONFIG: ScanConfig = {
  mode: 'deep',
  maxDurationMs: 40 * 60 * 1000,
  delayMs: 140,
  maxWebAnalyzes: 1500,
  searchPages: SEARCH_PAGES_DEEP,
  crawlLinks: true,
  crawlKnownCasinos: true,
  crawlLimit: 150,
};

export interface DiscoverySessionState {
  mode: 'quick' | 'deep';
  phase: DiscoveryPhase | 'complete';
  startTime: number;
  config: ScanConfig;
  searchQueries: string[];
  queryIndex: number;
  urlQueue: string[];
  queueIndex: number;
  knownHosts: string[];
  sessionHosts: string[];
  queuedHosts: string[];
  blockedUrls: string[];
  webAnalyzes: number;
  sourcesChecked: number;
  scanned: number;
  found: number;
  added: number;
  skipped: number;
  blocked: number;
  rejected: number;
  errors: string[];
  addedCasinos: { name: string; url: string }[];
  crawlCasinoUrls: string[];
  crawlIndex: number;
  curatedIndex: number;
  curatedByHost: Record<string, ReturnType<typeof getVerifiedCuratedDiscoveries>[number]>;
  pendingClientSearch: { queries: string[]; searchPages: number } | null;
  browserValidateUrls: string[];
  browserCrawlUrls: string[];
  listSiteUrls: string[];
  listSiteIndex: number;
  discoveryRunId: string;
}

export interface ClientSearchRequest {
  queries: string[];
  searchPages: number;
}

export interface ClientSerpResult {
  query: string;
  engine: string;
  links: string[];
}

export interface ClientPageHtml {
  url: string;
  html: string;
}

function takeBrowserValidateBatch(state: DiscoverySessionState): string[] {
  if (!state.browserValidateUrls.length) return [];
  return state.browserValidateUrls.splice(0, BROWSER_VALIDATE_BATCH);
}

function maybeReturnBrowserValidate(
  state: DiscoverySessionState,
  onProgress?: ProgressPublisher,
): { done: false; browserValidate: string[] } | null {
  const batch = takeBrowserValidateBatch(state);
  if (!batch.length) return null;
  saveDiscoverySession(state);
  emitProgress(state, onProgress);
  return { done: false, browserValidate: batch };
}

const BROWSER_CRAWL_BATCH = 4;

function takeBrowserCrawlBatch(state: DiscoverySessionState): string[] {
  if (!state.browserCrawlUrls.length) return [];
  return state.browserCrawlUrls.splice(0, BROWSER_CRAWL_BATCH);
}

function maybeReturnBrowserCrawl(
  state: DiscoverySessionState,
  onProgress?: ProgressPublisher,
): { done: false; browserCrawl: string[] } | null {
  const batch = takeBrowserCrawlBatch(state);
  if (!batch.length) return null;
  saveDiscoverySession(state);
  emitProgress(state, onProgress);
  return { done: false, browserCrawl: batch };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121 Safari/537.36',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function emitProgress(state: DiscoverySessionState, onProgress?: ProgressPublisher): void {
  const stats: DiscoveryLiveStats = {
    scanned: state.scanned,
    queued: state.urlQueue.length - state.queueIndex,
    added: state.added,
    rejected: state.rejected,
    skipped: state.skipped,
    blocked: state.blocked,
    sourcesChecked: state.sourcesChecked,
    phase: state.phase === 'complete' ? 'analyze' : state.phase,
    queryIndex: state.queryIndex,
    queryTotal: state.searchQueries.length,
  };
  publish(onProgress, { type: 'progress', stats });
}

function setPhase(state: DiscoverySessionState, phase: DiscoveryPhase, label: string, onProgress?: ProgressPublisher): void {
  state.phase = phase;
  publish(onProgress, { type: 'phase', phase, label });
  emitProgress(state, onProgress);
}

function recordRejection(state: DiscoverySessionState, root: string, host: string, reason: string, onProgress?: ProgressPublisher): void {
  state.rejected++;
  if (!state.sessionHosts.includes(host)) state.sessionHosts.push(host);
  markDiscoverySeen(root, 'rejected', reason);

  if (isSoftDiscoveryReject(reason)) {
    const saved = saveDiscoveryCandidateForReview(root, reason, knownSet(state));
    if (saved) {
      state.added++;
      state.found++;
      state.knownHosts = [...getKnownHosts()];
      state.addedCasinos.push(saved);
      publish(onProgress, {
        type: 'url_added',
        url: saved.url,
        name: saved.name,
        needsReview: true,
        reviewNote: reason,
      });
      return;
    }
  }

  const banned = banRejectedDiscovery(root, reason);
  publish(onProgress, banned
    ? { type: 'url_blocked', url: root }
    : { type: 'url_rejected', url: host, reason });
}

function knownSet(state: DiscoverySessionState): Set<string> {
  return new Set(state.knownHosts);
}

function sessionSet(state: DiscoverySessionState): Set<string> {
  return new Set(state.sessionHosts);
}

function queuedSet(state: DiscoverySessionState): Set<string> {
  return new Set(state.queuedHosts);
}

function blockedSet(state: DiscoverySessionState): Set<string> {
  return new Set(state.blockedUrls);
}

function timeLeft(state: DiscoverySessionState): number {
  return state.config.maxDurationMs - (Date.now() - state.startTime);
}

function enqueue(state: DiscoverySessionState, url: string, onProgress?: (e: DiscoveryProgressEvent) => void): boolean {
  let root: string;
  let host: string;
  try {
    root = toCasinoRootUrl(url);
    host = casinoHostKey(root);
  } catch {
    return false;
  }
  if (!isValidCasinoHost(host)) return false;
  const known = knownSet(state);
  const session = sessionSet(state);
  const queued = queuedSet(state);
  if (known.has(host) || session.has(host) || queued.has(host)) return false;

  const blocked = blockedSet(state);
  if (blocked.has(host) || isUrlBlocked(root)) {
    state.blocked++;
    if (!state.sessionHosts.includes(host)) state.sessionHosts.push(host);
    markDiscoverySeen(root, 'blocked', 'blocklist');
    return false;
  }

  if (!shouldQueueSearchUrl(root)) {
    return false;
  }

  state.queuedHosts.push(host);
  state.urlQueue.push(root);
  emitProgress(state, onProgress);
  return true;
}

function buildInitialState(deep: boolean, discoveryRunId: string): DiscoverySessionState {
  const config = deep ? DEEP_CONFIG : QUICK_CONFIG;
  const curatedByHost: DiscoverySessionState['curatedByHost'] = {};
  for (const c of CURATED_DISCOVERIES) {
    curatedByHost[casinoHostKey(c.url)] = c;
  }

  const crawlPool = getAllCasinos(false)
    .filter((c) => c.reviewStatus !== 'rejected')
    .sort(() => Math.random() - 0.5)
    .slice(0, config.crawlLimit)
    .map((c) => toCasinoRootUrl(c.url));

  return {
    mode: config.mode,
    phase: 'curated',
    startTime: Date.now(),
    config,
    searchQueries: buildSearchQueries(deep),
    queryIndex: 0,
    urlQueue: [],
    queueIndex: 0,
    knownHosts: [...getKnownHosts()],
    sessionHosts: [],
    queuedHosts: [],
    blockedUrls: [...getBlockedUrls()],
    webAnalyzes: 0,
    sourcesChecked: 0,
    scanned: 0,
    found: 0,
    added: 0,
    skipped: 0,
    blocked: 0,
    rejected: 0,
    errors: [],
    addedCasinos: [],
    crawlCasinoUrls: crawlPool,
    crawlIndex: 0,
    curatedIndex: 0,
    curatedByHost,
    pendingClientSearch: null,
    browserValidateUrls: [],
    browserCrawlUrls: [],
    listSiteUrls: isListSiteDiscoveryEnabled() ? claimListSitesForRun(discoveryRunId, deep) : [],
    listSiteIndex: 0,
    discoveryRunId,
  };
}

function buildResult(state: DiscoverySessionState): DiscoveryResult {
  return {
    scanned: state.scanned,
    found: state.found,
    added: state.added,
    skipped: state.skipped,
    blocked: state.blocked,
    rejected: state.rejected,
    durationMs: Date.now() - state.startTime,
    sourcesChecked: state.sourcesChecked,
    errors: state.errors,
    mode: state.mode,
    addedCasinos: state.addedCasinos.slice(0, 50),
  };
}

function finishSession(state: DiscoverySessionState, onProgress?: ProgressPublisher): DiscoveryResult {
  state.phase = 'complete';
  const result = buildResult(state);
  logDiscovery(result.found, result.added, result.skipped, result.errors, {
    mode: result.mode,
    rejected: result.rejected,
    blocked: result.blocked,
    durationMs: result.durationMs,
  });
  publish(onProgress, { type: 'complete', result });
  finishDiscoveryLive(result);
  clearDiscoverySession();
  releaseListSitesForRun(state.discoveryRunId);
  endDiscoveryRun(state.discoveryRunId);
  void commitCatalogWriteAndWait('discovery:client-finish');
  void notifyDiscoveryComplete(result);
  return result;
}

export function startClientDiscovery(deep: boolean): void {
  if (hasDiscoverySession()) {
    throw new Error('Discovery session already active');
  }
  if (!canStartDiscoveryRun()) {
    throw new Error(`Maximum concurrent discovery runs (${getMaxConcurrentDiscoveries()}) reached`);
  }
  const { runId } = beginDiscoveryRun();
  const state = buildInitialState(deep, runId);
  beginDiscoveryLive(deep ? 'deep' : 'quick');
  saveDiscoverySession(state);
  setPhase(state, 'curated', 'Client-driven scan — runs while this tab is open', pushDiscoveryLiveEvent);
  saveDiscoverySession(state);
}

export function resumeClientDiscovery(): void {
  const state = loadDiscoverySession() as DiscoverySessionState | null;
  if (!state || state.phase === 'complete') {
    throw new Error('No discovery session to resume');
  }
  resumeDiscoveryLiveStorage(state.mode);
  if (!state.discoveryRunId) {
    const { runId } = beginDiscoveryRun();
    state.discoveryRunId = runId;
  } else {
    beginDiscoveryRun(state.discoveryRunId);
  }
  setPhase(state, state.phase, 'Resuming scan…', pushDiscoveryLiveEvent);
  saveDiscoverySession(state);
}

async function runClientDiscoveryStepInner(
  onProgress?: ProgressPublisher,
): Promise<{
  done: boolean;
  result?: DiscoveryResult;
  clientSearch?: ClientSearchRequest;
  browserValidate?: string[];
  browserCrawl?: string[];
}> {
  const state = loadDiscoverySession() as DiscoverySessionState | null;
  if (!state) {
    throw new Error('No active discovery session');
  }
  if (state.pendingClientSearch === undefined) {
    state.pendingClientSearch = null;
  }
  if (!state.browserValidateUrls) {
    state.browserValidateUrls = [];
  }
  if (!state.browserCrawlUrls) {
    state.browserCrawlUrls = [];
  }
  if (!state.discoveryRunId) {
    const { runId } = beginDiscoveryRun();
    state.discoveryRunId = runId;
  }
  if (!state.listSiteUrls?.length) {
    state.listSiteUrls = isListSiteDiscoveryEnabled()
      ? claimListSitesForRun(state.discoveryRunId, state.mode === 'deep')
      : [];
    state.listSiteIndex = state.listSiteIndex ?? 0;
  }

  // Keep in sync with DB — casinos added in prior steps must stay known.
  state.knownHosts = [...getKnownHosts()];

  throwIfCancelled(state.discoveryRunId);

  if (timeLeft(state) <= 0) {
    return { done: true, result: finishSession(state, onProgress) };
  }

  const known = knownSet(state);

  if (state.phase === 'curated') {
    if (state.curatedIndex === 0) {
      setPhase(state, 'curated', 'Checking for missing verified operators…', onProgress);
    }
    while (state.curatedIndex < CURATED_DISCOVERIES.length) {
      const raw = CURATED_DISCOVERIES[state.curatedIndex++];
      const host = casinoHostKey(raw.url);
      if (!known.has(host) && ingestDiscovery(raw, known)) {
        state.added++;
        state.found++;
        if (!state.knownHosts.includes(host)) state.knownHosts.push(host);
        state.knownHosts = [...getKnownHosts()];
        state.addedCasinos.push({ name: raw.name, url: toCasinoRootUrl(raw.url) });
        publish(onProgress, { type: 'url_added', url: toCasinoRootUrl(raw.url), name: raw.name });
      }
    }
    if (isListSiteDiscoveryEnabled() && state.listSiteUrls.length) {
      state.phase = 'lists';
      setPhase(state, 'lists', `Crawling ${state.listSiteUrls.length} sweepstakes list sites…`, onProgress);
    } else if (state.config.crawlKnownCasinos && state.crawlCasinoUrls.length) {
      state.phase = 'crawl';
      setPhase(state, 'crawl', `Mining links from ${state.crawlCasinoUrls.length} active casinos…`, onProgress);
    } else if (state.searchQueries.length > 0) {
      state.phase = 'search';
      setPhase(state, 'search', `Browser search — ${state.searchQueries.length} queries…`, onProgress);
    } else {
      state.phase = 'analyze';
      setPhase(state, 'analyze', `Validating ${state.urlQueue.length} candidate URLs…`, onProgress);
    }
    saveDiscoverySession(state);
    emitProgress(state, onProgress);
    return { done: false };
  }

  if (state.phase === 'lists') {
    if (state.listSiteIndex >= state.listSiteUrls.length) {
      if (state.config.crawlKnownCasinos && state.crawlCasinoUrls.length) {
        state.phase = 'crawl';
        state.crawlIndex = 0;
        setPhase(state, 'crawl', `Mining links from ${state.crawlCasinoUrls.length} active casinos…`, onProgress);
      } else if (state.searchQueries.length > 0) {
        state.phase = 'search';
        setPhase(state, 'search', `Browser search — ${state.searchQueries.length} queries…`, onProgress);
      } else {
        state.phase = 'analyze';
        setPhase(state, 'analyze', `Validating ${state.urlQueue.length - state.queueIndex} URLs…`, onProgress);
      }
      saveDiscoverySession(state);
      return { done: false };
    }

    const siteUrl = state.listSiteUrls[state.listSiteIndex++]!;
    state.sourcesChecked++;
    publish(onProgress, { type: 'url_scanning', url: `${new URL(siteUrl).hostname} (list site)` });
    let savedCount = 0;
    let queuedCount = 0;
    const html = await fetchPage(siteUrl);
    if (html) {
      const known = knownSet(state);
      for (const link of extractOperatorLinksFromListPage(html, siteUrl)) {
        const savedPending = saveDiscoveryCandidateForReview(link, 'from sweepstakes list site', known);
        if (savedPending) {
          savedCount++;
          state.added++;
          state.found++;
          state.knownHosts = [...getKnownHosts()];
          known.add(casinoHostKey(savedPending.url));
          state.addedCasinos.push(savedPending);
          publish(onProgress, {
            type: 'url_added',
            url: savedPending.url,
            name: savedPending.name,
            needsReview: true,
            reviewNote: 'Listed on roundup site',
          });
        } else if (enqueue(state, link, onProgress)) {
          queuedCount++;
        }
      }
    } else if (!state.browserCrawlUrls.includes(siteUrl)) {
      state.browserCrawlUrls.push(siteUrl);
    }
    markListSiteCrawled(siteUrl);
    if (savedCount > 0) void commitCatalogWriteAndWait('discovery:client-list-page');
    publish(onProgress, {
      type: 'crawl_summary',
      crawled: state.listSiteIndex,
      linksQueued: savedCount + queuedCount,
      label: `List site ${new URL(siteUrl).hostname} → ${savedCount} saved, ${queuedCount} queued`,
    });
    saveDiscoverySession(state);
    emitProgress(state, onProgress);

    const browserCrawl = maybeReturnBrowserCrawl(state, onProgress);
    if (browserCrawl) return browserCrawl;

    return { done: false };
  }

  if (state.phase === 'crawl') {
    if (state.crawlIndex >= state.crawlCasinoUrls.length) {
      if (state.searchQueries.length > 0) {
        state.phase = 'search';
        setPhase(state, 'search', `Browser search — ${state.searchQueries.length} queries…`, onProgress);
      } else {
        state.phase = 'analyze';
        setPhase(state, 'analyze', `Validating ${state.urlQueue.length - state.queueIndex} URLs…`, onProgress);
      }
      saveDiscoverySession(state);
      return { done: false };
    }

    let batchLinks = 0;
    const batchEnd = Math.min(state.crawlIndex + CRAWL_BATCH_SIZE, state.crawlCasinoUrls.length);
    while (state.crawlIndex < batchEnd) {
      const root = state.crawlCasinoUrls[state.crawlIndex++];
      state.sourcesChecked++;
      const html = await fetchPage(root);
      if (html) {
        for (const link of extractCasinoUrlsFromHtml(html, root, 'page')) {
          if (enqueue(state, link, onProgress)) batchLinks++;
        }
      } else if (!state.browserCrawlUrls.includes(root)) {
        state.browserCrawlUrls.push(root);
      }
      await sleep(80);
    }

    const browserCrawl = maybeReturnBrowserCrawl(state, onProgress);
    if (browserCrawl) return browserCrawl;

    if (batchLinks > 0 || state.crawlIndex % CRAWL_BATCH_SIZE === 0) {
      publish(onProgress, {
        type: 'crawl_summary',
        crawled: state.crawlIndex,
        linksQueued: batchLinks,
        label: `Crawled ${state.crawlIndex}/${state.crawlCasinoUrls.length} → +${batchLinks} queued`,
      });
    }
    saveDiscoverySession(state);
    emitProgress(state, onProgress);
    return { done: false };
  }

  if (state.phase === 'search') {
    if (state.queryIndex >= state.searchQueries.length || timeLeft(state) <= 0) {
      state.phase = 'analyze';
      setPhase(state, 'analyze', `Validating ${state.urlQueue.length - state.queueIndex} candidate URLs…`, onProgress);
      saveDiscoverySession(state);
      return { done: false };
    }

    if (state.pendingClientSearch) {
      return {
        done: false,
        clientSearch: state.pendingClientSearch,
      };
    }

    const queriesPerStep = state.mode === 'deep' ? QUERIES_PER_STEP_DEEP : QUERIES_PER_STEP_QUICK;
    const batch: string[] = [];
    for (let q = 0; q < queriesPerStep && state.queryIndex + batch.length < state.searchQueries.length; q++) {
      batch.push(state.searchQueries[state.queryIndex + batch.length]!);
    }

    state.pendingClientSearch = {
      queries: batch,
      searchPages: state.config.searchPages,
    };
    saveDiscoverySession(state);
    emitProgress(state, onProgress);
    return {
      done: false,
      clientSearch: state.pendingClientSearch,
    };
  }

  if (state.phase === 'analyze') {
    if (
      state.queueIndex >= state.urlQueue.length
      || state.webAnalyzes >= state.config.maxWebAnalyzes
      || timeLeft(state) <= 0
    ) {
      const browserDone = maybeReturnBrowserValidate(state, onProgress);
      if (browserDone) return browserDone;
      return { done: true, result: finishSession(state, onProgress) };
    }
    const analyzeBatch = state.mode === 'deep' ? ANALYZE_BATCH_DEEP : ANALYZE_BATCH_QUICK;
    for (let i = 0; i < analyzeBatch; i++) {
      if (state.queueIndex >= state.urlQueue.length || state.webAnalyzes >= state.config.maxWebAnalyzes) break;
      await processOneUrl(state, onProgress);
    }
    const browserMid = maybeReturnBrowserValidate(state, onProgress);
    if (browserMid) return browserMid;
    saveDiscoverySession(state);
    emitProgress(state, onProgress);
    return { done: false };
  }

  return { done: true, result: finishSession(state, onProgress) };
}

export async function runClientDiscoveryStep(
  onProgress?: ProgressPublisher,
): Promise<{
  done: boolean;
  result?: DiscoveryResult;
  clientSearch?: ClientSearchRequest;
  browserValidate?: string[];
  browserCrawl?: string[];
}> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = stepLock;
  stepLock = prev.then(() => gate);
  await prev;
  try {
    return await runClientDiscoveryStepInner(onProgress);
  } finally {
    release();
  }
}

async function processOneUrl(state: DiscoverySessionState, onProgress?: ProgressPublisher): Promise<void> {
  if (state.queueIndex >= state.urlQueue.length) return;

  const url = state.urlQueue[state.queueIndex++];
  const root = toCasinoRootUrl(url);
  const host = casinoHostKey(root);
  if (!state.sessionHosts.includes(host)) state.sessionHosts.push(host);

  const known = knownSet(state);
  const blocked = blockedSet(state);

  if (known.has(host)) return;

  if (blocked.has(host) || isUrlBlocked(root)) {
    state.blocked++;
    markDiscoverySeen(root, 'blocked', 'blocklist');
    return;
  }

  const curated = state.curatedByHost[host];
  if (curated) {
    state.found++;
    if (ingestDiscovery(curated, known)) {
      state.added++;
      state.knownHosts = [...getKnownHosts()];
      state.addedCasinos.push({ name: curated.name, url: root });
      publish(onProgress, { type: 'url_added', url: root, name: curated.name });
    }
    return;
  }

  if (isSweepstakesDirectoryUrl(root)) {
    state.webAnalyzes++;
    publish(onProgress, { type: 'url_scanning', url: `${host} (list page)` });
    const known = knownSet(state);
    const mined = await mineOperatorsFromDirectoryPage(root, fetchPage, (url) => {
      const savedPending = saveDiscoveryCandidateForReview(url, 'from sweepstakes list site', known);
      if (savedPending) {
        state.added++;
        state.found++;
        state.knownHosts = [...getKnownHosts()];
        known.add(casinoHostKey(savedPending.url));
        state.addedCasinos.push(savedPending);
        publish(onProgress, {
          type: 'url_added',
          url: savedPending.url,
          name: savedPending.name,
          needsReview: true,
          reviewNote: 'Listed on roundup site',
        });
        return 'saved';
      }
      if (enqueue(state, url, onProgress)) return 'queued';
      return 'skipped';
    });
    state.sourcesChecked++;
    if (mined.saved > 0) void commitCatalogWriteAndWait('discovery:client-list-mine');
    publish(onProgress, {
      type: 'crawl_summary',
      crawled: 1,
      linksQueued: mined.saved + mined.queued,
      label: `Mined sweepstakes list ${host} → ${mined.saved} saved, ${mined.queued} queued`,
    });
    return;
  }

  state.scanned++;
  state.webAnalyzes++;
  publish(onProgress, { type: 'url_scanning', url: host });

  try {
    const { raw: analyzed, rejectReason } = await analyzeUrl(root, known);
    if (!analyzed) {
      if (rejectReason === 'fetch failed') {
        if (!state.browserValidateUrls.includes(root)) {
          state.browserValidateUrls.push(root);
        }
        publish(onProgress, { type: 'browser_fetch', url: root });
        await sleep(state.config.delayMs / 4);
        return;
      }
      recordRejection(state, root, host, rejectReason ?? 'validation failed', onProgress);
      await sleep(state.config.delayMs / 3);
      return;
    }

    state.found++;
    touchLastCheckedAt(root);
    const saved = persistDiscovery(analyzed, known);
    if (saved.saved) {
      state.added++;
      state.knownHosts = [...getKnownHosts()];
      markDiscoverySeen(root, 'added', 'verified sweeps');
      state.addedCasinos.push({ name: analyzed.name, url: analyzed.url });
      publish(onProgress, { type: 'url_added', url: analyzed.url, name: analyzed.name });

      if (state.config.crawlLinks) {
        const pageHtml = await fetchPage(analyzed.url);
        if (pageHtml) {
          for (const link of extractCasinoUrlsFromHtml(pageHtml, analyzed.url, 'page')) enqueue(state, link, onProgress);
        }
      }
    } else {
      state.skipped++;
      markDiscoverySeen(root, 'skipped', saved.reason ?? 'duplicate');
      publish(onProgress, {
        type: 'url_skipped',
        url: host,
        reason: saved.reason ?? 'duplicate',
      });
    }
  } catch (e) {
    recordRejection(state, root, host, 'scan error', onProgress);
    state.errors.push(`${host}: ${e instanceof Error ? e.message : 'fail'}`);
  }

  await sleep(state.config.delayMs);
}

export function cancelClientDiscovery(): boolean {
  const state = loadDiscoverySession() as DiscoverySessionState | null;
  if (state?.discoveryRunId) {
    releaseListSitesForRun(state.discoveryRunId);
    endDiscoveryRun(state.discoveryRunId);
  } else {
    endDiscoveryRun();
  }
  clearDiscoverySession();
  return true;
}

const SERP_BASE_URLS: Record<string, string> = {
  duckduckgo_lite: 'https://lite.duckduckgo.com/lite/',
  duckduckgo: 'https://html.duckduckgo.com/html/',
  bing: 'https://www.bing.com/search',
  brave: 'https://search.brave.com/search',
  ddg_instant: 'https://duckduckgo.com/',
  reddit: 'https://www.reddit.com/',
  browser: 'https://search.local/',
};

function ingestRawLinks(
  state: DiscoverySessionState,
  rawLinks: string[],
  baseUrl: string,
  onProgress?: ProgressPublisher,
): number {
  let queued = 0;
  for (const raw of rawLinks) {
    const normalized = normalizeSearchLink(raw, baseUrl);
    if (normalized && enqueue(state, normalized, onProgress)) {
      queued++;
    }
  }
  return queued;
}

async function serverSearchFallback(
  state: DiscoverySessionState,
  query: string,
  onProgress?: ProgressPublisher,
): Promise<number> {
  try {
    const links = await collectFreeSearchLinks(
      query,
      Math.min(state.config.searchPages, 2),
      (engine, eq, linkCount) => {
        state.sourcesChecked++;
        publish(onProgress, { type: 'search_engine', engine, query: eq, linkCount });
      },
      { useSerper: false },
    );
    let queued = 0;
    for (const link of links) {
      if (enqueue(state, link, onProgress)) queued++;
    }
    return queued;
  } catch (e) {
    state.errors.push(`Search fallback: ${e instanceof Error ? e.message : 'unknown'}`);
    return 0;
  }
}

/** Browser submitted SERP links — normalize, queue, analyze batch. */
export async function submitClientSerpResults(
  results: ClientSerpResult[],
  onProgress?: ProgressPublisher,
): Promise<{ queued: number }> {
  const state = loadDiscoverySession() as DiscoverySessionState | null;
  if (!state?.pendingClientSearch) {
    throw new Error('No pending browser search batch');
  }

  const pendingQueries = new Set(state.pendingClientSearch.queries);
  const linksByQuery = new Map<string, number>();

  for (const result of results) {
    if (!pendingQueries.has(result.query)) continue;

    publish(onProgress, { type: 'search_query', query: result.query });
    state.sourcesChecked++;

    const baseUrl = SERP_BASE_URLS[result.engine] ?? SERP_BASE_URLS.browser!;
    const queued = ingestRawLinks(state, result.links, baseUrl, onProgress);
    linksByQuery.set(result.query, (linksByQuery.get(result.query) ?? 0) + queued);

    publish(onProgress, {
      type: 'search_engine',
      engine: result.engine as 'ddg_instant' | 'duckduckgo' | 'duckduckgo_lite' | 'bing' | 'brave' | 'reddit' | 'browser',
      query: result.query,
      linkCount: result.links.length,
    });
  }

  for (const query of state.pendingClientSearch.queries) {
    if ((linksByQuery.get(query) ?? 0) === 0) {
      const fallbackQueued = await serverSearchFallback(state, query, onProgress);
      if (fallbackQueued > 0) {
        linksByQuery.set(query, fallbackQueued);
      }
    }
    state.queryIndex++;
  }

  state.pendingClientSearch = null;

  const analyzeBatch = state.mode === 'deep' ? ANALYZE_BATCH_DEEP : ANALYZE_BATCH_QUICK;
  for (let i = 0; i < analyzeBatch; i++) {
    if (state.queueIndex >= state.urlQueue.length || state.webAnalyzes >= state.config.maxWebAnalyzes) break;
    await processOneUrl(state, onProgress);
  }

  saveDiscoverySession(state);
  emitProgress(state, onProgress);

  const totalQueued = [...linksByQuery.values()].reduce((a, b) => a + b, 0);
  return { queued: totalQueued };
}

/** HTML fetched in the user's browser for URLs the server could not reach. */
export async function submitBrowserValidatedPages(
  pages: ClientPageHtml[],
  onProgress?: ProgressPublisher,
): Promise<{ added: number }> {
  const state = loadDiscoverySession() as DiscoverySessionState | null;
  if (!state) {
    throw new Error('No active discovery session');
  }

  let added = 0;
  const known = knownSet(state);

  for (const page of pages.slice(0, 5)) {
    if (!page.url?.trim() || !page.html?.trim()) continue;
    const root = toCasinoRootUrl(page.url);
    const host = casinoHostKey(root);
    state.scanned++;
    publish(onProgress, { type: 'url_scanning', url: host });

    const { raw, rejectReason } = analyzeUrlFromClientHtml(page.url, page.html, known);
    if (raw) {
      state.found++;
      touchLastCheckedAt(root);
      const saved = persistDiscovery(raw, known);
      if (saved.saved) {
        state.added++;
        added++;
        state.knownHosts = [...getKnownHosts()];
        markDiscoverySeen(root, 'added', 'browser validated');
        state.addedCasinos.push({ name: raw.name, url: raw.url });
        publish(onProgress, { type: 'url_added', url: raw.url, name: raw.name });
      } else {
        state.skipped++;
        publish(onProgress, { type: 'url_skipped', url: host, reason: saved.reason ?? 'duplicate' });
      }
    } else {
      recordRejection(state, root, host, rejectReason ?? 'validation failed', onProgress);
    }
    await sleep(60);
  }

  saveDiscoverySession(state);
  emitProgress(state, onProgress);
  return { added };
}

/** HTML from browser for catalog pages the server could not crawl. */
export function submitBrowserCrawlPages(
  pages: ClientPageHtml[],
  onProgress?: ProgressPublisher,
): { linksQueued: number } {
  const state = loadDiscoverySession() as DiscoverySessionState | null;
  if (!state) {
    throw new Error('No active discovery session');
  }

  let linksQueued = 0;
  for (const page of pages.slice(0, 6)) {
    if (!page.url?.trim() || !page.html?.trim()) continue;
    const root = toCasinoRootUrl(page.url);
    const links = isSweepstakesDirectoryUrl(root)
      ? extractOperatorLinksFromListPage(page.html, root)
      : extractCasinoUrlsFromHtml(page.html, root, 'page');
    for (const link of links) {
      if (enqueue(state, link, onProgress)) linksQueued++;
    }
  }

  if (linksQueued > 0) {
    publish(onProgress, {
      type: 'crawl_summary',
      crawled: state.crawlIndex,
      linksQueued,
      label: `Browser crawl → +${linksQueued} links queued`,
    });
  }

  saveDiscoverySession(state);
  emitProgress(state, onProgress);
  return { linksQueued };
}

/** Manually pasted URLs — works with or without an active scan. */
export function quickAddDiscoveryUrls(urls: string[]): { queued: number } {
  const known = new Set(getKnownHosts());
  let queued = 0;
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const saved = saveDiscoveryCandidateForReview(href, 'manual admin add', known);
    if (saved) {
      queued++;
      known.add(casinoHostKey(saved.url));
    }
  }
  return { queued };
}

/** Manually pasted URLs during an active scan. */
export function ingestManualDiscoveryUrls(
  urls: string[],
  onProgress?: ProgressPublisher,
): { queued: number } {
  const state = loadDiscoverySession() as DiscoverySessionState | null;
  if (!state) {
    throw new Error('No active discovery session');
  }

  let queued = 0;
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    if (ingestRawLinks(state, [href], SERP_BASE_URLS.browser!, onProgress) > 0) {
      queued++;
    }
  }

  saveDiscoverySession(state);
  emitProgress(state, onProgress);
  return { queued };
}
