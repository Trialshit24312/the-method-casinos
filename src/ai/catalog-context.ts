import { getStats, getAllCasinos } from '../database/index.js';

export function buildCatalogContext(limit = 30): string {
  const stats = getStats();
  const allVerified = getAllCasinos(true);
  const casinos = allVerified.slice(0, limit);

  const lines = [
    `Verified catalog: ${stats.verifiedCasinos} casinos (${stats.totalCasinos} total active)`,
    `No-phone signup: ${stats.noPhoneCasinos}`,
    `Email-only: ${stats.emailOnlyCasinos}`,
    `VPN allowed: ${stats.vpnAllowedCasinos}`,
    `Blocked scam URLs: ${stats.blockedSites}`,
    `Pending admin review: ${stats.pendingReview}`,
    '',
    'Verified / catalog casinos:',
  ];

  for (const c of casinos) {
    const feats = c.features.slice(0, 8).join(', ');
    lines.push(`- ${c.name} | ${c.url} | verified=${c.verified} | ${feats}`);
  }

  if (allVerified.length > limit) {
    lines.push(`… ${allVerified.length - limit} more in database`);
  }

  return lines.join('\n');
}
