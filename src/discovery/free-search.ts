import * as cheerio from 'cheerio';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import { isBlockedDomain, shouldQueueSearchUrl } from './filters.js';
import { isSerperEnabled, searchSerper } from './serper.js';

export type FreeSearchEngine = 'serper' | 'duckduckgo' | 'duckduckgo_lite' | 'bing' | 'brave';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 16_000;

const URL_IN_TEXT_REGEX = /https?:\/\/(?:www\.)?[a-z0-9][-a-z0-9]{0,62}\.[a-z]{2,24}(?:\/[^\s"'<>]*)?/gi;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function resolveSearchRedirect(href: string, baseUrl: string, depth = 0): string | null {
  if (depth > 5) return null;
  try {
    let absolute = href;
    if (href.startsWith('//')) absolute = `https:${href}`;
    else if (href.startsWith('/')) absolute = new URL(href, baseUrl).href;
    else if (!href.startsWith('http')) absolute = new URL(href, baseUrl).href;

    const parsed = new URL(absolute);
    const raw = absolute;

    if (parsed.hostname.includes('duckduckgo.com')) {
      const adDomain = raw.match(/ad_domain=([a-z0-9.-]+\.[a-z]{2,})/i)?.[1];
      if (adDomain) return `https://${adDomain.replace(/^www\./, '')}`;

      if (parsed.searchParams.has('uddg')) {
        const uddg = decodeURIComponent(parsed.searchParams.get('uddg')!);
        return resolveSearchRedirect(uddg, baseUrl, depth + 1);
      }
    }

    if (parsed.hostname.includes('bing.com') && (parsed.pathname.includes('ck/a') || parsed.searchParams.has('u'))) {
      const u = parsed.searchParams.get('u');
      if (u) {
        try {
          const decoded = atob(u.startsWith('a1') ? u.slice(2) : u);
          return resolveSearchRedirect(decoded, baseUrl, depth + 1) ?? decoded;
        } catch {
          return resolveSearchRedirect(decodeURIComponent(u), baseUrl, depth + 1);
        }
      }
    }

    if (parsed.hostname.includes('brave.com') && parsed.searchParams.has('u')) {
      return resolveSearchRedirect(decodeURIComponent(parsed.searchParams.get('u')!), baseUrl, depth + 1);
    }

    if (parsed.hostname.includes('google.') && parsed.pathname === '/url' && parsed.searchParams.has('q')) {
      return resolveSearchRedirect(parsed.searchParams.get('q')!, baseUrl, depth + 1);
    }

    return absolute;
  } catch {
    return null;
  }
}

export function normalizeSearchLink(href: string, baseUrl: string): string | null {
  const resolved = resolveSearchRedirect(href, baseUrl);
  if (!resolved || isBlockedDomain(resolved) || !shouldQueueSearchUrl(resolved)) return null;
  try {
    const root = toCasinoRootUrl(resolved);
    if (!isValidCasinoHost(casinoHostKey(root))) return null;
    return root;
  } catch {
    return null;
  }
}

/** Extract operator URLs from HTML — search SERP pages or casino homepages. */
export function extractCasinoUrlsFromHtml(html: string, baseUrl: string, mode: 'search' | 'page' = 'search'): string[] {
  const links = new Set<string>();
  const $ = cheerio.load(html);
  $('script, style, noscript, svg').remove();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const root = normalizeSearchLink(href, baseUrl);
    if (root) links.add(root);
  });

  $('cite, .snippet-url, .result__url, span.result__url, .b_algo cite, .snippet-title, .result__a').each((_, el) => {
    const text = $(el).text().trim().split(/\s/)[0]?.replace(/^www\./, '');
    if (!text || !text.includes('.')) return;
    const guess = text.startsWith('http') ? text : `https://${text.split('/')[0]}`;
    const root = normalizeSearchLink(guess, baseUrl);
    if (root) links.add(root);
  });

  const ogUrl = $('meta[property="og:url"]').attr('content');
  if (ogUrl) {
    const root = normalizeSearchLink(ogUrl, baseUrl);
    if (root) links.add(root);
  }

  const textSource = mode === 'page'
    ? $('body').text()
    : $('.results, #links, .b_algo, .snippet-content, .result, #rso')
      .toArray()
      .map((el) => $(el).text())
      .join(' ');

  for (const raw of textSource.match(URL_IN_TEXT_REGEX) ?? []) {
    const root = normalizeSearchLink(raw.replace(/[),.;]+$/, ''), baseUrl);
    if (root) links.add(root);
  }

  if (mode === 'page') {
    for (const raw of html.match(URL_IN_TEXT_REGEX) ?? []) {
      const root = normalizeSearchLink(raw.replace(/[),.;]+$/, ''), baseUrl);
      if (root) links.add(root);
    }
  }

  return [...links];
}

async function fetchHtml(url: string, init?: RequestInit): Promise<string | null> {
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          ...(init?.headers as Record<string, string> | undefined),
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      return await res.text();
    } catch {
      if (attempt < 1) await sleep(350);
    }
  }
  return null;
}

function buildDdgHtmlUrl(query: string, page = 0): string {
  const base = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  return page > 0 ? `${base}&s=${page * 30}` : base;
}

function buildBingUrl(query: string, page = 0): string {
  return `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${1 + page * 10}&count=30`;
}

function buildBraveUrl(query: string, page = 0): string {
  return `https://search.brave.com/search?q=${encodeURIComponent(query)}&offset=${page * 10}`;
}

