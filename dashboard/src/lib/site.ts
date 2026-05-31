/** Client-side public URLs (Vite env). */

export function publicSiteUrl(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:5173';
}

export function apiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return '';
}

export function discordInviteUrl(): string | undefined {
  return import.meta.env.VITE_DISCORD_INVITE?.trim() || undefined;
}

export function sitePath(path: string): string {
  const base = publicSiteUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
