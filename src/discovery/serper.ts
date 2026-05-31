import fetch from 'node-fetch';
import { casinoHostKey, toCasinoRootUrl, isValidCasinoHost } from '../shared/utils.js';
import { isDiscoveryCandidateUrl, isBlockedDomain } from './filters.js';

interface SerperOrganic {
  link?: string;
}

interface SerperResponse {
  organic?: SerperOrganic[];
}

function normalizeSerperLink(href: string): string | null {
  try {
    const root = toCasinoRootUrl(href);
    const host = casinoHostKey(root);
    if (!isValidCasinoHost(host)) return null;
    if (!isDiscoveryCandidateUrl(root) || isBlockedDomain(root)) return null;
    return root;
  } catch {
    return null;
  }
}

export function isSerperEnabled(): boolean {
  return Boolean(process.env.SERPER_API_KEY?.trim());
}

export async function searchSerper(query: string, page = 1): Promise<string[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return [];

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'us',
      hl: 'en',
      num: 10,
      page,
    }),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as SerperResponse;
  const links = new Set<string>();
  for (const item of data.organic ?? []) {
    if (!item.link) continue;
    const root = normalizeSerperLink(item.link);
    if (root) links.add(root);
  }
  return [...links];
}