async function searchDdgLite(query: string): Promise<string | null> {
  const body = new URLSearchParams({ q: query });
  return fetchHtml('https://lite.duckduckgo.com/lite/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

export interface FreeSearchHit {
  engine: FreeSearchEngine;
  query: string;
  links: string[];
}

export interface CollectFreeSearchOptions {
  maxLinks?: number;
  /** Use Serper (Google) when SERPER_API_KEY is set — default true. */
  useSerper?: boolean;
}

export async function runFreeSearchQuery(
  query: string,
  page = 0,
  engines: FreeSearchEngine[] = ['duckduckgo_lite', 'duckduckgo', 'bing', 'brave'],
): Promise<FreeSearchHit[]> {
  const hits: FreeSearchHit[] = [];
  const activeEngines = page > 0
    ? engines.filter((e) => e !== 'duckduckgo_lite')
    : engines;

  for (const engine of activeEngines) {
    let html: string | null = null;
    let baseUrl = '';

    switch (engine) {
      case 'duckduckgo':
        baseUrl = buildDdgHtmlUrl(query, page);
        html = await fetchHtml(baseUrl);
        break;
      case 'duckduckgo_lite':
        baseUrl = 'https://lite.duckduckgo.com/lite/';
        html = await searchDdgLite(query);
        break;
      case 'bing':
        baseUrl = buildBingUrl(query, page);
        html = await fetchHtml(baseUrl);
        break;
      case 'brave':
        baseUrl = buildBraveUrl(query, page);
        html = await fetchHtml(baseUrl);
        break;
      default:
        break;
    }

    if (html) {
      hits.push({
        engine,
        query: page > 0 ? `${query} (p${page + 1})` : query,
        links: extractCasinoUrlsFromHtml(html, baseUrl, 'search'),
      });
    }
    await sleep(140);
  }

  return hits;
}

/** Collect unique operator URLs — Serper first when configured, then free engines. */
export async function collectFreeSearchLinks(
  query: string,
  pages: number,
  onEngine?: (engine: FreeSearchEngine, query: string, linkCount: number) => void,
  options: CollectFreeSearchOptions = {},
): Promise<string[]> {
  const urls = new Set<string>();
  const maxLinks = options.maxLinks ?? Infinity;
  const useSerper = options.useSerper !== false && isSerperEnabled();

  if (useSerper) {
    const serperPages = Math.min(Math.max(pages, 1), 3);
    for (let page = 1; page <= serperPages; page++) {
      if (urls.size >= maxLinks) break;
      const result = await searchSerper(query, page);
      for (const link of result.links) urls.add(link);
      onEngine?.('serper', page > 1 ? `${query} (p${page})` : query, result.links.length);
      if (result.error && page === 1) {
        console.warn(`Serper: ${result.error}`);
      }
      await sleep(120);
    }
  }

  for (let page = 0; page < pages; page++) {
    if (urls.size >= maxLinks) break;
    const hits = await runFreeSearchQuery(query, page);
    for (const hit of hits) {
      for (const link of hit.links) urls.add(link);
      onEngine?.(hit.engine, hit.query, hit.links.length);
      if (urls.size >= maxLinks) break;
    }
  }

  return [...urls];
}

import type { CasinoFeature } from '../shared/types.js';

/** Web queries to find casinos similar to a named operator. */
export function buildSimilarWebQueries(
  casinoName: string,
  host?: string,
  features: CasinoFeature[] = [],
): string[] {
  const name = casinoName.replace(/\s+casino$/i, '').trim();
  const short = name.split(/\s+/)[0];
  const queries = [
    `casinos like ${name} sweepstakes`,
    `sites like ${name} social casino sweeps coins`,
    `alternative to ${name} sweepstakes casino`,
    `${name} competitor sweepstakes casino usa`,
    `similar to ${name} no purchase necessary casino`,
    `reddit casinos like ${name} sweeps`,
    `best ${name} alternatives sweepstakes 2025`,
  ];
  if (host) {
    const bareHost = host.replace(/^www\./, '').split('.')[0];
    queries.push(`casinos like ${host.replace(/^www\./, '')}`);
    queries.push(`alternative to ${short} sweeps casino`);
    if (bareHost.length >= 4) queries.push(`sites similar to ${bareHost}.us sweepstakes`);
  }

  const featureQueries: Record<string, string> = {
    no_phone: `sweepstakes casino no phone signup like ${name}`,
    email_only: `email only signup sweeps casino like ${name}`,
    gift_card_redeem: `${name} alternative gift card redeem sweeps`,
    paypal_redeem: `sweepstakes casino paypal redeem like ${name}`,
    slots: `slots sweepstakes casino similar to ${name}`,
    fish_games: `fish games sweeps casino like ${name}`,
    live_games: `live dealer sweeps casino alternative ${name}`,
    vpn_allowed: `vpn friendly sweepstakes casino like ${name}`,
    fast_payout: `fast payout sweeps casino similar to ${name}`,
    low_min_redeem: `low minimum redeem sweeps like ${name}`,
    pragmatic_play: `pragmatic play sweeps casino like ${name}`,
    no_kyc: `no kyc sweepstakes casino alternative ${name}`,
  };

  for (const feature of features) {
    const q = featureQueries[feature];
    if (q) queries.push(q);
  }

  return [...new Set(queries)];
}
