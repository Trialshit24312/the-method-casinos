import type { UrlCheckResult } from './types.js';
import { ensureHttps } from './utils.js';
import { getBlockedSiteByUrl, getCasinoByUrl, isUrlBlocked } from '../database/index.js';

export function checkCasinoUrl(raw: string): UrlCheckResult {
  const url = ensureHttps(raw.trim());
  const blockedSite = getBlockedSiteByUrl(url);
  const casino = getCasinoByUrl(url);
  const blocked = Boolean(blockedSite) || isUrlBlocked(url);
  const isApproved = Boolean(casino?.verified && casino.reviewStatus === 'approved');
  return {
    url,
    blocked,
    blockedSite,
    casino,
    safe: !blocked && isApproved,
    pendingReview: Boolean(casino?.reviewStatus === 'pending'),
  };
}
