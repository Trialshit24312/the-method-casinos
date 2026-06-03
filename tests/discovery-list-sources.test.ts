import { describe, it, expect } from 'vitest';
import { extractOperatorLinksFromListPage } from '../src/discovery/directory-miner.js';
import { getSweepstakesListSiteUrls, isWebSearchDiscoveryEnabled } from '../src/discovery/list-sources.js';
import { buildSearchQueries } from '../src/discovery/queries.js';

describe('list site discovery', () => {
  it('includes built-in list site URLs', () => {
    const urls = getSweepstakesListSiteUrls(true);
    expect(urls.length).toBeGreaterThan(8);
    expect(urls.some((u) => u.includes('sweepskings'))).toBe(true);
  });

  it('skips web search by default', () => {
    const prev = process.env.DISCOVERY_WEB_SEARCH;
    delete process.env.DISCOVERY_WEB_SEARCH;
    expect(isWebSearchDiscoveryEnabled()).toBe(false);
    expect(buildSearchQueries(true)).toEqual([]);
    if (prev) process.env.DISCOVERY_WEB_SEARCH = prev;
  });

  it('extracts operator links from list page HTML', () => {
    const html = `
      <html><body>
        <a href="https://www.mcluck.com/">McLuck</a>
        <a href="https://wowvegas.com/play">Wow Vegas</a>
        <a href="https://bonus.com/deals">Bonus deals</a>
      </body></html>
    `;
    const links = extractOperatorLinksFromListPage(html, 'https://www.sweepskings.com/');
    expect(links).toContain('https://mcluck.com');
    expect(links.some((u) => u.includes('wowvegas'))).toBe(true);
    expect(links.some((u) => u.includes('bonus.com'))).toBe(false);
  });
});
