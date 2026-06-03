import type { DiscoveryProgressEvent, DiscoveryResult, DiscoveryPhase, DiscoveryLiveStats } from '../shared/types.js';
import {
  getKnownHosts,
  getBlockedUrls,
  isUrlBlocked,
  markDiscoverySeen,
  logDiscovery,
  queueDiscoveryBanReview,
  getAllCasinos,
  touchLastCheckedAt,
  saveDiscoverySession,
  loadDiscoverySession,
  clearDiscoverySession,
  hasDiscoverySession,
} from '../database/index.js';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import {
  isDiscoveryCandidateUrl,
  isBlockedDomain,
} from './filters.js';
import { getVerifiedCuratedDiscoveries } from '../shared/verified-casinos.js';
import { buildSearchQueries, SEARCH_PAGES_DEEP, SEARCH_PAGES_QUICK } from './queries.js';
import { collectFreeSearchLinks, extractCasinoUrlsFromHtml } from './free-search.js';
import { beginDiscoveryRun, endDiscoveryRun, throwIfCancelled } from './run-state.js';
import { beginDiscoveryLive, pushDiscoveryLiveEvent, finishDiscoveryLive } from './live-state.js';
import { ingestDiscovery, analyzeUrl, CURATED_DISCOVERIES } from './engine.js';

type ProgressPublisher = (event: DiscoveryProgressEvent) => void;

const CRAWL_BATCH_SIZE = 5;

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
  maxDurationMs: 8 * 60 * 1000,
  delayMs: 200,
  maxWebAnalyzes: 200,
  searchPages: SEARCH_PAGES_QUICK,
  crawlLinks: false,
  crawlKnownCasinos: true,
  crawlLimit: 40,
};

const DEEP_CONFIG: ScanConfig = {
  mode: 'deep',
  maxDurationMs: 30 * 60 * 1000,
  delayMs: 250,
  maxWebAnalyzes: 800,
  searchPages: SEARCH_PAGES_DEEP,
  crawlLinks: true,
  crawlKnownCasinos: true,
  crawlLimit: 100,
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
  queueDiscoveryBanReview(root, reason);
  publish(onProgress, { type: 'url_rejected', url: host, reason });
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

  if (!isDiscoveryCandidateUrl(root) || isBlockedDomain(root)) {
    recordRejection(state, root, host, 'URL pre-filter', onProgress);
    return false;
  }

  state.queuedHosts.push(host);
  state.urlQueue.push(root);
  emitProgress(state, onProgress);
  return true;
}

function buildInitialState(deep: boolean): DiscoverySessionState {
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
  endDiscoveryRun();
  return result;
}

export function startClientDiscovery(deep: boolean): void {
  if (hasDiscoverySession()) {
    throw new Error('Discovery session already active');
  }
  const state = buildInitialState(deep);
  beginDiscoveryLive(deep ? 'deep' : 'quick');
  beginDiscoveryRun();
  saveDiscoverySession(state);
  setPhase(state, 'curated', 'Client-driven scan — runs while this tab is open', pushDiscoveryLiveEvent);
  saveDiscoverySession(state);
}

