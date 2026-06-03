import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from './command-types.js';
import { getFeaturedCasinos, getRecentCasinos, getStats } from '../database/index.js';
import { buildAboutEmbed, buildFeaturedEmbed, buildRecentEmbed } from './embeds.js';
import { brandButtonRow } from './brand.js';
import { getPublicSiteUrl } from '../shared/site.js';

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
      .setDescription('Recently added casinos (newest first)'),

    async execute(interaction) {
      const casinos = getRecentCasinos(12);
      await interaction.reply({ embeds: [buildRecentEmbed(casinos)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Bot latency and service status'),

    async execute(interaction) {
      const stats = getStats();
      const latency = Date.now() - interaction.createdTimestamp;
      await interaction.reply({
        content: [
          `🏓 **Pong** — ${latency}ms`,
          `📊 ${stats.verifiedCasinos} verified · ${stats.totalCasinos} total · ${stats.blockedSites} blocked`,
          `🌐 ${getPublicSiteUrl()}`,
        ].join('\n'),
      });
    },
  },
];
