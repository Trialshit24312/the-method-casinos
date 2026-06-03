import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from 'discord.js';
import type { Casino, CasinoFeature } from '../shared/types.js';
import { FEATURE_EMOJI, FEATURE_LABELS } from '../shared/types.js';
import { truncate } from '../shared/utils.js';
import { buildTrackablesText } from '../shared/trackables.js';
import type { SimilarCasinoMatch } from '../shared/similarity.js';
import { methodFooterText, sitePage } from '../shared/site.js';
import { BRAND, brandAuthorBlock, brandThumbnailUrl } from './brand.js';

const ACCENT_GREEN = BRAND.green;
const ACCENT_GOLD = BRAND.gold;
const BRAND_COLOR = BRAND.copper;

function starRating(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function vpnStatus(features: CasinoFeature[]): string {
  const parts: string[] = [];
  if (features.includes('vpn_blocked')) parts.push('🚫 VPN Blocked');
  else if (features.includes('vpn_allowed')) parts.push('🛡️ VPN Allowed');
  else parts.push('❓ VPN Unknown');

  if (features.includes('geo_restricted')) parts.push('🌍 Geo Restricted');

  return parts.join(' • ');
}

export function buildCasinoEmbed(casino: Casino, index?: number, total?: number): EmbedBuilder {
  const featureBadges = casino.features
    .map((f) => `${FEATURE_EMOJI[f]} ${FEATURE_LABELS[f]}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(casino.verified ? ACCENT_GREEN : BRAND.cyan)
    .setAuthor(brandAuthorBlock())
    .setThumbnail(brandThumbnailUrl())
    .setTitle(`${casino.verified ? '✅ ' : '🎰 '}${casino.name}`)
    .setURL(casino.url)
    .setDescription(truncate(casino.description || 'No description available.', 300))
    .addFields(
      {
        name: '⭐ Rating',
        value: `${starRating(casino.rating)} (${casino.rating.toFixed(1)}/5)`,
        inline: true,
      },
      {
        name: '📝 Sign Up',
        value: casino.signupRequirements.length
          ? casino.signupRequirements.join(' + ')
          : 'Email + Password',
        inline: true,
      },
      {
        name: '🎁 Bonus',
        value: casino.bonusInfo || 'Check site for current offers',
        inline: true,
      },
      {
        name: '🔐 VPN / Access',
        value: vpnStatus(casino.features),
        inline: true,
      },
      {
        name: '📈 Trackables',
        value: truncate(
          buildTrackablesText(casino.cashOutBeforeBlocked, casino.trackables),
          400,
        ),
        inline: false,
      },
      {
        name: '🏷️ Features',
        value: featureBadges || 'None listed',
        inline: false,
      },
    )
    .setFooter({
      text: methodFooterText(
        `${index !== undefined && total !== undefined ? `${index + 1}/${total}` : ''}${casino.verified ? ' • Verified' : ''}`.trim() || undefined,
      ),
    })
    .setTimestamp(new Date(casino.updatedAt));

  return embed;
}

export function buildCasinoButtons(casino: Casino): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Visit Casino')
        .setStyle(ButtonStyle.Link)
        .setURL(casino.url)
        .setEmoji('🔗'),
      new ButtonBuilder()
        .setLabel('Find Similar')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage(`/similar?casino=${casino.id}`))
        .setEmoji('✨'),
      new ButtonBuilder()
        .setLabel('Share')
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`share:${casino.id}`)
        .setEmoji('📤'),
    ),
  ];
}

export function buildListEmbed(
  casinos: Casino[],
  title: string,
  description: string,
): EmbedBuilder {
  const lines = casinos.slice(0, 15).map((c, i) => {
    const icons = c.features
      .slice(0, 3)
      .map((f) => FEATURE_EMOJI[f])
      .join('');
    return `\`${String(i + 1).padStart(2, ' ')}\` ${c.verified ? '✅' : '◻️'} **${c.name}** ${icons} — ${c.rating.toFixed(1)}★`;
  });

  if (casinos.length > 15) {
    lines.push(`\n*...and ${casinos.length - 15} more*`);
  }

  return new EmbedBuilder()
    .setColor(BRAND.cyan)
    .setAuthor(brandAuthorBlock())
    .setThumbnail(brandThumbnailUrl())
    .setTitle(`🎰 ${title}`)
    .setDescription(`${description}\n\n${lines.join('\n') || 'No casinos found.'}`)
    .setFooter({ text: methodFooterText(`${casinos.length} result(s)`) })
    .setTimestamp();
}