async function runClientDiscoveryStepInner(
  onProgress?: ProgressPublisher,
): Promise<{ done: boolean; result?: DiscoveryResult }> {
  const state = loadDiscoverySession() as DiscoverySessionState | null;
  if (!state) {
    throw new Error('No active discovery session');
  }

  // Keep in sync with DB — casinos added in prior steps must stay known.
  state.knownHosts = [...getKnownHosts()];

  throwIfCancelled();

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
        state.addedCasinos.push({ name: raw.name, url: toCasinoRootUrl(raw.url) });
        publish(onProgress, { type: 'url_added', url: toCasinoRootUrl(raw.url), name: raw.name });
      }
    }
    if (state.config.crawlKnownCasinos && state.crawlCasinoUrls.length) {
      state.phase = 'crawl';
      setPhase(state, 'crawl', `Mining links from ${state.crawlCasinoUrls.length} active casinos…`, onProgress);
    } else {
      state.phase = 'search';
      setPhase(state, 'search', `Running ${state.searchQueries.length} fresh web searches…`, onProgress);
    }
    saveDiscoverySession(state);
    emitProgress(state, onProgress);
    return { done: false };
  }

  if (state.phase === 'crawl') {
    if (state.crawlIndex >= state.crawlCasinoUrls.length) {
      state.phase = 'search';
      setPhase(state, 'search', `Running ${state.searchQueries.length} fresh web searches…`, onProgress);
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
        for (const link of extractCasinoUrlsFromHtml(html, root)) {
          if (enqueue(state, link, onProgress)) batchLinks++;
        }
      }
      await sleep(80);
    }

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
      setPhase(state, 'analyze', 'Validating remaining candidate URLs…', onProgress);
      saveDiscoverySession(state);
      return { done: false };
    }

    const query = state.searchQueries[state.queryIndex];
    publish(onProgress, { type: 'search_query', query });

    try {
      const links = await collectFreeSearchLinks(
        query,
        state.config.searchPages,
        (engine, q, linkCount) => {
          state.sourcesChecked++;
          publish(onProgress, { type: 'search_engine', engine, query: q, linkCount });
        },
      );
      for (const link of links) {
        enqueue(state, link, onProgress);
      }
    } catch (e) {
      state.errors.push(`Search: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    state.queryIndex++;
    await sleep(state.config.delayMs);

    if (state.queueIndex < state.urlQueue.length && state.webAnalyzes < state.config.maxWebAnalyzes) {
      await processOneUrl(state, onProgress);
    }

    saveDiscoverySession(state);
    emitProgress(state, onProgress);
    return { done: false };
  }

  if (state.phase === 'analyze') {
    if (
      state.queueIndex >= state.urlQueue.length
      || state.webAnalyzes >= state.config.maxWebAnalyzes
      || timeLeft(state) <= 0
    ) {
      return { done: true, result: finishSession(state, onProgress) };
    }
    await processOneUrl(state, onProgress);
    saveDiscoverySession(state);
    emitProgress(state, onProgress);
    return { done: false };
  }

  return { done: true, result: finishSession(state, onProgress) };
}

export async function runClientDiscoveryStep(
  onProgress?: ProgressPublisher,
): Promise<{ done: boolean; result?: DiscoveryResult }> {
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
      if (!state.knownHosts.includes(host)) state.knownHosts.push(host);
      state.addedCasinos.push({ name: curated.name, url: root });
      publish(onProgress, { type: 'url_added', url: root, name: curated.name });
    }
    return;
  }

  state.scanned++;
  state.webAnalyzes++;
  publish(onProgress, { type: 'url_scanning', url: host });

  try {
    const { raw: analyzed, rejectReason } = await analyzeUrl(root, known);
    if (!analyzed) {
      recordRejection(state, root, host, rejectReason ?? 'validation failed', onProgress);
      await sleep(state.config.delayMs / 3);
      return;
    }

    state.found++;
    touchLastCheckedAt(root);
    if (ingestDiscovery(analyzed, known)) {
      state.added++;
      if (!state.knownHosts.includes(host)) state.knownHosts.push(host);
      markDiscoverySeen(root, 'added', 'verified sweeps');
      state.addedCasinos.push({ name: analyzed.name, url: analyzed.url });
      publish(onProgress, { type: 'url_added', url: analyzed.url, name: analyzed.name });

      if (state.config.crawlLinks) {
        const pageHtml = await fetchPage(analyzed.url);
        if (pageHtml) {
          for (const link of extractCasinoUrlsFromHtml(pageHtml, analyzed.url)) enqueue(state, link, onProgress);
        }
      }
    } else {
      state.skipped++;
      markDiscoverySeen(root, 'skipped', 'duplicate');
    }
  } catch (e) {
    recordRejection(state, root, host, 'scan error', onProgress);
    state.errors.push(`${host}: ${e instanceof Error ? e.message : 'fail'}`);
  }

  await sleep(state.config.delayMs);
}

export function cancelClientDiscovery(): boolean {
  clearDiscoverySession();
  endDiscoveryRun();
  return true;
}
