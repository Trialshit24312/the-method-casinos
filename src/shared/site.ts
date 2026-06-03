/** Public URLs and site config — server and Discord bot. */

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Auto-detected public URL on Render and similar hosts. */
export function getHostedPublicUrl(): string | undefined {
  const render = process.env.RENDER_EXTERNAL_URL?.trim();
  if (render) return trimTrailingSlash(render);
  return undefined;
}

export function getPublicSiteUrl(): string {
  const url =
    process.env.PUBLIC_SITE_URL?.trim() ||
    process.env.DASHBOARD_URL?.trim() ||
    getHostedPublicUrl() ||
    'http://localhost:5173';
  return trimTrailingSlash(url);
}

export function getDashboardUrl(): string {
  const url =
    process.env.DASHBOARD_URL?.trim() ||
    process.env.PUBLIC_SITE_URL?.trim() ||
    getHostedPublicUrl() ||
    'http://localhost:5173';
  return trimTrailingSlash(url);
}

export function getApiUrl(): string {
  const url =
    process.env.API_URL?.trim() ||
    getHostedPublicUrl() ||
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

/** Exact URI sent to Discord — must match Developer Portal OAuth2 redirects. */
export function getDiscordRedirectUri(): string {
  const hosted = getHostedPublicUrl();
  const explicit = process.env.DISCORD_REDIRECT_URI?.trim();

  // Render/production: always callback on the live host (ignores stale localhost in env)
  if (hosted) {
    if (explicit && !isLocalhostUrl(explicit) && explicit.startsWith(hosted)) {
      return trimTrailingSlash(explicit);
    }
    return `${hosted}/auth/discord/callback`;
  }

  if (explicit && !isLocalhostUrl(explicit)) {
    return trimTrailingSlash(explicit);
  }

  // Local dev: use dashboard origin so Vite proxy keeps cookies on one port
  const dashboard = getDashboardUrl();
  return `${dashboard}/auth/discord/callback`;
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
    getHostedPublicUrl(),
  ]
    .filter((o): o is string => Boolean(o?.trim()))
    .map(trimTrailingSlash);

  if (process.env.NODE_ENV !== 'production' && !getHostedPublicUrl()) {
    origins.push('http://localhost:5173', 'http://localhost:3847');
  }

  return [...new Set(origins)];
}

export function getOAuthSetupInfo(): {
  redirectUri: string;
  discordPortalHint: string;
  loginUrl: string;
  hostedUrl: string | null;
} {
  return {
    redirectUri: getDiscordRedirectUri(),
    discordPortalHint:
      'Discord Developer Portal → your app → OAuth2 → Redirects → add redirectUri exactly (not just the site root)',
    loginUrl: `${getApiUrl()}/auth/discord`,
    hostedUrl: getHostedPublicUrl() ?? null,
  };
}
