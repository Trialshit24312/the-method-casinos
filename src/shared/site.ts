/** Public URLs and site config — server and Discord bot. */

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function getPublicSiteUrl(): string {
  const url =
    process.env.PUBLIC_SITE_URL ||
    process.env.DASHBOARD_URL ||
    'http://localhost:5173';
  return trimTrailingSlash(url);
}

export function getDashboardUrl(): string {
  const url =
    process.env.DASHBOARD_URL ||
    process.env.PUBLIC_SITE_URL ||
    'http://localhost:5173';
  return trimTrailingSlash(url);
}

export function getApiUrl(): string {
  const url =
    process.env.API_URL ||
    (process.env.NODE_ENV === 'production'
      ? getPublicSiteUrl()
      : `http://localhost:${process.env.PORT || 3847}`);
  return trimTrailingSlash(url);
}

export function getDiscordInviteUrl(): string | undefined {
  return process.env.DISCORD_INVITE_URL?.trim() || undefined;
}

export function getDiscordOAuthLoginUrl(): string {
  return `${getApiUrl()}/auth/discord`;
}

export function sitePage(path: string): string {
  const base = getPublicSiteUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function methodFooterText(extra?: string): string {
  const site = getPublicSiteUrl();
  const base = `The Method Casinos • ${site}`;
  return extra ? `${base} • ${extra}` : base;
}

export function getAllowedCorsOrigins(): string[] {
  const origins = [
    process.env.DASHBOARD_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.API_URL,
  ]
    .filter((o): o is string => Boolean(o?.trim()))
    .map(trimTrailingSlash);

  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173', 'http://localhost:3847');
  }

  return [...new Set(origins)];
}