export function buildSimilarEmbed(
  source: Casino,
  matches: SimilarCasinoMatch[],
): EmbedBuilder {
  const lines = matches.slice(0, 10).map((m, i) => {
    const icons = m.sharedFeatures.slice(0, 3).map((f) => FEATURE_EMOJI[f]).join('');
    return `\`${String(i + 1).padStart(2, ' ')}\` **${m.matchPercent}%** ${m.casino.verified ? '✅' : '◻️'} **${m.casino.name}** ${icons}\n↳ ${m.casino.url}`;
  });

  const embed = new EmbedBuilder()
    .setColor(BRAND.gold)
    .setAuthor(brandAuthorBlock())
    .setThumbnail(brandThumbnailUrl())
    .setTitle(`✨ Similar to ${source.name}`)
    .setDescription(
      matches.length
        ? `Matched by features, VPN access, signup style & rating:\n\n${lines.join('\n\n')}`
        : 'No close matches in the database yet.',
    )
    .setFooter({ text: methodFooterText('/similar') })
    .setTimestamp();

  if (matches[0]) {
    embed.addFields({
      name: 'Top match',
      value: `${matches[0].reasons.slice(0, 3).join(' • ') || 'Feature overlap'}`,
      inline: false,
    });
  }

  return embed;
}

export function buildSimilarButtons(source: Casino): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Open on Web')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage(`/similar?casino=${source.id}`))
        .setEmoji('🌐'),
      new ButtonBuilder()
        .setLabel('Visit Source')
        .setStyle(ButtonStyle.Link)
        .setURL(source.url)
        .setEmoji('🔗'),
      new ButtonBuilder()
        .setLabel('Browse Catalog')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/casinos'))
        .setEmoji('🎰'),
    ),
  ];
}

