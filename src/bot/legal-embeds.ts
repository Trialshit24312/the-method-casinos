import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  TERMS_SECTIONS,
  TERMS_FAQ,
  PRIVACY_SECTIONS,
  RULES_CATEGORIES,
  RULES_DO_SUMMARY,
  RULES_DONT_SUMMARY,
  RULES_CONSEQUENCES,
  TOOLS_PATHS,
  LEGAL_LAST_UPDATED,
  LEGAL_VERSION,
} from '../shared/legal.js';
import { getPublicSiteUrl, getDiscordInviteUrl, getDiscordOAuthLoginUrl, methodFooterText, sitePage } from '../shared/site.js';
import { truncate } from '../shared/utils.js';

import { BRAND, brandAuthorBlock, brandThumbnailUrl } from './brand.js';

const LEGAL_GOLD = BRAND.gold;
const PRIVACY_BLUE = 0x0ea5e9;

export function buildWebsiteEmbed(): EmbedBuilder {
  const site = getPublicSiteUrl();
  const login = getDiscordOAuthLoginUrl();
  const invite = getDiscordInviteUrl();

  const embed = new EmbedBuilder()
    .setColor(BRAND.copper)
    .setAuthor(brandAuthorBlock())
    .setThumbnail(brandThumbnailUrl())
    .setTitle('🌐 The Method — Web Dashboard')
    .setDescription(
      `**Verified sweepstakes catalog** with similar-casino search, URL checker, signup tools, and admin discovery.\n\n` +
        `🔗 **Open:** ${site}`,
    )
    .addFields(
      {
        name: '✨ Featured',
        value:
          `• **Similar Casinos** — ${sitePage('/similar')}\n` +
          `• **URL Checker** — ${sitePage('/tools/checker')}\n` +
          `• **Casino Catalog** — ${sitePage('/casinos')}`,
        inline: true,
      },
      {
        name: '🛠️ Tools & Safety',
        value:
          `• **Tools Hub** — ${sitePage('/tools')}\n` +
          `• **Blocklist** — ${sitePage('/blocked')}\n` +
          `• **Guides** — ${sitePage('/guides')}`,
        inline: true,
      },
      {
        name: '🔐 Admin sign-in',
        value:
          `Dashboard uses **Login with Discord** (OAuth).\n` +
          `[Sign in →](${login})`,
        inline: false,
      },
    )
    .setFooter({ text: methodFooterText('/website') })
    .setTimestamp();

  if (invite) {
    embed.addFields({
      name: 'Join our Discord',
      value: invite,
      inline: false,
    });
  }

  return embed;
}

export function buildWebsiteButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const site = getPublicSiteUrl();
  const rows: ActionRowBuilder<ButtonBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('Open Site').setStyle(ButtonStyle.Link).setURL(site).setEmoji('🔗'),
      new ButtonBuilder()
        .setLabel('Similar Casinos')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/similar'))
        .setEmoji('✨'),
      new ButtonBuilder()
        .setLabel('URL Checker')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/tools/checker'))
        .setEmoji('🛡️'),
      new ButtonBuilder()
        .setLabel('Browse Catalog')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/casinos'))
        .setEmoji('🎰'),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Tools Hub')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/tools'))
        .setEmoji('🛠️'),
      new ButtonBuilder()
        .setLabel('Blocklist')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/blocked'))
        .setEmoji('⛔'),
      new ButtonBuilder()
        .setLabel('Legal Hub')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/legal'))
        .setEmoji('⚖️'),
    ),
  ];

  const invite = getDiscordInviteUrl();
  if (invite) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel('Join Discord Server').setStyle(ButtonStyle.Link).setURL(invite),
      ),
    );
  }

  return rows;
}

