import * as cheerio from 'cheerio';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import { isBlockedDomain, isDiscoveryCandidateUrl, isSweepstakesDirectoryUrl } from './filters.js';
import { resolveSearchRedirect } from './free-search.js';

const URL_IN_TEXT_REGEX = /https?:\/\/(?:www\.)?[a-z0-9][-a-z0-9]{0,62}\.[a-z]{2,24}(?:\/[^\s"'<>]*)?/gi;

export type ListOperatorResult = 'saved' | 'queued' | 'skipped';

/** Pull operator roots from list/directory HTML — looser than SERP link rules. */
export function extractOperatorLinksFromListPage(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const $ = cheerio.load(html);
  $('script, style, noscript, svg').remove();

  const tryHref = (href: string | undefined) => {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
    const resolved = resolveSearchRedirect(href, baseUrl);
    if (!resolved || isBlockedDomain(resolved) || isSweepstakesDirectoryUrl(resolved)) return;
    try {
      const root = toCasinoRootUrl(resolved);
      const host = casinoHostKey(root);
      if (!isValidCasinoHost(host) || !isDiscoveryCandidateUrl(root)) return;
      links.add(root);
    } catch {
      /* skip */
    }
  };

  $('a[href]').each((_, el) => tryHref($(el).attr('href')));
  $('[data-href], [data-url]').each((_, el) => {
    tryHref($(el).attr('data-href') ?? $(el).attr('data-url'));
  });

  for (const raw of `${$('body').text()}\n${html}`.match(URL_IN_TEXT_REGEX) ?? []) {
    tryHref(raw.replace(/[),.;]+$/, ''));
  }

  return [...links];
}

/** Fetch a list site — save each operator immediately via handleOperator (not just queue). */
export async function mineOperatorsFromDirectoryPage(
  pageUrl: string,
  fetchHtml: (url: string) => Promise<string | null>,
  handleOperator: (url: string) => ListOperatorResult,
): Promise<{ saved: number; queued: number; skipped: number }> {
  const html = await fetchHtml(pageUrl);
  if (!html) return { saved: 0, queued: 0, skipped: 0 };

  const links = extractOperatorLinksFromListPage(html, pageUrl);
  let saved = 0;
  let queued = 0;
  let skipped = 0;
  for (const link of links) {
    const result = handleOperator(link);
    if (result === 'saved') saved++;
    else if (result === 'queued') queued++;
    else skipped++;
  }
  return { saved, queued, skipped };
}

export async function mineAllListSites(
  urls: string[],
  fetchHtml: (url: string) => Promise<string | null>,
  handleOperator: (url: string) => ListOperatorResult,
  onPage?: (siteUrl: string, saved: number, queued: number, fetched: boolean) => void,
): Promise<{ sitesCrawled: number; saved: number; queued: number }> {
  let sitesCrawled = 0;
  let saved = 0;
  let queued = 0;

  for (const siteUrl of urls) {
    const html = await fetchHtml(siteUrl);
    const fetched = Boolean(html);
    let result = { saved: 0, queued: 0, skipped: 0 };
    if (html) {
      const links = extractOperatorLinksFromListPage(html, siteUrl);
      for (const link of links) {
        const op = handleOperator(link);
        if (op === 'saved') result.saved++;
        else if (op === 'queued') result.queued++;
        else result.skipped++;
      }
    }
    sitesCrawled++;
    saved += result.saved;
    queued += result.queued;
    onPage?.(siteUrl, result.saved, result.queued, fetched);
  }

  return { sitesCrawled, saved, queued };
}
