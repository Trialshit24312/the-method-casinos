/**
 * Discovery web search from the user's browser (residential IP, no paid APIs).
 * Sends raw links to the server for normalization and validation.
 */

export type BrowserSearchEngine =
  | 'ddg_instant'
  | 'duckduckgo_lite'
  | 'duckduckgo'
  | 'bing'
  | 'brave'
  | 'reddit'
  | 'startpage';

export interface BrowserSearchHit {
  engine: BrowserSearchEngine;
  query: string;
  links: string[];
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const URL_IN_TEXT_REGEX = /https?:\/\/(?:www\.)?[a-z0-9][-a-z0-9]{0,62}\.[a-z]{2,24}(?:\/[^\s"'<>]*)?/gi;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function fetchText(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      credentials: 'omit',
      mode: 'cors',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Pull every href / visible URL string from SERP HTML. Server filters to operators. */
export function extractRawLinksFromHtml(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('a[href]').forEach((el) => {
    const href = el.getAttribute('href');
    if (href && !href.startsWith('javascript:')) links.add(href);
  });

  doc.querySelectorAll('cite, .snippet-url, .result__url, span.result__url, .b_algo cite').forEach((el) => {
    const text = el.textContent?.trim().split(/\s/)[0]?.replace(/^www\./, '');
    if (text?.includes('.')) {
      links.add(text.startsWith('http') ? text : `https://${text.split('/')[0]}`);
    }
  });

  const blocks = doc.querySelector('.results, #links, .b_algo, #rso, .snippet-content');
  const textSource = blocks?.textContent ?? doc.body?.textContent ?? '';
  for (const raw of textSource.match(URL_IN_TEXT_REGEX) ?? []) {
    links.add(raw.replace(/[),.;]+$/, ''));
  }

  for (const raw of html.match(URL_IN_TEXT_REGEX) ?? []) {
    links.add(raw.replace(/[),.;]+$/, ''));
  }

  // Resolve obvious relative links against SERP base
  const resolved: string[] = [];
  for (const link of links) {
    try {
      if (link.startsWith('//')) resolved.push(`https:${link}`);
      else if (link.startsWith('/')) resolved.push(new URL(link, baseUrl).href);
      else resolved.push(link);
    } catch {
      resolved.push(link);
    }
  }
  return resolved;
}

interface DdgTopic {
  FirstURL?: string;
  Text?: string;
  Topics?: DdgTopic[];
}

async function searchDdgInstant(query: string): Promise<string[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  try {
    const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      Results?: DdgTopic[];
      RelatedTopics?: DdgTopic[];
    };
    const out = new Set<string>();
    const walk = (topics: DdgTopic[] | undefined) => {
      for (const t of topics ?? []) {
        if (t.FirstURL) out.add(t.FirstURL);
        if (t.Topics) walk(t.Topics);
      }
    };
    walk(data.Results);
    walk(data.RelatedTopics);
    return [...out];
  } catch {
    return [];
  }
}

async function searchDdgLite(query: string): Promise<string[]> {
  const html = await fetchText('https://lite.duckduckgo.com/lite/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: new URLSearchParams({ q: query }).toString(),
  });
  if (!html) return [];
  return extractRawLinksFromHtml(html, 'https://lite.duckduckgo.com/lite/');
}

async function searchDdgHtml(query: string, page: number): Promise<string[]> {
  const url = buildDdgHtmlUrl(query, page);
  const html = await fetchText(url, { headers: { 'User-Agent': UA } });
  if (!html) return [];
  return extractRawLinksFromHtml(html, url);
}

async function searchBing(query: string, page: number): Promise<string[]> {
  const url = buildBingUrl(query, page);
  const html = await fetchText(url, { headers: { 'User-Agent': UA } });
  if (!html) return [];
  return extractRawLinksFromHtml(html, url);
}

async function searchStartpage(query: string, page: number): Promise<string[]> {
  const url = `https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}&page=${page + 1}`;
  const html = await fetchText(url, { headers: { 'User-Agent': UA } });
  if (!html) return [];
  return extractRawLinksFromHtml(html, url);
}

async function searchBrave(query: string, page: number): Promise<string[]> {
  const url = buildBraveUrl(query, page);
  const html = await fetchText(url, { headers: { 'User-Agent': UA } });
  if (!html) return [];
  return extractRawLinksFromHtml(html, url);
}

async function searchReddit(query: string): Promise<string[]> {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=25&sort=new`;
  try {
    const res = await fetch(url, {
      credentials: 'omit',
      mode: 'cors',
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: { children?: { data?: { url?: string; selftext?: string } }[] };
    };
    const links = new Set<string>();
    for (const child of data.data?.children ?? []) {
      const post = child.data;
      if (post?.url) links.add(post.url);
      for (const raw of post?.selftext?.match(URL_IN_TEXT_REGEX) ?? []) {
        links.add(raw.replace(/[),.;]+$/, ''));
      }
    }
    return [...links];
  } catch {
    return [];
  }
}

/** Run all browser-accessible search engines for one query. */
export async function collectBrowserSearchLinks(
  query: string,
  pages: number,
  onEngine?: (engine: BrowserSearchEngine, linkCount: number) => void,
): Promise<BrowserSearchHit[]> {
  const hits: BrowserSearchHit[] = [];
  const safePages = Math.min(Math.max(pages, 1), 6);

  const instant = await searchDdgInstant(query);
  hits.push({ engine: 'ddg_instant', query, links: instant });
  onEngine?.('ddg_instant', instant.length);
  await sleep(80);

  const lite = await searchDdgLite(query);
  if (lite.length) {
    hits.push({ engine: 'duckduckgo_lite', query, links: lite });
    onEngine?.('duckduckgo_lite', lite.length);
  }
  await sleep(100);

  const reddit = await searchReddit(query);
  if (reddit.length) {
    hits.push({ engine: 'reddit', query, links: reddit });
    onEngine?.('reddit', reddit.length);
  }
  await sleep(100);

  for (let page = 0; page < safePages; page++) {
    const ddg = await searchDdgHtml(query, page);
    if (ddg.length) {
      hits.push({ engine: 'duckduckgo', query: page > 0 ? `${query} (p${page + 1})` : query, links: ddg });
      onEngine?.('duckduckgo', ddg.length);
    }
    await sleep(120);

    const bing = await searchBing(query, page);
    if (bing.length) {
      hits.push({ engine: 'bing', query: page > 0 ? `${query} (p${page + 1})` : query, links: bing });
      onEngine?.('bing', bing.length);
    }
    await sleep(120);

    const brave = await searchBrave(query, page);
    if (brave.length) {
      hits.push({ engine: 'brave', query: page > 0 ? `${query} (p${page + 1})` : query, links: brave });
      onEngine?.('brave', brave.length);
    }
    await sleep(100);

    const startpage = await searchStartpage(query, page);
    if (startpage.length) {
      hits.push({ engine: 'startpage', query: page > 0 ? `${query} (p${page + 1})` : query, links: startpage });
      onEngine?.('startpage', startpage.length);
    }
    await sleep(100);
  }

  return hits;
}
