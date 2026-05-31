import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './command-types.js';
import {
  buildWebsiteEmbed,
  buildWebsiteButtons,
  buildTermsEmbeds,
  buildRulesEmbed,
  buildPrivacyEmbed,
  buildToolsEmbed,
  buildToolsButtons,
} from './legal-embeds.js';

export const siteCommands: Command[] = [
  {
    data: new SlashCommandBuilder()
      .setName('website')
      .setDescription('Open the web dashboard — casinos, tools, discovery, and more'),

    async execute(interaction) {
      await interaction.reply({
        embeds: [buildWebsiteEmbed()],
        components: buildWebsiteButtons(),
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('dashboard')
      .setDescription('Link to the web dashboard and Login with Discord'),

    async execute(interaction) {
      await interaction.reply({
        embeds: [buildWebsiteEmbed()],
        components: buildWebsiteButtons(),
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('terms')
      .setDescription('View Terms of Service summary (full text on the website)'),

    async execute(interaction) {
      await interaction.deferReply();
      const embeds = buildTermsEmbeds();
      await interaction.editReply({ embeds: [embeds[0]] });
      for (let i = 1; i < embeds.length; i++) {
        await interaction.followUp({ embeds: [embeds[i]] });
      }
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('rules')
      .setDescription('View community rules and standards'),

    async execute(interaction) {
      await interaction.reply({ embeds: [buildRulesEmbed()] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('privacy')
      .setDescription('View privacy policy summary'),

    async execute(interaction) {
      await interaction.reply({ embeds: [buildPrivacyEmbed()] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('tools')
      .setDescription('Link to dashboard tools — email, SMS, password, URL checker'),

    async execute(interaction) {
      await interaction.reply({
        embeds: [buildToolsEmbed()],
        components: [buildToolsButtons()],
      });
    },
  },
];
