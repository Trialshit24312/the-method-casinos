import { getPublicSiteUrl } from '../shared/site.js';

/** Discord embed colors aligned with the web dashboard (copper + cyan). */
export const BRAND = {
  copper: 0xb87333,
  cyan: 0x00aeef,
  green: 0x10b981,
  gold: 0xd4956a,
  red: 0xef4444,
  violet: 0x7c3aed,
} as const;

export function brandThumbnailUrl(): string {
  return `${getPublicSiteUrl()}/logo.png`;
}

export function brandAuthorBlock() {
  return {
    name: 'The Method Casinos',
    iconURL: brandThumbnailUrl(),
  };
}
