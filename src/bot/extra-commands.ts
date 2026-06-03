import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { Command } from './command-types.js';
import { getFeaturedCasinos, getRecentCasinos, getStats, getPublicFeed } from '../database/index.js';
import { getBotHealth } from '../bot/state.js';
import { buildAboutEmbed, buildFeaturedEmbed, buildRecentEmbed, buildStatusEmbed, buildTiersEmbed } from './embeds.js';
import { brandButtonRow } from './brand.js';
import { getPublicSiteUrl, sitePage } from '../shared/site.js';
import { isDiscordLiveFeedEnabled } from '../shared/discord-live-feed.js';

function linkRow(): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const btn of brandButtonRow().slice(0, 4)) {
    row.addComponents(
      new ButtonBuilder().setLabel(btn.label).setStyle(ButtonStyle.Link).setURL(btn.url).setEmoji(btn.emoji),
    );
  }
  return row;
}

export const extraCommands: Command[] = [
  {
    data: new SlashCommandBuilder()
      .setName('about')
      .setDescription('What is The Method Casinos — brand, stats, and links'),

    async execute(interaction) {
      await interaction.reply({
        embeds: [buildAboutEmbed()],
        components: [linkRow()],
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('featured')
      .setDescription('Top-rated verified casinos in the catalog'),

    async execute(interaction) {
      const casinos = getFeaturedCasinos(12);
      await interaction.reply({ embeds: [buildFeaturedEmbed(casinos)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('recent')
      .setDescription('Newest catalog rows by created date (not the same as /new approvals)'),

    async execute(interaction) {
      const casinos = getRecentCasinos(12);
      await interaction.reply({ embeds: [buildRecentEmbed(casinos)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('tiers')
      .setDescription('Preview membership tiers — Scout, Operator, Strategist, Architect')
      .addStringOption((option) =>
        option
          .setName('plan')
          .setDescription('Show one tier in detail (optional)')
          .addChoices(
            { name: 'Scout — $7/mo', value: 'scout' },
            { name: 'Operator — $15/mo', value: 'operator' },
            { name: 'Strategist — $29/mo', value: 'strategist' },
            { name: 'Architect — $59/mo', value: 'architect' },
          ),
      ),

    async execute(interaction) {
      const plan = interaction.options.getString('plan') ?? undefined;
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('View on website')
          .setStyle(ButtonStyle.Link)
          .setURL(sitePage('/pricing'))
          .setEmoji('👑'),
      );
      await interaction.reply({
        embeds: [buildTiersEmbed(plan ?? undefined)],
        components: [row],
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('activity')
      .setDescription('Recent catalog approvals and discovery scans'),

    async execute(interaction) {
      const feed = getPublicFeed(8);
      if (!feed.length) {
        await interaction.reply({ content: 'No recent activity logged yet.', ephemeral: true });
        return;
      }
      const lines = feed.map((item) => {
        const when = `<t:${Math.floor(new Date(item.at).getTime() / 1000)}:R>`;
        const icon = item.type === 'approval' ? '✅' : '🔍';
        return `${icon} **${item.title}** — ${item.detail} (${when})`;
      });
      const feedHint = isDiscordLiveFeedEnabled()
        ? (process.env.DISCORD_FEED_CHANNEL_ID
          ? '\n\nLive discovery stream is posting in your configured **feed channel**.'
          : '\n\nLive discovery stream is posting via **DISCORD_LIVE_FEED_WEBHOOK_URL**.')
        : '\n\nSet **DISCORD_LIVE_FEED=1** and **DISCORD_LIVE_FEED_WEBHOOK_URL** on Render to mirror the dashboard live log.';
      await interaction.reply({
        content: `**Recent activity**\n${lines.join('\n')}\n\nDashboard feed → ${sitePage('/dashboard')}${feedHint}`,
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('status')
      .setDescription('Service health — bot, catalog, and API uptime'),

    async execute(interaction) {
      const stats = getStats();
      const bot = getBotHealth();
      await interaction.reply({
        embeds: [buildStatusEmbed({
          botConnected: bot.connected,
          botTag: bot.tag,
          verifiedCasinos: stats.verifiedCasinos,
          totalCasinos: stats.totalCasinos,
          pendingReview: stats.pendingReview,
          blockedSites: stats.blockedSites,
          uptimeSec: process.uptime(),
        })],
        components: [linkRow()],
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('guides')
      .setDescription('The Method signup and safety guides on the dashboard'),

    async execute(interaction) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Open Guides')
          .setStyle(ButtonStyle.Link)
          .setURL(sitePage('/guides'))
          .setEmoji('📖'),
        new ButtonBuilder()
          .setLabel('URL Checker')
          .setStyle(ButtonStyle.Link)
          .setURL(sitePage('/tools/checker'))
          .setEmoji('🛡️'),
      );
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('📖 The Method Guides')
        .setDescription(
          [
            'Step-by-step workflows on the dashboard:',
            '• Safe signup & email-only casinos',
            '• VPN / geo notes for sweepstakes sites',
            '• Redeem and cash-out checklists',
            '',
            `**Open:** ${sitePage('/guides')}`,
          ].join('\n'),
        );
      await interaction.reply({ embeds: [embed], components: [row] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Quick bot latency check'),

    async execute(interaction) {
      const latency = Date.now() - interaction.createdTimestamp;
      const bot = getBotHealth();
      await interaction.reply({
        content: `🏓 **Pong** — ${latency}ms · Bot ${bot.connected ? 'online' : 'offline'} · Use \`/status\` for full health`,
      });
    },
  },
];
