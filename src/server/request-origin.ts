import type { Request } from 'express';
import { trimTrailingSlash } from '../shared/site.js';

/** Build redirect/callback base URL from the incoming request (fixes wrong DASHBOARD_URL env). */
export function getRequestSiteOrigin(req: Request): string {
  const forwardedProto = req.get('x-forwarded-proto');
  const proto = forwardedProto ? forwardedProto.split(',')[0]!.trim() : req.protocol;
  const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host');
  if (!host) return trimTrailingSlash(process.env.RENDER_EXTERNAL_URL || 'http://localhost:3847');
  return `${proto}://${host}`;
}

export function redirectToDashboardPath(req: Request, path: string): string {
  const dest = path.startsWith('/') && !path.startsWith('//') ? path : '/dashboard';
  return `${getRequestSiteOrigin(req)}${dest}`;
}
