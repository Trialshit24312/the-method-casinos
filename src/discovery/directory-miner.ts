import * as cheerio from 'cheerio';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import { isBlockedDomain, isDiscoveryCandidateUrl, isSweepstakesDirectoryUrl } from './filters.js';
import { resolveSearchRedirect } from './free-search.js';

const URL_IN_TEXT_REGEX = /https?:\/\/(?:www\.)?[a-z0-9][-a-z0-9]{0,62}\.[a-z]{2,24}(?:\/[^\s"'<>]*)?/gi;

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

/** Fetch a list site and queue every sweepstakes operator link found on the page. */
export async function mineOperatorsFromDirectoryPage(
  pageUrl: string,
  fetchHtml: (url: string) => Promise<string | null>,
  enqueue: (url: string) => boolean,
): Promise<number> {
  const html = await fetchHtml(pageUrl);
  if (!html) return 0;

  const links = extractOperatorLinksFromListPage(html, pageUrl);
  let queued = 0;
  for (const link of links) {
    if (enqueue(link)) queued++;
  }
  return queued;
}

export async function mineAllListSites(
  urls: string[],
  fetchHtml: (url: string) => Promise<string | null>,
  enqueue: (url: string) => boolean,
  onPage?: (siteUrl: string, linksQueued: number) => void,
): Promise<{ sitesCrawled: number; linksQueued: number }> {
  let sitesCrawled = 0;
  let linksQueued = 0;

  for (const siteUrl of urls) {
    const n = await mineOperatorsFromDirectoryPage(siteUrl, fetchHtml, enqueue);
    sitesCrawled++;
    linksQueued += n;
    onPage?.(siteUrl, n);
  }

  return { sitesCrawled, linksQueued };
}
