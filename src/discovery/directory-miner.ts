import { extractCasinoUrlsFromHtml } from './free-search.js';
import { isSweepstakesDirectoryUrl } from './filters.js';

/** Fetch a roundup page and queue operator roots found in links (not the directory itself). */
export async function mineOperatorsFromDirectoryPage(
  pageUrl: string,
  fetchHtml: (url: string) => Promise<string | null>,
  enqueue: (url: string) => boolean,
): Promise<number> {
  const html = await fetchHtml(pageUrl);
  if (!html) return 0;

  const links = extractCasinoUrlsFromHtml(html, pageUrl, 'page');
  let queued = 0;
  for (const link of links) {
    if (isSweepstakesDirectoryUrl(link)) continue;
    if (enqueue(link)) queued++;
  }
  return queued;
}
