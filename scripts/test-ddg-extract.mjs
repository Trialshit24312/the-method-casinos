import fs from 'fs';
import * as cheerio from 'cheerio';
import { isDiscoveryCandidateUrl, isBlockedDomain } from '../src/discovery/filters.ts';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../src/shared/utils.ts';

function resolveRedirectUrl(href, baseUrl) {
  try {
    let absolute = href;
    if (href.startsWith('//')) absolute = `https:${href}`;
    else if (href.startsWith('/')) absolute = new URL(href, baseUrl).href;
    else if (!href.startsWith('http')) absolute = new URL(href, baseUrl).href;
    const parsed = new URL(absolute);
    if (parsed.hostname.includes('duckduckgo.com') && parsed.searchParams.has('uddg')) {
      return decodeURIComponent(parsed.searchParams.get('uddg'));
    }
    if (parsed.hostname.includes('bing.com') && parsed.pathname.includes('ck/a')) {
      const u = parsed.searchParams.get('u');
      if (u) {
        try { return atob(u.startsWith('a1') ? u.slice(2) : u); } catch { return decodeURIComponent(u); }
      }
    }
    return absolute;
  } catch { return null; }
}

function normalizeLinkToRoot(href, baseUrl) {
  const resolved = resolveRedirectUrl(href, baseUrl);
  if (!resolved || !isDiscoveryCandidateUrl(resolved) || isBlockedDomain(resolved)) return null;
  try {
    const root = toCasinoRootUrl(resolved);
    if (!isValidCasinoHost(casinoHostKey(root))) return null;
    return root;
  } catch { return null; }
}

const html = fs.readFileSync('ddg-sample.html', 'utf8');
const $ = cheerio.load(html);
let count = 0;
$('a.result__a').each((_, el) => {
  const href = $(el).attr('href');
  if (!href) return;
  const root = normalizeLinkToRoot(href, 'https://html.duckduckgo.com/html/');
  if (root) { console.log('OK', root); count++; }
});
console.log('Total extracted:', count);
