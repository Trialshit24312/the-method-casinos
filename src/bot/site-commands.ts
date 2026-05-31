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
  buildLegalHubEmbed,
  buildLegalButtons,
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
      .setName('legal')
      .setDescription('View all legal policies — terms, rules, privacy, and disclaimers')
      .addStringOption((o) =>
        o.setName('topic')
          .setDescription('Which document to show')
          .setRequired(false)
          .addChoices(
            { name: 'Overview (all policies)', value: 'all' },
            { name: 'Terms of Service', value: 'terms' },
            { name: 'Community Rules', value: 'rules' },
            { name: 'Privacy Policy', value: 'privacy' },
          ),
      ),

    async execute(interaction) {
      const topic = interaction.options.getString('topic') ?? 'all';

      if (topic === 'terms') {
        await interaction.deferReply();
        const embeds = buildTermsEmbeds();
        await interaction.editReply({ embeds: [embeds[0]], components: buildLegalButtons() });
        for (let i = 1; i < embeds.length; i++) {
          await interaction.followUp({ embeds: [embeds[i]] });
        }
        return;
      }

      if (topic === 'rules') {
        await interaction.reply({ embeds: [buildRulesEmbed()], components: buildLegalButtons() });
        return;
      }

      if (topic === 'privacy') {
        await interaction.reply({ embeds: [buildPrivacyEmbed()], components: buildLegalButtons() });
        return;
      }

      await interaction.reply({
        embeds: [buildLegalHubEmbed()],
        components: buildLegalButtons(),
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
