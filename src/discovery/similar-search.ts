import * as cheerio from 'cheerio';
import {
  getCasinoById,
  getKnownHosts,
  isUrlBlocked,
  getBlockedUrls,
  addCasino,
  markDiscoverySeen,
  getAllCasinos,
  banRejectedDiscovery,
} from '../database/index.js';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import { rankSimilarCasinos, type SimilarCasinoMatch } from '../shared/similarity.js';
import type { Casino } from '../shared/types.js';
import { buildSimilarWebQueries, normalizeSearchLink, collectFreeSearchLinks } from './free-search.js';
import { isBlockedDomain, isDiscoveryCandidateUrl, validateSweepstakesPage, sanitizeCasinoName } from './filters.js';
import { inferRating } from '../shared/rating.js';
import {
  analyzeUrlFromClientHtml,
  saveDiscoveryCandidateForReview,
  isSoftDiscoveryReject,
} from './engine.js';

const ANALYZE_TIMEOUT_MS = 18_000;

const HOST_SCORE_HINTS = ['sweep', 'sweeps', 'casino', 'slots', 'coin', 'spin', 'vegas', 'luck', 'play', 'win'];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function scoreUrlForSource(url: string, source: Casino): number {
  const host = casinoHostKey(url);
  const label = host.split('.')[0];
  let score = 0;
  for (const hint of HOST_SCORE_HINTS) {
    if (label.includes(hint)) score += 2;
  }
  const sourceLabel = casinoHostKey(source.url).split('.')[0];
  if (label.length >= 5 && label !== sourceLabel) score += 1;
  for (const feature of source.features) {
    if (feature === 'slots' && label.includes('slot')) score += 1;
    if (feature === 'no_phone' && (label.includes('mail') || label.includes('email'))) score += 1;
  }
  return score;
}

async function fetchHomepage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121 Safari/537.36',
        Accept: 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parsePageSignals(html: string, root: string, fallbackHost: string): {
  title: string;
  metaDesc: string;
  bodyText: string;
} {
  const $ = cheerio.load(html);
  return {
    title: $('title').text().trim() || fallbackHost,
    metaDesc: $('meta[name="description"]').attr('content') || '',
    bodyText: $('body').text().replace(/\s+/g, ' ').slice(0, 8000),
  };
}

export interface SimilarWebDiscoveryResult {
  source: Casino;
  catalogMatches: SimilarCasinoMatch[];
  webUrlsFound: number;
  analyzed: number;
  added: number;
  rejected: number;
  candidates: { name: string; url: string; status: 'added' | 'rejected' | 'skipped'; reason?: string }[];
  queries: string[];
  searchMode: 'browser' | 'server' | 'mixed';
}

export interface SimilarBrowserSearchHit {
  query: string;
  links: string[];
}

export function getSimilarWebQueries(casinoId: string, maxQueries = 6): { source: Casino; queries: string[] } | null {
  const source = getCasinoById(casinoId);
  if (!source) return null;
  const host = casinoHostKey(source.url);
  return {
    source,
    queries: buildSimilarWebQueries(source.name, host).slice(0, maxQueries),
  };
}

async function collectUrlScores(
  source: Casino,
  queries: string[],
  searchPages: number,
  browserResults?: SimilarBrowserSearchHit[],
): Promise<{ urlScores: Map<string, number>; searchMode: SimilarWebDiscoveryResult['searchMode'] }> {
  const knownHosts = getKnownHosts();
  const blockedUrls = getBlockedUrls();
  const host = casinoHostKey(source.url);
  const urlScores = new Map<string, number>();

  const ingestLink = (link: string, baseUrl: string) => {
    const normalized = normalizeSearchLink(link, baseUrl) ?? (link.startsWith('http') ? toCasinoRootUrl(link) : null);
    if (!normalized) return;
    const h = casinoHostKey(normalized);
    if (h === host || knownHosts.has(h)) return;
    if (blockedUrls.has(h) || isUrlBlocked(normalized)) return;
    if (!isDiscoveryCandidateUrl(normalized) || isBlockedDomain(normalized)) return;
    const score = scoreUrlForSource(normalized, source);
    urlScores.set(normalized, Math.max(urlScores.get(normalized) ?? 0, score));
  };

  let searchMode: SimilarWebDiscoveryResult['searchMode'] = 'server';

  if (browserResults?.length) {
    searchMode = 'browser';
    for (const hit of browserResults) {
      for (const link of hit.links) {
        ingestLink(link, 'https://html.duckduckgo.com/html/');
      }
    }
  }

  if (urlScores.size < 8) {
    for (const query of queries) {
      const links = await collectFreeSearchLinks(
        query,
        searchPages,
        undefined,
        { maxLinks: 40, useSerper: false },
      );
      for (const link of links) ingestLink(link, 'https://html.duckduckgo.com/html/');
      await sleep(180);
    }
    if (browserResults?.length && urlScores.size > 0) searchMode = 'mixed';
  }

  return { urlScores, searchMode };
}