export function buildLegalButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('Terms').setStyle(ButtonStyle.Link).setURL(sitePage('/terms')).setEmoji('📜'),
      new ButtonBuilder().setLabel('Rules').setStyle(ButtonStyle.Link).setURL(sitePage('/rules')).setEmoji('🛡️'),
      new ButtonBuilder().setLabel('Privacy').setStyle(ButtonStyle.Link).setURL(sitePage('/privacy')).setEmoji('🔒'),
      new ButtonBuilder().setLabel('Legal Hub').setStyle(ButtonStyle.Link).setURL(sitePage('/legal')).setEmoji('⚖️'),
    ),
  ];
  const invite = getDiscordInviteUrl();
  if (invite) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel('Open Dashboard').setStyle(ButtonStyle.Link).setURL(getPublicSiteUrl()),
      ),
    );
  }
  return rows;
}

export function buildLegalHubEmbed(): EmbedBuilder {
  const hub = sitePage('/legal');
  const termsPreview = TERMS_SECTIONS.slice(0, 2).map((s) => `• **${s.title}** — ${truncate(s.body, 80)}`).join('\n');
  const rulesPreview = RULES_DO_SUMMARY.slice(0, 3).map((s) => `• ${s}`).join('\n');
  const privacyPreview = PRIVACY_SECTIONS.slice(0, 2).map((s) => `• **${s.title}**`).join('\n');

  return new EmbedBuilder()
    .setColor(LEGAL_GOLD)
    .setTitle('⚖️ The Method — Legal & Policies')
    .setDescription(
      `Official policies for the Discord bot, web dashboard, and casino catalog.\n` +
        `**Version ${LEGAL_VERSION}** · Updated ${LEGAL_LAST_UPDATED}\n\n` +
        `**Full hub:** ${hub}`,
    )
    .addFields(
      { name: '📜 Terms of Service', value: truncate(termsPreview, 1024), inline: false },
      { name: '🛡️ Community Rules', value: truncate(rulesPreview, 1024), inline: false },
      { name: '🔒 Privacy Policy', value: truncate(privacyPreview, 1024), inline: false },
      {
        name: 'Quick commands',
        value: '`/legal terms` · `/legal rules` · `/legal privacy` · `/legal all`',
        inline: false,
      },
      {
        name: 'Disclaimer',
        value: truncate(
          'The Method provides research tools and a user-maintained catalog — not gambling advice, legal counsel, or guarantees about third-party casinos. Always verify URLs with `/check`.',
          1024,
        ),
        inline: false,
      },
    )
    .setFooter({ text: methodFooterText('/legal') })
    .setTimestamp();
}

export function buildTermsEmbeds(): EmbedBuilder[] {
  const fullUrl = sitePage('/terms');
  const embeds: EmbedBuilder[] = [];

  const part1 = new EmbedBuilder()
    .setColor(LEGAL_GOLD)
    .setTitle('📜 Terms of Service (1/2)')
    .setDescription(
      `**The Method Casinos** — v${LEGAL_VERSION} — Updated ${LEGAL_LAST_UPDATED}\n\n` +
        `Read the full document: ${fullUrl}`,
    )
    .addFields(
      TERMS_SECTIONS.slice(0, 5).map((s) => ({
        name: s.title,
        value: truncate(`${s.body}\n• ${s.bullets.slice(0, 2).join('\n• ')}`, 1024),
        inline: false,
      })),
    )
    .setFooter({ text: methodFooterText('/terms') });

  const part2 = new EmbedBuilder()
    .setColor(LEGAL_GOLD)
    .setTitle('📜 Terms of Service (2/2)')
    .addFields(
      TERMS_SECTIONS.slice(5).map((s) => ({
        name: s.title,
        value: truncate(`${s.body}\n• ${s.bullets.slice(0, 2).join('\n• ')}`, 1024),
        inline: false,
      })),
    )
    .setFooter({ text: `Full terms: ${fullUrl}` });

  embeds.push(part1, part2);

  const faqText = TERMS_FAQ.slice(0, 4)
    .map((f) => `**${f.q}**\n${f.a}`)
    .join('\n\n');

  embeds.push(
    new EmbedBuilder()
      .setColor(LEGAL_GOLD)
      .setTitle('📜 Terms — FAQ')
      .setDescription(truncate(faqText, 4000))
      .setFooter({ text: methodFooterText() }),
  );

  return embeds;
}

