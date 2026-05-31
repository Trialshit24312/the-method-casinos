import {
  SlashCommandBuilder,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js';
import type { Command } from './command-types.js';
export type { Command } from './command-types.js';
import { searchCasinos, getRandomCasino, getStats, getAllCasinos, getCasinoById, searchBlockedSites, addBlockedSite, getCasinoByUrl, getBlockedSiteByUrl, isUrlBlocked, findSimilarCasinosByQuery } from '../database/index.js';
import { runDiscovery } from '../discovery/engine.js';
import {
  buildCasinoEmbed,
  buildCasinoButtons,
  buildListEmbed,
  buildStatsEmbed,
  buildDiscoveryEmbed,
  buildHelpEmbed,
  buildBlockedEmbed,
  buildSimilarEmbed,
  buildUrlCheckEmbed,
  parseFeatureChoices,
  handleCasinoAutocomplete,
  replyWithCasino,
} from './embeds.js';
import type { CasinoFeature } from '../shared/types.js';
import { parseAdminIds, ensureHttps } from '../shared/utils.js';
import { siteCommands } from './site-commands.js';

function isAdmin(userId: string): boolean {
  const admins = parseAdminIds(process.env.ADMIN_DISCORD_IDS);
  return admins.has(userId);
}

export const commands: Command[] = [
  {
    data: new SlashCommandBuilder()
      .setName('search')
      .setDescription('Search sweepstakes casinos by name or features')
      .addStringOption((o) =>
        o.setName('query').setDescription('Search by casino name').setRequired(false),
      )
      .addBooleanOption((o) =>
        o.setName('no_phone').setDescription('Only show casinos without phone requirement').setRequired(false),
      )
      .addBooleanOption((o) =>
        o.setName('email_only').setDescription('Only email + password signup').setRequired(false),
      )
      .addBooleanOption((o) =>
        o.setName('verified').setDescription('Only verified casinos').setRequired(false),
      )
      .addStringOption((o) =>
        o.setName('feature')
          .setDescription('Filter by feature')
          .setRequired(false)
          .addChoices(
            { name: 'Slots', value: 'slots' },
            { name: 'Live Games', value: 'live_games' },
            { name: 'Sweepstakes', value: 'sweepstakes' },
            { name: 'Table Games', value: 'table_games' },
            { name: 'Sports', value: 'sports' },
            { name: 'Crypto', value: 'crypto' },
            { name: 'Instant Play', value: 'instant_play' },
            { name: 'VPN Allowed', value: 'vpn_allowed' },
            { name: 'VPN Blocked', value: 'vpn_blocked' },
            { name: 'Geo Restricted', value: 'geo_restricted' },
            { name: 'Fish Games', value: 'fish_games' },
            { name: 'Poker', value: 'poker' },
            { name: 'Bingo', value: 'bingo' },
            { name: 'No Deposit Bonus', value: 'no_deposit_bonus' },
            { name: 'New Casino', value: 'new_casino' },
            { name: 'Progressive Jackpot', value: 'progressive_jackpot' },
          ),
      ),

    async execute(interaction) {
      await interaction.deferReply();

      const query = interaction.options.getString('query') ?? undefined;
      const noPhone = interaction.options.getBoolean('no_phone') ?? false;
      const emailOnly = interaction.options.getBoolean('email_only') ?? false;
      const verifiedOnly = interaction.options.getBoolean('verified') ?? false;
      const feature = interaction.options.getString('feature');

      const results = searchCasinos({
        query,
        noPhone: noPhone || undefined,
        emailOnly: emailOnly || undefined,
        verifiedOnly: verifiedOnly || undefined,
        features: feature ? parseFeatureChoices([feature]) : undefined,
        limit: 25,
      });

      const filters: string[] = [];
      if (query) filters.push(`query: "${query}"`);
      if (noPhone) filters.push('no phone');
      if (emailOnly) filters.push('email only');
      if (verifiedOnly) filters.push('verified');
      if (feature) filters.push(feature.replace('_', ' '));

      const embed = buildListEmbed(
        results,
        'Search Results',
        filters.length ? `Filters: ${filters.join(', ')}` : 'Showing all matching casinos',
      );

      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('random')
      .setDescription('Get a random sweepstakes casino')
      .addBooleanOption((o) =>
        o.setName('no_phone').setDescription('No phone required').setRequired(false),
      )
      .addBooleanOption((o) =>
        o.setName('slots').setDescription('Must have slots').setRequired(false),
      )
      .addBooleanOption((o) =>
        o.setName('live').setDescription('Must have live games').setRequired(false),
      )
      .addBooleanOption((o) =>
        o.setName('vpn').setDescription('Must allow VPN').setRequired(false),
      ),

    async execute(interaction) {
      const noPhone = interaction.options.getBoolean('no_phone') ?? false;
      const slots = interaction.options.getBoolean('slots') ?? false;
      const live = interaction.options.getBoolean('live') ?? false;
      const vpn = interaction.options.getBoolean('vpn') ?? false;

      const features: CasinoFeature[] = [];
      if (slots) features.push('slots');
      if (live) features.push('live_games');

      const casino = getRandomCasino({
        noPhone: noPhone || undefined,
        vpnAllowed: vpn || undefined,
        features: features.length ? features : undefined,
      });

      if (!casino) {
        await interaction.reply({ content: '❌ No casinos match those filters.', ephemeral: true });
        return;
      }

      await replyWithCasino(interaction, casino);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('casino')
      .setDescription('Look up a specific casino')
      .addStringOption((o) =>
        o.setName('name').setDescription('Casino name').setRequired(true).setAutocomplete(true),
      ),

    async execute(interaction) {
      const name = interaction.options.getString('name', true);
      const results = searchCasinos({ query: name, limit: 1 });

      if (!results.length) {
        await interaction.reply({ content: `❌ No casino found matching "${name}".`, ephemeral: true });
        return;
      }

      await replyWithCasino(interaction, results[0]);
    },

    async autocomplete(interaction) {
      await handleCasinoAutocomplete(interaction, getAllCasinos());
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('similar')
      .setDescription('Find casinos similar to one you like — matched by features & signup')
      .addStringOption((o) =>
        o.setName('name').setDescription('Casino name to match against').setRequired(true).setAutocomplete(true),
      ),

    async execute(interaction) {
      await interaction.deferReply();
      const name = interaction.options.getString('name', true);
      const result = findSimilarCasinosByQuery(name, 10);

      if (!result) {
        await interaction.editReply({ content: `❌ No casino found matching "${name}".` });
        return;
      }

      await interaction.editReply({
        embeds: [buildSimilarEmbed(result.source, result.matches)],
      });
    },

    async autocomplete(interaction) {
      await handleCasinoAutocomplete(interaction, getAllCasinos());
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('nophone')
      .setDescription('List casinos that do NOT require a phone number'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ noPhone: true, limit: 25 });
      const embed = buildListEmbed(
        results,
        'No Phone Required',
        'These casinos let you sign up with just email + password 📵',
      );
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('slots')
      .setDescription('List sweepstakes casinos with slot games'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ features: ['slots'], limit: 25 });
      const embed = buildListEmbed(results, 'Slot Casinos', 'Casinos with slot games 🎰');
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('live')
      .setDescription('List casinos with live dealer games'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ features: ['live_games'], limit: 25 });
      const embed = buildListEmbed(results, 'Live Dealer Casinos', 'Casinos with live games 🎲');
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('vpn')
      .setDescription('List casinos that allow VPN usage'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ vpnAllowed: true, limit: 25 });
      const embed = buildListEmbed(
        results,
        'VPN Friendly Casinos',
        'These casinos allow or work with VPN 🛡️',
      );
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('stats')
      .setDescription('View The Method Casinos database stats'),

    async execute(interaction) {
      const stats = getStats();
      await interaction.reply({ embeds: [buildStatsEmbed(stats)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('discover')
      .setDescription('Scan for NEW casinos only (admin — ~2 min quick, ~10 min deep)')
      .addBooleanOption((o) =>
        o.setName('deep').setDescription('Deep scan — runs ~10 minutes, finds more new sites').setRequired(false),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }

      await interaction.deferReply();
      const deep = interaction.options.getBoolean('deep') ?? false;

      await interaction.editReply({
        content: deep
          ? '🔍 Deep scan started — searching the web for **new** casinos (~10 min)...'
          : '🔍 Quick scan started — searching for **new** casinos (~2 min)...',
      });

      const result = await runDiscovery(deep);
      await interaction.editReply({ embeds: [buildDiscoveryEmbed(result)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('fish')
      .setDescription('List casinos with fish games'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ features: ['fish_games'], limit: 25 });
      const embed = buildListEmbed(results, 'Fish Game Casinos', 'Casinos with fish shooting games 🐟');
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('bingo')
      .setDescription('List casinos with bingo games'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ features: ['bingo'], limit: 25 });
      const embed = buildListEmbed(results, 'Bingo Casinos', 'Casinos with bingo 🎯');
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('new')
      .setDescription('List newly tagged sweepstakes casinos'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ features: ['new_casino'], limit: 25 });
      const embed = buildListEmbed(results, 'New Casinos', 'Recently discovered or new casinos ✨');
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('check')
      .setDescription('Check if a casino URL is safe, blocked, or in the database')
      .addStringOption((o) =>
        o.setName('url').setDescription('Casino URL to check').setRequired(true),
      ),

    async execute(interaction) {
      const raw = interaction.options.getString('url', true);
      const url = ensureHttps(raw);
      const blockedSite = getBlockedSiteByUrl(url);
      const casino = getCasinoByUrl(url);
      const blocked = Boolean(blockedSite) || isUrlBlocked(url);
      await interaction.reply({
        embeds: [buildUrlCheckEmbed({ url, blocked, blockedSite, casino, safe: !blocked && Boolean(casino?.verified) })],
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('redeem')
      .setDescription('List casinos with fast payout or low min redeem')
      .addStringOption((o) =>
        o.setName('type').setDescription('Redeem filter').setRequired(false)
          .addChoices(
            { name: 'Fast Payout', value: 'fast_payout' },
            { name: 'Low Min Redeem', value: 'low_min_redeem' },
            { name: 'PayPal', value: 'paypal_redeem' },
            { name: 'Gift Card', value: 'gift_card_redeem' },
            { name: 'Cash App', value: 'cash_app' },
            { name: 'Venmo', value: 'venmo_redeem' },
          ),
      ),

    async execute(interaction) {
      await interaction.deferReply();
      const type = interaction.options.getString('type') as CasinoFeature | null;
      const features: CasinoFeature[] = type ? [type] : ['fast_payout', 'low_min_redeem'];
      const results = searchCasinos({ features, limit: 25 });
      const embed = buildListEmbed(
        results,
        'Redeem-Friendly Casinos',
        type ? `Filtered by ${type.replace(/_/g, ' ')}` : 'Fast payout & low min redeem options',
      );
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('blocked')
      .setDescription('View blocked scam, phishing, and dangerous casino sites')
      .addStringOption((o) =>
        o.setName('search').setDescription('Search blocked sites').setRequired(false),
      ),

    async execute(interaction) {
      await interaction.deferReply();
      const query = interaction.options.getString('search') ?? undefined;
      const sites = searchBlockedSites(query);
      await interaction.editReply({ embeds: [buildBlockedEmbed(sites, query)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('block')
      .setDescription('Block a dangerous/scam site (admin)')
      .addStringOption((o) =>
        o.setName('url').setDescription('URL to block').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('name').setDescription('Site name').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('reason').setDescription('Block reason').setRequired(false)
          .addChoices(
            { name: 'Scam', value: 'scam' },
            { name: 'Phishing', value: 'phishing' },
            { name: 'Malware', value: 'malware' },
            { name: 'Fake Casino', value: 'fake_casino' },
            { name: 'No Payout', value: 'no_payout' },
            { name: 'Clone Site', value: 'clone_site' },
            { name: 'Deposit Fraud', value: 'deposit_fraud' },
          ),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }

      const url = interaction.options.getString('url', true);
      const name = interaction.options.getString('name', true);
      const reason = (interaction.options.getString('reason') ?? 'scam') as import('../shared/types.js').BlockReason;

      const site = addBlockedSite({
        name,
        url,
        reason,
        severity: 'high',
        reportedBy: interaction.user.username,
        removeCasino: true,
      });

      if (!site) {
        await interaction.reply({ content: '❌ Site already blocked or invalid URL.', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `🚫 **${site.name}** blocked — \`${site.url}\`\nReason: ${reason.replace('_', ' ')}`,
        ephemeral: false,
      });
    },
  },

  ...siteCommands,

  {
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show all The Method Casinos commands'),

    async execute(interaction) {
      await interaction.reply({ embeds: [buildHelpEmbed()] });
    },
  },
];

export async function registerSlashCommands(clientId: string, token: string): Promise<void> {
  const rest = new REST().setToken(token);
  const body = commands.map((c) => c.data.toJSON());
  const guildId = process.env.DISCORD_GUILD_ID;

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`✅ Registered ${body.length} slash commands in guild`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(`✅ Registered ${body.length} slash commands globally`);
  }
}

export function setupCommandHandler(client: Client): void {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isAutocomplete()) {
      const command = commands.find((c) => c.data.name === interaction.commandName);
      if (command?.autocomplete) {
        await command.autocomplete(interaction);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.find((c) => c.data.name === interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Command ${interaction.commandName} failed:`, err);
      const msg = { content: '❌ Something went wrong running that command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('share:')) return;

    const casinoId = interaction.customId.split(':')[1];
    const casino = getCasinoById(casinoId);

    if (casino) {
      await interaction.reply({
        content: `🎰 **${casino.name}** — ${casino.url}`,
        ephemeral: false,
      });
    }
  });
}
