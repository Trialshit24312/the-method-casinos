import { describe, it, expect } from 'vitest';
import {
  resolveSearchRedirect,
  normalizeSearchLink,
  extractCasinoUrlsFromHtml,
} from '../src/discovery/free-search.js';
import { shouldQueueSearchUrl, isBlockedDomain } from '../src/discovery/filters.js';

describe('free search link extraction', () => {
  it('resolves DuckDuckGo uddg redirects', () => {
    const href = 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fpulsz.com%2F';
    expect(resolveSearchRedirect(href, 'https://duckduckgo.com')).toBe('https://pulsz.com/');
  });

  it('blocks junk domains via normalizeSearchLink', () => {
    expect(normalizeSearchLink('https://bonus.com/deals', 'https://bing.com')).toBeNull();
    expect(normalizeSearchLink('https://schema.org/docs', 'https://bing.com')).toBeNull();
  });

  it('accepts operator roots from anchor tags', () => {
    const html = `
      <div class="results">
        <a href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fwowvegas.com">Wow Vegas</a>
      </div>
    `;
    const links = extractCasinoUrlsFromHtml(html, 'https://html.duckduckgo.com/html/');
    expect(links.some((l) => l.includes('wowvegas.com'))).toBe(true);
    expect(links.some((l) => l.includes('bonus.com'))).toBe(false);
  });

  it('ignores schema.org in JSON-LD script blocks', () => {
    const html = `
      <script type="application/ld+json">{"url":"https://schema.org/Casino"}</script>
      <div class="results"><cite>wowvegas.com</cite></div>
    `;
    const links = extractCasinoUrlsFromHtml(html, 'https://bing.com/search');
    expect(links.some((l) => l.includes('schema.org'))).toBe(false);
  });
});

describe('shouldQueueSearchUrl', () => {
  it('rejects generic domains without casino hints', () => {
    expect(shouldQueueSearchUrl('https://bonus.com')).toBe(false);
    expect(shouldQueueSearchUrl('https://example.com')).toBe(false);
  });

  it('accepts operator-shaped hosts', () => {
    expect(shouldQueueSearchUrl('https://wowvegas.com')).toBe(true);
    expect(shouldQueueSearchUrl('https://pulsz.com')).toBe(true);
    expect(shouldQueueSearchUrl('https://lonestar.us')).toBe(true);
  });

  it('blocks review sites', () => {
    expect(isBlockedDomain('https://casino.guru/foo')).toBe(true);
    expect(shouldQueueSearchUrl('https://casino.guru/foo')).toBe(false);
  });
});
