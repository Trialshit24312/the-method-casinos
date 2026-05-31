export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    let host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let path = parsed.pathname.replace(/\/+$/, '') || '';
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

/** Root homepage URL for a casino operator (no paths/query). */
export function toCasinoRootUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.includes('.') || host.split('.').pop()!.length < 2) {
      throw new Error('invalid host');
    }
    return `https://${host}`;
  } catch {
    return ensureHttps(url);
  }
}

/** Hostname key for dedup — one scan/add per operator. */
export function casinoHostKey(url: string): string {
  try {
    return new URL(toCasinoRootUrl(url)).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^www\./, '').split('/')[0];
  }
}

export function isValidCasinoHost(host: string): boolean {
  if (!host || !host.includes('.')) return false;
  const parts = host.split('.');
  const tld = parts[parts.length - 1];
  return tld.length >= 2 && !host.startsWith('support.') && !host.startsWith('help.');
}

export function ensureHttps(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export function parseAdminIds(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean));
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

export function formatFeatureList(features: string[]): string {
  if (!features.length) return 'None listed';
  return features.join(', ');
}
