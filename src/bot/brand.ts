import { EmbedBuilder } from 'discord.js';
import { getPublicSiteUrl, methodFooterText, sitePage } from '../shared/site.js';

/** Discord embed colors aligned with the web dashboard (copper + cyan). */
export const BRAND = {
  copper: 0xb87333,
  cyan: 0x00aeef,
  green: 0x10b981,
  gold: 0xd4956a,
  red: 0xef4444,
  violet: 0x7c3aed,
  discord: 0x5865f2,
} as const;

export const BRAND_TAGLINE = 'Precision · Strategy · Execution';
export const BRAND_MOTTO = 'Verified sweepstakes · No phone signup · Free web search';

export function brandThumbnailUrl(): string {
  return `${getPublicSiteUrl()}/logo.png`;
}

export function brandAuthorBlock() {
  return {
    name: `The Method — ${BRAND_TAGLINE}`,
    iconURL: brandThumbnailUrl(),
  };
}

export function brandFooter(extra?: string): string {
  return methodFooterText(extra ? `${BRAND_MOTTO} · ${extra}` : BRAND_MOTTO);
}

/** Apply consistent author, thumbnail, and footer to marketing embeds. */
export function applyBrandEmbed(embed: EmbedBuilder, footerExtra?: string): EmbedBuilder {
  return embed
    .setAuthor(brandAuthorBlock())
    .setThumbnail(brandThumbnailUrl())
    .setFooter({ text: brandFooter(footerExtra) })
    .setTimestamp();
}

export function brandButtonRow() {
  return [
    { label: 'Open Dashboard', url: getPublicSiteUrl(), emoji: '🔗' },
    { label: 'Similar Search', url: sitePage('/similar'), emoji: '✨' },
    { label: 'URL Checker', url: sitePage('/tools/checker'), emoji: '🛡️' },
    { label: 'Browse Catalog', url: sitePage('/casinos'), emoji: '🎰' },
  ] as const;
}