export function buildRulesEmbed(): EmbedBuilder {
  const fullUrl = sitePage('/rules');
  const highlights = RULES_CATEGORIES.flatMap((c) =>
    c.rules.map((r) => `**${r.title}** — ${truncate(r.body, 120)}`),
  ).slice(0, 6);

  return new EmbedBuilder()
    .setColor(BRAND.copper)
    .setAuthor(brandAuthorBlock())
    .setTitle('🛡️ Community Rules')
    .setDescription(
      `**The Method Standard** — keep the database accurate and the community trustworthy.\n\n` +
        `Full rules: ${fullUrl}`,
    )
    .addFields(
      {
        name: '✅ Do',
        value: RULES_DO_SUMMARY.map((s) => `• ${s}`).join('\n'),
        inline: true,
      },
      {
        name: '❌ Never',
        value: RULES_DONT_SUMMARY.map((s) => `• ${s}`).join('\n'),
        inline: true,
      },
      {
        name: 'Key rules',
        value: truncate(highlights.join('\n\n'), 1024),
        inline: false,
      },
      {
        name: 'Enforcement',
        value: RULES_CONSEQUENCES.map((c) => `**${c.level}** — ${c.desc}`).join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: methodFooterText('/rules') })
    .setTimestamp();
}

export function buildPrivacyEmbed(): EmbedBuilder {
  const fullUrl = sitePage('/privacy');

  return new EmbedBuilder()
    .setColor(PRIVACY_BLUE)
    .setTitle('🔒 Privacy Policy')
    .setDescription(
      `How The Method handles your data. Updated ${LEGAL_LAST_UPDATED}.\n\n` +
        `**Full policy:** ${fullUrl}`,
    )
    .addFields(
      PRIVACY_SECTIONS.map((s) => ({
        name: s.title,
        value: truncate(`${s.body}\n• ${s.bullets.join('\n• ')}`, 1024),
        inline: false,
      })),
    )
    .setFooter({ text: methodFooterText('/privacy') })
    .setTimestamp();
}

export function buildToolsEmbed(): EmbedBuilder {
  const hub = sitePage('/tools');
  const lines = TOOLS_PATHS.map((t) => `• **${t.name}** — ${sitePage(t.path)}`);

  return new EmbedBuilder()
    .setColor(BRAND.cyan)
    .setAuthor(brandAuthorBlock())
    .setTitle('🛠️ Tools Hub')
    .setDescription(
      `Signup research tools on the dashboard — temp-mail lists, SMS receivers, password gen, URL checker.\n\n` +
        `**Open hub:** ${hub}`,
    )
    .addFields(
      { name: 'Pages', value: truncate(lines.join('\n'), 1024), inline: false },
      {
        name: 'Discord shortcuts',
        value:
          '• `/check` — safety check a casino URL\n' +
          '• `/similar` — find casinos like one you like (catalog + free web search)\n' +
          '• `/blocked` — view scam/phishing list\n' +
          '• `/search` — find casinos in the database',
        inline: false,
      },
    )
    .setFooter({ text: methodFooterText('/tools') })
    .setTimestamp();
}

export function buildToolsButtons(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Tools Hub')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/tools')),
      new ButtonBuilder()
        .setLabel('URL Checker')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/tools/checker')),
      new ButtonBuilder()
        .setLabel('Similar Search')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/similar')),
      new ButtonBuilder()
        .setLabel('Email Tools')
        .setStyle(ButtonStyle.Link)
        .setURL(sitePage('/tools/email')),
    ),
  ];
}