export function buildCompareEmbed(a: Casino, b: Casino): EmbedBuilder {
  const shared = a.features.filter((f) => b.features.includes(f));
  const onlyA = a.features.filter((f) => !b.features.includes(f)).slice(0, 6);
  const onlyB = b.features.filter((f) => !a.features.includes(f)).slice(0, 6);

  return new EmbedBuilder()
    .setColor(BRAND.gold)
    .setAuthor(brandAuthorBlock())
    .setTitle(`⚖️ ${a.name} vs ${b.name}`)
    .addFields(
      { name: a.name, value: `⭐ ${a.rating.toFixed(1)}\n${a.url}`, inline: true },
      { name: b.name, value: `⭐ ${b.rating.toFixed(1)}\n${b.url}`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      {
        name: 'Signup',
        value: [
          `**${a.name}:** ${a.signupRequirements.join(', ') || '—'}`,
          `**${b.name}:** ${b.signupRequirements.join(', ') || '—'}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: `Shared features (${shared.length})`,
        value: shared.slice(0, 10).map((f) => FEATURE_EMOJI[f] + ' ' + f.replace(/_/g, ' ')).join(' · ') || 'None',
        inline: false,
      },
      {
        name: `Only on ${a.name}`,
        value: onlyA.map((f) => f.replace(/_/g, ' ')).join(', ') || '—',
        inline: true,
      },
      {
        name: `Only on ${b.name}`,
        value: onlyB.map((f) => f.replace(/_/g, ' ')).join(', ') || '—',
        inline: true,
      },
    )
    .setFooter({ text: methodFooterText('/compare') })
    .setTimestamp();
}

export function buildMyListEmbed(casinos: Casino[]): EmbedBuilder {
  const lines = casinos.slice(0, 15).map((c, i) =>
    `\`${String(i + 1).padStart(2, ' ')}\` **${c.name}** ⭐ ${c.rating.toFixed(1)} — ${c.url}`,
  );

  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('❤️ My Saved Casinos')
    .setDescription(
      casinos.length
        ? lines.join('\n')
        : 'No saved casinos yet. Use `/favorite` on a casino name, or save from the dashboard.',
    )
    .setFooter({ text: methodFooterText('/mylist') })
    .setTimestamp();
}

export function buildStatsEmbed(stats: {
  totalCasinos: number;
  verifiedCasinos: number;
  pendingReview: number;
  noPhoneCasinos: number;
  emailOnlyCasinos: number;
  withSlots: number;
  withLiveGames: number;
  vpnAllowedCasinos: number;
  vpnBlockedCasinos: number;
  blockedSites: number;
  lastDiscoveryAt: string | null;
  openReports?: number;
  staleCatalogCasinos?: number;
  failedHealthCasinos?: number;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.cyan)
    .setAuthor(brandAuthorBlock())
    .setTitle('📊 The Method Casinos — Stats')
    .addFields(
      { name: '🎰 Total Casinos', value: `${stats.totalCasinos}`, inline: true },
      { name: '✅ Verified', value: `${stats.verifiedCasinos}`, inline: true },
      { name: '⏳ Pending Review', value: `${stats.pendingReview ?? 0}`, inline: true },
      { name: '📋 Open Reports', value: `${stats.openReports ?? 0}`, inline: true },
      { name: '🕐 Stale Catalog', value: `${stats.staleCatalogCasinos ?? 0}`, inline: true },
      { name: '⚠️ Failed Health', value: `${stats.failedHealthCasinos ?? 0}`, inline: true },
      { name: '📵 No Phone', value: `${stats.noPhoneCasinos}`, inline: true },
      { name: '✉️ Email Only', value: `${stats.emailOnlyCasinos}`, inline: true },
      { name: '🎰 With Slots', value: `${stats.withSlots}`, inline: true },
      { name: '🎲 Live Games', value: `${stats.withLiveGames}`, inline: true },
      { name: '🛡️ VPN Allowed', value: `${stats.vpnAllowedCasinos}`, inline: true },
      { name: '🚫 VPN Blocked', value: `${stats.vpnBlockedCasinos}`, inline: true },
      { name: '⛔ Blocked Sites', value: `${stats.blockedSites}`, inline: true },
    )
    .setFooter({ text: methodFooterText() })
    .setTimestamp()
    .setDescription(
      stats.lastDiscoveryAt
        ? `Last discovery scan: <t:${Math.floor(new Date(stats.lastDiscoveryAt).getTime() / 1000)}:R>`
        : 'No discovery scans yet. Use `/discover` to find new casinos.',
    );
}

export function buildDiscoveryEmbed(result: {
  scanned: number;
  found: number;
  added: number;
  skipped: number;
  blocked: number;
  rejected: number;
  sourcesChecked: number;
  durationMs: number;
  errors: string[];
  mode?: 'quick' | 'deep';
  addedCasinos?: { name: string; url: string }[];
}): EmbedBuilder {
  const mins = Math.floor(result.durationMs / 60000);
  const secs = Math.round((result.durationMs % 60000) / 1000);
  const duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  const modeLabel = result.mode === 'deep' ? 'Deep Scan' : 'Quick Scan';

  const embed = new EmbedBuilder()
    .setColor(result.added > 0 ? ACCENT_GREEN : BRAND.cyan)
    .setAuthor(brandAuthorBlock())
    .setTitle(`🔍 ${modeLabel} Complete`)
    .setDescription(
      result.added > 0
        ? `Finished in **${duration}** — **${result.added}** new casino(s) added to the database.`
        : `Finished in **${duration}** — no new casinos passed validation (already known or rejected).`,
    )
    .addFields(
      { name: 'Search Sources', value: `${result.sourcesChecked}`, inline: true },
      { name: 'URLs Scanned', value: `${result.scanned}`, inline: true },
      { name: 'Candidates', value: `${result.found}`, inline: true },
      { name: '✅ Added', value: `${result.added}`, inline: true },
      { name: 'Skipped', value: `${result.skipped}`, inline: true },
      { name: 'Rejected', value: `${result.rejected}`, inline: true },
      { name: 'Blocked', value: `${result.blocked}`, inline: true },
    )
    .setFooter({ text: methodFooterText('Review new entries on the dashboard') })
    .setTimestamp();

  if (result.addedCasinos?.length) {
    const lines = result.addedCasinos.slice(0, 8).map((c) => `• **${c.name}** — ${c.url}`);
    embed.addFields({ name: 'New Casinos', value: truncate(lines.join('\n'), 900) });
  }

  if (result.errors.length) {
    embed.addFields({
      name: '⚠️ Warnings',
      value: truncate(result.errors.slice(0, 5).join('\n'), 500),
    });
  }

  return embed;
}

export function buildDiscoveryProgressEmbed(stats: {
  phase: string;
  scanned: number;
  added: number;
  rejected: number;
  queued: number;
  sourcesChecked: number;
  queryIndex: number;
  queryTotal: number;
  mode: 'quick' | 'deep';
  recentAdded: string[];
}): EmbedBuilder {
  const phaseLabels: Record<string, string> = {
    curated: '📋 Syncing verified catalog',
    search: '🔎 Free web search (DDG · Bing · Brave)',
    analyze: '🔬 Validating sweepstakes pages',
    crawl: '🕸️ Crawling related links',
  };

  return new EmbedBuilder()
    .setColor(BRAND.cyan)
    .setAuthor(brandAuthorBlock())
    .setTitle(stats.mode === 'deep' ? '⚡ Deep Scan Running' : '🔍 Quick Scan Running')
    .setDescription(phaseLabels[stats.phase] ?? stats.phase)
    .addFields(
      { name: 'Added', value: `${stats.added}`, inline: true },
      { name: 'Scanned', value: `${stats.scanned}`, inline: true },
      { name: 'Rejected', value: `${stats.rejected}`, inline: true },
      { name: 'In Queue', value: `${stats.queued}`, inline: true },
      { name: 'Sources', value: `${stats.sourcesChecked}`, inline: true },
      { name: 'Queries', value: `${stats.queryIndex}/${stats.queryTotal}`, inline: true },
    )
    .setFooter({ text: methodFooterText('Live scan in progress…') })
    .setTimestamp();
}

export function buildBlockedEmbed(
  sites: import('../shared/types.js').BlockedSite[],
  query?: string,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setAuthor(brandAuthorBlock())
    .setTitle('⛔ Blocked & Dangerous Sites')
    .setDescription(
      query
        ? `Search: **${query}** — ${sites.length} result(s)`
        : `${sites.length} known scam/phishing/dangerous URLs. Never sign up on these.`,
    )
    .setFooter({ text: methodFooterText('Use /block to add (admin)') })
    .setTimestamp();

  if (!sites.length) {
    embed.addFields({ name: 'Results', value: 'No blocked sites found.' });
    return embed;
  }

  const lines = sites.slice(0, 15).map((s) =>
    `**${s.name}** (${s.severity})\n↳ ${s.url}\n_${s.reason.replace(/_/g, ' ')}_`,
  );

  embed.addFields({ name: 'Blocklist', value: truncate(lines.join('\n\n'), 4000) });
  if (sites.length > 15) {
    embed.addFields({ name: 'More', value: `+${sites.length - 15} more on dashboard` });
  }

  return embed;
}

export function buildUrlCheckEmbed(result: import('../shared/types.js').UrlCheckResult): EmbedBuilder {
  if (result.blocked) {
    return new EmbedBuilder()
      .setColor(0xef4444)
      .setAuthor(brandAuthorBlock())
      .setTitle('⛔ DANGEROUS URL')
      .setDescription(`**Do not visit:** ${result.url}`)
      .addFields(
        result.blockedSite
          ? { name: 'Reason', value: `${result.blockedSite.name}\n${result.blockedSite.reason.replace(/_/g, ' ')} (${result.blockedSite.severity})`, inline: false }
          : { name: 'Status', value: 'On blocklist', inline: false },
      )
      .setFooter({ text: methodFooterText() });
  }

  if (result.casino) {
    const title = result.safe
      ? '✅ Verified Casino'
      : result.pendingReview
        ? '⏳ Pending Review'
        : '⚠️ In Database (Unverified)';
    return new EmbedBuilder()
      .setColor(result.safe ? ACCENT_GREEN : ACCENT_GOLD)
      .setTitle(title)
      .setDescription(`**${result.casino.name}**`)
      .addFields(
        { name: 'Rating', value: `${result.casino.rating.toFixed(1)}/5`, inline: true },
        { name: 'URL', value: result.url, inline: false },
      )
      .setFooter({ text: methodFooterText() });
  }

  return new EmbedBuilder()
    .setColor(ACCENT_GOLD)
    .setTitle('❓ Unknown URL')
    .setDescription(`${result.url}\n\nNot in database or blocklist. Proceed with caution.`)
    .setFooter({ text: methodFooterText('Use /report for suspicious URLs') });
}

export function buildAskEmbed(question: string, answer: string, provider: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🤖 Casino AI')
    .addFields(
      { name: 'Question', value: truncate(question, 500) },
      { name: 'Answer', value: truncate(answer, 3900) },
    )
    .setFooter({ text: methodFooterText(`Powered by ${provider} · verified catalog only`) })
    .setTimestamp();
}

export function buildHelpEmbed(): EmbedBuilder {
  const site = sitePage('/');
  return new EmbedBuilder()
    .setColor(BRAND.copper)
    .setAuthor(brandAuthorBlock())
    .setThumbnail(brandThumbnailUrl())
    .setTitle('🎰 The Method — Command Guide')
    .setDescription(
      `**Verified US sweepstakes casinos** — no phone signup focus, URL safety, and free web discovery.\n\n` +
        `🌐 **Dashboard:** ${site}\n` +
        `Use **/website** for quick links to Similar search, tools, and sign-in.`,
    )
    .addFields(
      {
        name: '🔍 Search & Match',
        value:
          '`/search` — find in catalog\n' +
          '`/similar` — match by features\n' +
          '`/similar search_web:true` — **free web search** for alike casinos\n' +
          '`/compare` · `/casino` · `/random` · `/stats`',
        inline: true,
      },
      {
        name: '🏷️ Filters',
        value:
          '`/nophone` · `/slots` · `/live` · `/vpn`\n' +
          '`/fish` · `/bingo` · `/new` · `/redeem`',
        inline: true,
      },
      {
        name: '🛡️ Safety',
        value:
          '`/check` — URL safety scan\n' +
          '`/blocked` — scam list\n' +
          '`/report` — flag suspicious URL',
        inline: true,
      },
      {
        name: '❤️ Personal',
        value: '`/mylist` · `/favorite`',
        inline: true,
      },
      {
        name: '🌐 Website',
        value: '`/website` · `/tools` · `/legal`',
        inline: true,
      },
      {
        name: '⚙️ Admin',
        value: '`/discover` · `/pending` · `/approve` · `/block`',
        inline: true,
      },
    )
    .setFooter({ text: methodFooterText('100% free · No API keys required') })
    .setTimestamp();
}

export function parseFeatureChoices(values: string[]): CasinoFeature[] {
  const valid: CasinoFeature[] = [
    'no_phone', 'email_only', 'slots', 'live_games',
    'sweepstakes', 'table_games', 'sports', 'crypto', 'instant_play',
    'vpn_allowed', 'vpn_blocked', 'geo_restricted', 'no_kyc', 'fast_payout',
    'daily_bonus', 'referral_bonus', 'low_min_redeem', 'gift_card_redeem',
    'paypal_redeem', 'bank_transfer', 'mobile_app',
    'bingo', 'fish_games', 'poker', 'wheel_spin', 'no_deposit_bonus',
    'venmo_redeem', 'apple_pay', 'us_only', 'new_casino', 'progressive_jackpot',
    'social_features', 'web_only', 'cash_app', 'zelle_redeem', 'scratch_cards',
    'tournaments', 'vip_program', 'android_app', 'ios_app', 'plinko', 'keno',
    'free_spins', 'loyalty_program', 'blackjack', 'roulette', 'crash_games',
    'megaways', 'hold_and_win', 'debit_card_redeem', 'ach_redeem', 'live_chat',
  ];
  return values.filter((v): v is CasinoFeature => valid.includes(v as CasinoFeature));
}

export async function replyWithCasino(
  interaction: ChatInputCommandInteraction,
  casino: Casino,
): Promise<void> {
  const embed = buildCasinoEmbed(casino);
  const rows = buildCasinoButtons(casino);
  await interaction.reply({ embeds: [embed], components: rows });
}

export async function handleCasinoAutocomplete(
  interaction: AutocompleteInteraction,
  casinos: Casino[],
): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const filtered = casinos
    .filter((c) => c.name.toLowerCase().includes(focused))
    .slice(0, 25);

  await interaction.respond(
    filtered.map((c) => ({ name: c.name, value: c.name })),
  );
}
