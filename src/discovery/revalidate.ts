import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import {
  getStaleCatalogCasinos,
  getCasinoById,
  touchLastCheckedAt,
  updateCasino,
  setCasinoHealth,
} from '../database/index.js';
import { validateSweepstakesPage } from './filters.js';
import { toCasinoRootUrl, casinoHostKey } from '../shared/utils.js';
import { STALE_CATALOG_DAYS } from '../shared/freshness.js';
import { notifyRevalidationFailures } from '../shared/notify.js';

const UA = 'Mozilla/5.0 (compatible; MethodCasinosBot/1.0; +https://the-method-casinos.onrender.com)';

export interface RevalidateResult {
  id: string;
  url: string;
  name: string;
  ok: boolean;
  reason?: string;
}

async function fetchHomepage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function revalidateCasinoById(id: string): Promise<RevalidateResult> {
  const casino = getCasinoById(id);
  if (!casino) return { id, url: '', name: '', ok: false, reason: 'not found' };

  const root = toCasinoRootUrl(casino.url);
  const html = await fetchHomepage(root);
  if (!html) {
    setCasinoHealth(id, 'failed', 'Homepage fetch failed');
    return { id, url: root, name: casino.name, ok: false, reason: 'fetch failed' };
  }

  const $ = cheerio.load(html);
  const title = $('title').text().trim() || casinoHostKey(root);
  const bodyText = $('body').text().replace(/\s+/g, ' ').slice(0, 6000);
  const metaDesc = $('meta[name="description"]').attr('content') || '';

  const validation = validateSweepstakesPage(title, metaDesc, bodyText, root);
  if (!validation.valid) {
    setCasinoHealth(id, 'failed', validation.reason ?? 'validation failed');
    return { id, url: root, name: casino.name, ok: false, reason: validation.reason ?? 'validation failed' };
  }

  touchLastCheckedAt(root);
  setCasinoHealth(id, 'ok', '');
  if (metaDesc && metaDesc !== casino.description) {
    updateCasino(id, { description: metaDesc.slice(0, 500) });
  }

  return { id, url: root, name: casino.name, ok: true };
}

export async function runRevalidationBatch(limit = 10): Promise<{
  checked: number;
  passed: number;
  failed: number;
  results: RevalidateResult[];
}> {
  const stale = getStaleCatalogCasinos(limit);
  const results: RevalidateResult[] = [];

  for (const casino of stale) {
    results.push(await revalidateCasinoById(casino.id));
    await new Promise((r) => setTimeout(r, 400));
  }

  const failedResults = results.filter((r) => !r.ok);
  if (failedResults.length) {
    void notifyRevalidationFailures(failedResults);
  }

  return {
    checked: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: failedResults.length,
    results,
  };
}

export { STALE_CATALOG_DAYS };
