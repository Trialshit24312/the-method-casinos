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

const ALLOWED_TLDS = new Set(['com', 'us', 'io', 'net', 'org', 'gg', 'co', 'tv', 'me', 'app']);

const JUNK_SUBDOMAIN_PREFIXES = new Set([
  'www', 'cdn', 'static', 'api', 'capi', 'cms', 'blog', 'login', 'lobby', 'game', 'play', 'offers',
  'affiliates', 'track', 'trk', 'chat-api', 'logi', 'sumsub', 'ps', 'psbb', 'cftw', 'glossary', 'support',
  'help', 'zendesk', 'trackju', 'onelink', 'm', 'mobile', 'app', 'mail', 'email', 'assets', 'media',
  'img', 'images', 'js', 'css', 'fonts', 'analytics', 'metrics', 'sentry', 'status', 'docs', 'ftp',
  'vpn', 'secure', 'auth', 'sso', 'account', 'accounts', 'my', 'portal', 'checkout', 'pay', 'payments',
  'widget', 'embed', 'live', 'stream', 'staging', 'dev', 'test', 'beta', 'alpha', 'promo', 'go', 'get',
  'link', 'links', 'click', 'clicks', 'redirect', 'redir', 'lp', 'landing', 'partner', 'partners',
]);

function isJunkSubdomainLabel(label: string): boolean {
  if (JUNK_SUBDOMAIN_PREFIXES.has(label)) return true;
  if (/^cdn\d+$/.test(label)) return true;
  if (/^cms\d+$/.test(label)) return true;
  return false;
}

/** Collapse CDN/login/etc. subdomains to operator root (e.g. cdn4.wowvegas.com → wowvegas.com). */
export function getOperatorRootHost(inputHost: string): string | null {
  let host = inputHost.toLowerCase().replace(/^www\./, '');
  if (!host || !host.includes('.')) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  const tld = parts[parts.length - 1];
  if (!ALLOWED_TLDS.has(tld)) return null;

  if (parts.length === 2) {
    if (isJunkSubdomainLabel(parts[0])) return null;
    return host;
  }

  // foo.stake.us → stake.us; login.chumbacasino.com → chumbacasino.com
  if (tld === 'us' && parts.length >= 3) {
    host = parts.slice(-2).join('.');
  } else if (parts.length > 2) {
    host = parts.slice(-2).join('.');
  }

  const rootParts = host.split('.');
  if (rootParts.length !== 2 || !ALLOWED_TLDS.has(rootParts[1])) return null;
  if (isJunkSubdomainLabel(rootParts[0])) return null;

  return host;
}

/** Root homepage URL for a casino operator (no paths/query). */
export function toCasinoRootUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const rootHost = getOperatorRootHost(host);
    if (!rootHost) throw new Error('invalid host');
    return `https://${rootHost}`;
  } catch {
    const fallbackHost = url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0];
    const rootHost = getOperatorRootHost(fallbackHost);
    if (!rootHost) throw new Error('invalid host');
    return `https://${rootHost}`;
  }
}

/** Hostname key for dedup — one scan/add per operator. */
export function casinoHostKey(url: string): string {
  try {
    return new URL(toCasinoRootUrl(url)).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    const root = getOperatorRootHost(url.toLowerCase().replace(/^www\./, '').split('/')[0]);
    return root ?? url.toLowerCase().replace(/^www\./, '').split('/')[0];
  }
}

/** Only bare operator roots — not CDN/login subdomains or invalid TLDs. */
export function isValidCasinoHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^www\./, '');
  const root = getOperatorRootHost(normalized);
  return root !== null && root === normalized;
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
