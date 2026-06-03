import {
  getCasinoById,
  getKnownHosts,
  isUrlBlocked,
  getBlockedUrls,
  addCasino,
  markDiscoverySeen,
  getAllCasinos,
  queueDiscoveryBanReview,
} from '../database/index.js';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import { rankSimilarCasinos, type SimilarCasinoMatch } from '../shared/similarity.js';
import type { Casino } from '../shared/types.js';
import { inferFeaturesFromText } from '../shared/feature-inference.js';
import { buildSimilarWebQueries, collectFreeSearchLinks } from './free-search.js';
import { isBlockedDomain, isDiscoveryCandidateUrl, validateSweepstakesPage, sanitizeCasinoName } from './filters.js';
import { inferRating } from '../shared/rating.js';

const ANALYZE_TIMEOUT_MS = 12_000;

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

export interface SimilarWebDiscoveryResult {
  source: Casino;
  catalogMatches: SimilarCasinoMatch[];
  webUrlsFound: number;
  analyzed: number;
  added: number;
  rejected: number;
  candidates: { name: string; url: string; status: 'added' | 'rejected' | 'skipped'; reason?: string }[];
  queries: string[];
}

export async function discoverSimilarOnWeb(
  casinoId: string,
  options: { maxQueries?: number; maxAnalyze?: number; searchPages?: number } = {},
): Promise<SimilarWebDiscoveryResult | null> {
  const source = getCasinoById(casinoId);
  if (!source) return null;

  const maxQueries = options.maxQueries ?? 5;
  const maxAnalyze = options.maxAnalyze ?? 12;
  const searchPages = options.searchPages ?? 2;

  const catalog = getAllCasinos(true);
  const catalogMatches = rankSimilarCasinos(source, catalog.filter((c) => c.id !== source.id), 12);

  const knownHosts = getKnownHosts();
  const blockedUrls = getBlockedUrls();
  const host = casinoHostKey(source.url);
  const queries = buildSimilarWebQueries(source.name, host).slice(0, maxQueries);

  const urlScores = new Map<string, number>();

  for (const query of queries) {
    const links = await collectFreeSearchLinks(
      query,
      searchPages,
      undefined,
      { maxLinks: 40 },
    );
    for (const link of links) {
      const h = casinoHostKey(link);
      if (h === host || knownHosts.has(h)) continue;
      if (blockedUrls.has(h) || isUrlBlocked(link)) continue;
      if (!isDiscoveryCandidateUrl(link) || isBlockedDomain(link)) continue;
      const score = scoreUrlForSource(link, source);
      const prev = urlScores.get(link) ?? 0;
      urlScores.set(link, Math.max(prev, score));
    }
    await sleep(200);
  }

  const sortedUrls = [...urlScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url);

  const candidates: SimilarWebDiscoveryResult['candidates'] = [];
  let analyzed = 0;
  let added = 0;
  let rejected = 0;

  for (const url of sortedUrls) {
    if (analyzed >= maxAnalyze) break;
    analyzed++;

    const root = toCasinoRootUrl(url);
    const h = casinoHostKey(root);
    if (!isValidCasinoHost(h) || knownHosts.has(h)) {
      candidates.push({ name: h, url: root, status: 'skipped', reason: 'already known' });
      continue;
    }

    const html = await fetchHomepage(root);
    if (!html) {
      rejected++;
      markDiscoverySeen(root, 'rejected', 'fetch failed');
      queueDiscoveryBanReview(root, 'fetch failed');
      candidates.push({ name: h, url: root, status: 'rejected', reason: 'fetch failed' });
      continue;
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || h;
    const bodyText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
    const metaDesc = metaMatch?.[1] || '';

    const validation = validateSweepstakesPage(title, metaDesc, bodyText, root);
    if (!validation.valid) {
      rejected++;
      const reason = validation.reason ?? 'validation failed';
      markDiscoverySeen(root, 'rejected', reason);
      queueDiscoveryBanReview(root, reason);
      candidates.push({ name: sanitizeCasinoName(title, root), url: root, status: 'rejected', reason: validation.reason });
      continue;
    }

    const combined = `${title} ${metaDesc} ${bodyText}`;
    const features = inferFeaturesFromText(combined);
    const name = sanitizeCasinoName(title, root);
    const casino = addCasino({
      name,
      url: root,
      description: metaDesc || `Found via web search similar to ${source.name}`,
      features,
      signupRequirements: features.includes('email_only') ? ['Email', 'Password'] : ['Email'],
      source: 'similar_web',
      verified: false,
      reviewStatus: 'pending',
      rating: inferRating(features, { source: 'similar_web' }),
    });

    if (casino) {
      added++;
      knownHosts.add(h);
      markDiscoverySeen(root, 'added', `similar to ${source.name}`);
      candidates.push({ name: casino.name, url: root, status: 'added' });
    } else {
      candidates.push({ name, url: root, status: 'skipped', reason: 'duplicate or blocked' });
    }

    await sleep(250);
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
  };
}