async function analyzeSimilarUrl(
  url: string,
  source: Casino,
  knownHosts: Set<string>,
  clientHtml?: string,
): Promise<{ name: string; url: string; status: 'added' | 'rejected' | 'skipped'; reason?: string }> {
  const root = toCasinoRootUrl(url);
  const h = casinoHostKey(root);
  if (!isValidCasinoHost(h) || knownHosts.has(h)) {
    return { name: h, url: root, status: 'skipped', reason: 'already known' };
  }

  let rawResult: ReturnType<typeof analyzeUrlFromClientHtml> | null = null;
  if (clientHtml) {
    rawResult = analyzeUrlFromClientHtml(root, clientHtml, knownHosts);
  } else {
    const html = await fetchHomepage(root);
    if (!html) {
      const saved = saveDiscoveryCandidateForReview(root, 'fetch failed', knownHosts);
      if (saved) {
        knownHosts.add(h);
        return { name: saved.name, url: root, status: 'added', reason: 'saved for review (fetch failed)' };
      }
      markDiscoverySeen(root, 'rejected', 'fetch failed');
      if (!isSoftDiscoveryReject('fetch failed')) {
        banRejectedDiscovery(root, 'fetch failed');
      }
      return { name: h, url: root, status: 'rejected', reason: 'fetch failed' };
    }
    rawResult = analyzeUrlFromClientHtml(root, html, knownHosts);
  }

  if (!rawResult?.raw) {
    const reason = rawResult?.rejectReason ?? 'validation failed';
    const saved = isSoftDiscoveryReject(reason)
      ? saveDiscoveryCandidateForReview(root, reason, knownHosts)
      : null;
    if (saved) {
      knownHosts.add(h);
      return { name: saved.name, url: root, status: 'added', reason: `saved for review (${reason})` };
    }
    markDiscoverySeen(root, 'rejected', reason);
    if (!isSoftDiscoveryReject(reason)) {
      banRejectedDiscovery(root, reason);
    }
    const { title, metaDesc, bodyText } = clientHtml
      ? parsePageSignals(clientHtml, root, h)
      : { title: h, metaDesc: '', bodyText: '' };
    return {
      name: sanitizeCasinoName(title, root),
      url: root,
      status: 'rejected',
      reason,
    };
  }

  const { raw } = rawResult;
  const casino = addCasino({
    name: raw.name,
    url: raw.url,
    description: raw.description || `Found via web search similar to ${source.name}`,
    features: raw.features,
    signupRequirements: raw.signupRequirements,
    bonusInfo: raw.bonusInfo,
    source: 'similar_web',
    verified: false,
    reviewStatus: 'pending',
    rating: raw.rating ?? inferRating(raw.features, { source: 'similar_web' }),
  });

  if (casino) {
    knownHosts.add(h);
    markDiscoverySeen(root, 'added', `similar to ${source.name}`);
    return { name: casino.name, url: root, status: 'added' };
  }
  return { name: raw.name, url: root, status: 'skipped', reason: 'duplicate or blocked' };
}

export async function discoverSimilarOnWeb(
  casinoId: string,
  options: {
    maxQueries?: number;
    maxAnalyze?: number;
    searchPages?: number;
    browserResults?: SimilarBrowserSearchHit[];
  } = {},
): Promise<SimilarWebDiscoveryResult | null> {
  const source = getCasinoById(casinoId);
  if (!source) return null;

  const maxQueries = options.maxQueries ?? 6;
  const maxAnalyze = options.maxAnalyze ?? 15;
  const searchPages = options.searchPages ?? 2;

  const catalog = getAllCasinos(true);
  const catalogMatches = rankSimilarCasinos(source, catalog.filter((c) => c.id !== source.id), 12);

  const queries = buildSimilarWebQueries(source.name, casinoHostKey(source.url)).slice(0, maxQueries);
  const { urlScores, searchMode } = await collectUrlScores(
    source,
    queries,
    searchPages,
    options.browserResults,
  );

  const sortedUrls = [...urlScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url);

  const knownHosts = new Set(getKnownHosts());
  const candidates: SimilarWebDiscoveryResult['candidates'] = [];
  let analyzed = 0;
  let added = 0;
  let rejected = 0;

  for (const url of sortedUrls) {
    if (analyzed >= maxAnalyze) break;
    analyzed++;

    const result = await analyzeSimilarUrl(url, source, knownHosts);
    candidates.push(result);
    if (result.status === 'added') added++;
    if (result.status === 'rejected') rejected++;

    await sleep(200);
  }

  return {
    source,
    catalogMatches,
    webUrlsFound: sortedUrls.length,
    analyzed,
    added,
    rejected,
    candidates,
    queries,
    searchMode,
  };
}
