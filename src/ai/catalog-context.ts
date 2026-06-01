import { getStats, getAllCasinos } from '../database/index.js';
import { retrieveCatalogForQuery } from './retrieval.js';
import type { Casino } from '../shared/types.js';

function formatCasinoLine(c: Casino): string {
  const feats = c.features.slice(0, 10).join(', ');
  const signup = c.signupRequirements.length ? `signup: ${c.signupRequirements.join(', ')}` : '';
  const bonus = c.bonusInfo ? `bonus: ${c.bonusInfo.slice(0, 80)}` : '';
  const health = c.healthStatus === 'failed' ? ' [HEALTH: FAILED]' : '';
  return `- ${c.name} | ${c.url} | rating ${c.rating.toFixed(1)} | ${feats}${signup ? ` | ${signup}` : ''}${bonus ? ` | ${bonus}` : ''}${health}`;
}

export function buildCatalogContext(query?: string, limit = 30): string {
  const stats = getStats();
  const allVerified = getAllCasinos(true);
  const casinos = query?.trim()
    ? retrieveCatalogForQuery(query, Math.min(limit, 20))
    : allVerified.slice(0, limit);

  const lines = [
    `Verified catalog: ${stats.verifiedCasinos} casinos (${stats.totalCasinos} total active)`,
    `No-phone signup: ${stats.noPhoneCasinos}`,
    `Email-only: ${stats.emailOnlyCasinos}`,
    `VPN allowed: ${stats.vpnAllowedCasinos}`,
    `Blocked scam URLs: ${stats.blockedSites}`,
    `Pending admin review: ${stats.pendingReview}`,
    `Stale catalog (90d+): ${stats.staleCatalogCasinos}`,
    `Failed health checks: ${stats.failedHealthCasinos}`,
    '',
    query?.trim()
      ? `Most relevant casinos for this question (${casinos.length}):`
      : 'Verified / catalog casinos:',
  ];

  for (const c of casinos) {
    lines.push(formatCasinoLine(c));
  }

  if (!query?.trim() && allVerified.length > limit) {
    lines.push(`… ${allVerified.length - limit} more in database`);
  }

  return lines.join('\n');
}
