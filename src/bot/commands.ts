import {
  SlashCommandBuilder,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js';
import type { Command } from './command-types.js';
export type { Command } from './command-types.js';
import {
  searchCasinos,
  getRandomCasino,
  getStats,
  getAllCasinos,
  getCasinoById,
  searchBlockedSites,
  addBlockedSite,
  getCasinoByUrl,
  getBlockedSiteByUrl,
  isUrlBlocked,
  findSimilarCasinosByQuery,
  getPendingCasinos,
  addSiteReport,
  approveCasino,
  rejectCasino,
  getOpenSiteReports,
  dismissSiteReport,
  getUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  setUserFavoriteNote,
  getRecentlyApprovedCasinos,
  getAdminInsights,
  approveAllPendingCasinos,
  unlistCasino,
  getKnownHosts,
  markSiteReportReviewed,
  getClosedSiteReports,
} from '../database/index.js';
import { saveDiscoveryCandidateForReview } from '../discovery/engine.js';
import { revalidateCasinoById } from '../discovery/revalidate.js';
import { runDiscovery } from '../discovery/engine.js';
import {
  buildCasinoEmbed,
  buildCasinoButtons,
  buildListEmbed,
  buildStatsEmbed,
  buildDiscoveryEmbed,
  buildDiscoveryProgressEmbed,
  buildHelpEmbed,
  buildBlockedEmbed,
  buildSimilarEmbed,
  buildSimilarButtons,
  buildCompareEmbed,
  buildMyListEmbed,
  buildArrivalsEmbed,
  buildInsightsEmbed,
  buildReportsEmbed,
  buildUrlCheckEmbed,
  parseFeatureChoices,
  handleCasinoAutocomplete,
  replyWithCasino,
} from './embeds.js';
import type { CasinoFeature } from '../shared/types.js';
import { parseAdminIds, ensureHttps } from '../shared/utils.js';
import { notifySiteReport, notifyCasinoApproved } from '../shared/notify.js';
import { checkCasinoUrl } from '../shared/url-check.js';
import { siteCommands } from './site-commands.js';
import { extraCommands } from './extra-commands.js';
import { BRAND_MOTTO } from './brand.js';

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
        o.setName('verified').setDescription('Only verified catalog casinos (default: yes)').setRequired(false),
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
      const catalogOnly = interaction.options.getBoolean('verified') ?? true;
      const feature = interaction.options.getString('feature');

      const results = searchCasinos({
        query,
        noPhone: noPhone || undefined,
        emailOnly: emailOnly || undefined,
        catalogOnly,
        features: feature ? parseFeatureChoices([feature]) : undefined,
        limit: 25,
      });

      const filters: string[] = [];
      if (query) filters.push(`query: "${query}"`);
      if (noPhone) filters.push('no phone');
      if (emailOnly) filters.push('email only');
      if (catalogOnly) filters.push('verified catalog');
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
        catalogOnly: true,
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
      const results = searchCasinos({ query: name, catalogOnly: true, limit: 1 });

      if (!results.length) {
        await interaction.reply({ content: `❌ No casino found matching "${name}".`, ephemeral: true });
        return;
      }

      await replyWithCasino(interaction, results[0]);
    },

    async autocomplete(interaction) {
      await handleCasinoAutocomplete(interaction, getAllCasinos(true));
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('similar')
      .setDescription('Find casinos similar to one you like — catalog match or free web search')
      .addStringOption((o) =>
        o.setName('name').setDescription('Casino name to match against').setRequired(true).setAutocomplete(true),
      )
      .addBooleanOption((o) =>
        o.setName('search_web').setDescription('Search the internet for new casinos like this one (free)').setRequired(false),
      ),

    async execute(interaction) {
      await interaction.deferReply();
      const name = interaction.options.getString('name', true);
      const searchWeb = interaction.options.getBoolean('search_web') ?? false;
      const result = findSimilarCasinosByQuery(name, 10);

      if (!result) {
        await interaction.editReply({ content: `❌ No casino found matching "${name}".` });
        return;
      }

      if (searchWeb) {
        const { discoverSimilarOnWeb } = await import('../discovery/similar-search.js');
        const web = await discoverSimilarOnWeb(result.source.id);
        if (web) {
          const lines = web.candidates.slice(0, 8).map((c) =>
            c.status === 'added' ? `✅ **${c.name}** — queued for review` : `– ${c.name} (${c.reason ?? c.status})`,
          );
          await interaction.editReply({
            embeds: [buildSimilarEmbed(result.source, web.catalogMatches.length ? web.catalogMatches : result.matches)],
            components: buildSimilarButtons(result.source),
            content: [
              `🌐 **Web search** (${web.webUrlsFound} URLs · ${web.added} added to review queue)`,
              lines.length ? lines.join('\n') : 'No new operators found this time.',
            ].join('\n'),
          });
          return;
        }
      }

      await interaction.editReply({
        embeds: [buildSimilarEmbed(result.source, result.matches)],
        components: buildSimilarButtons(result.source),
      });
    },

    async autocomplete(interaction) {
      await handleCasinoAutocomplete(interaction, getAllCasinos(true));
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('compare')
      .setDescription('Compare two casinos side-by-side')
      .addStringOption((o) =>
        o.setName('casino_a').setDescription('First casino').setRequired(true).setAutocomplete(true),
      )
      .addStringOption((o) =>
        o.setName('casino_b').setDescription('Second casino').setRequired(true).setAutocomplete(true),
      ),

    async execute(interaction) {
      await interaction.deferReply();
      const nameA = interaction.options.getString('casino_a', true);
      const nameB = interaction.options.getString('casino_b', true);
      const resultA = findSimilarCasinosByQuery(nameA, 1);
      const resultB = findSimilarCasinosByQuery(nameB, 1);

      if (!resultA || !resultB) {
        await interaction.editReply({
          content: `❌ Could not find ${!resultA ? `"${nameA}"` : ''}${!resultA && !resultB ? ' and ' : ''}${!resultB ? `"${nameB}"` : ''} in the catalog.`,
        });
        return;
      }

      await interaction.editReply({
        embeds: [buildCompareEmbed(resultA.source, resultB.source)],
      });
    },

    async autocomplete(interaction) {
      await handleCasinoAutocomplete(interaction, getAllCasinos(true));
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('mylist')
      .setDescription('View your saved casinos (syncs with dashboard My List)'),

    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const favorites = getUserFavorites(interaction.user.id);
      await interaction.editReply({ embeds: [buildMyListEmbed(favorites)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('favorite')
      .setDescription('Save or remove a casino from your list')
      .addStringOption((o) =>
        o.setName('name').setDescription('Casino name').setRequired(true).setAutocomplete(true),
      )
      .addBooleanOption((o) =>
        o.setName('remove').setDescription('Remove from list instead of adding').setRequired(false),
      )
      .addStringOption((o) =>
        o.setName('note').setDescription('Personal note (saved with casino; max 500 chars)').setRequired(false),
      ),

    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const name = interaction.options.getString('name', true);
      const remove = interaction.options.getBoolean('remove') ?? false;
      const note = interaction.options.getString('note');
      const result = findSimilarCasinosByQuery(name, 1);

      if (!result) {
        await interaction.editReply({ content: `❌ No casino found matching "${name}".` });
        return;
      }

      const casino = result.source;
      if (remove) {
        const ok = removeUserFavorite(interaction.user.id, casino.id);
        await interaction.editReply({
          content: ok ? `Removed **${casino.name}** from your list.` : `**${casino.name}** was not on your list.`,
        });
        return;
      }

      addUserFavorite(interaction.user.id, casino.id);
      if (note?.trim()) {
        setUserFavoriteNote(interaction.user.id, casino.id, note.trim());
      }
      const noteMsg = note?.trim() ? ' Note saved.' : '';
      await interaction.editReply({
        content: `❤️ Saved **${casino.name}** to your list.${noteMsg} Use \`/mylist\` to view.`,
      });
    },

    async autocomplete(interaction) {
      await handleCasinoAutocomplete(interaction, getAllCasinos(true));
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('nophone')
      .setDescription('List casinos that do NOT require a phone number'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ noPhone: true, catalogOnly: true, limit: 25 });
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
      const results = searchCasinos({ features: ['slots'], catalogOnly: true, limit: 25 });
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
      const results = searchCasinos({ features: ['live_games'], catalogOnly: true, limit: 25 });
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
      const results = searchCasinos({ vpnAllowed: true, catalogOnly: true, limit: 25 });
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
      .setDescription('Scan for NEW casinos (admin — quick ~8 min, deep ~30 min, hundreds of URLs)')
      .addBooleanOption((o) =>
        o.setName('deep').setDescription('Deep scan — all queries, page crawl, ~30 min').setRequired(false),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }

      await interaction.deferReply();
      const deep = interaction.options.getBoolean('deep') ?? false;
      const mode = deep ? 'deep' : 'quick';
      const recentAdded: string[] = [];
      let lastEdit = 0;

      let liveStats = {
        phase: 'curated',
        scanned: 0,
        added: 0,
        rejected: 0,
        queued: 0,
        sourcesChecked: 0,
        queryIndex: 0,
        queryTotal: 0,
      };

      const maybeUpdate = async () => {
        const now = Date.now();
        if (now - lastEdit < 7000) return;
        lastEdit = now;
        try {
          await interaction.editReply({
            content: null,
            embeds: [buildDiscoveryProgressEmbed({ ...liveStats, mode, recentAdded })],
          });
        } catch {
          /* interaction token may expire on very long scans */
        }
      };

      const result = await runDiscovery(deep, (event) => {
        if (event.type === 'progress') {
          liveStats = {
            phase: event.stats.phase,
            scanned: event.stats.scanned,
            added: event.stats.added,
            rejected: event.stats.rejected,
            queued: event.stats.queued,
            sourcesChecked: event.stats.sourcesChecked,
            queryIndex: event.stats.queryIndex,
            queryTotal: event.stats.queryTotal,
          };
          void maybeUpdate();
        }
        if (event.type === 'url_added') {
          recentAdded.unshift(event.name);
          if (recentAdded.length > 5) recentAdded.pop();
          void maybeUpdate();
        }
      });

      await interaction.editReply({
        content: null,
        embeds: [buildDiscoveryEmbed(result)],
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('fish')
      .setDescription('List casinos with fish games'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ features: ['fish_games'], catalogOnly: true, limit: 25 });
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
      const results = searchCasinos({ features: ['bingo'], catalogOnly: true, limit: 25 });
      const embed = buildListEmbed(results, 'Bingo Casinos', 'Casinos with bingo 🎯');
      await interaction.editReply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('new')
      .setDescription('Recently approved casinos (matches dashboard New Arrivals)'),

    async execute(interaction) {
      await interaction.deferReply();
      const casinos = getRecentlyApprovedCasinos(15);
      await interaction.editReply({ embeds: [buildArrivalsEmbed(casinos)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('tagged')
      .setDescription('Casinos tagged as newly discovered (new_casino feature)'),

    async execute(interaction) {
      await interaction.deferReply();
      const results = searchCasinos({ features: ['new_casino'], catalogOnly: true, limit: 25 });
      const embed = buildListEmbed(results, 'Tagged New Casinos', 'Operators with the new_casino feature tag ✨');
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
      await interaction.reply({
        embeds: [buildUrlCheckEmbed(checkCasinoUrl(raw))],
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
      const results = searchCasinos({ features, catalogOnly: true, limit: 25 });
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

  {
    data: new SlashCommandBuilder()
      .setName('report')
      .setDescription('Report a suspicious casino URL for admin review')
      .addStringOption((o) =>
        o.setName('url').setDescription('Casino URL to report').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('reason').setDescription('Why you are reporting it').setRequired(false),
      ),

    async execute(interaction) {
      const url = interaction.options.getString('url', true);
      const report = addSiteReport({
        url,
        reason: interaction.options.getString('reason') ?? 'Suspicious site reported via Discord',
        reportedBy: interaction.user.tag,
      });
      void notifySiteReport(report);
      await interaction.reply({
        content: '✅ Report submitted. Admins will review this URL.',
        ephemeral: true,
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('pending')
      .setDescription('View casinos awaiting admin approval (admin only)'),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const pending = getPendingCasinos();
      if (!pending.length) {
        await interaction.editReply({ content: '✅ No casinos pending review.' });
        return;
      }
      const lines = pending.slice(0, 15).map((c) => `• **${c.name}** — ${c.url}`);
      await interaction.editReply({
        content: `**${pending.length} pending review**\n${lines.join('\n')}${pending.length > 15 ? `\n…+${pending.length - 15} more on dashboard` : ''}`,
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('dismissreport')
      .setDescription('Dismiss an open user report by URL (admin only)')
      .addStringOption((o) =>
        o.setName('url').setDescription('Reported URL to dismiss').setRequired(true),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      const raw = interaction.options.getString('url', true);
      const reports = getOpenSiteReports();
      const match = reports.find((r) =>
        r.url.includes(raw) || raw.includes(r.url.replace(/^https?:\/\//, '')),
      );
      if (!match) {
        await interaction.reply({ content: '❌ No open report matching that URL.', ephemeral: true });
        return;
      }
      dismissSiteReport(match.id);
      await interaction.reply({ content: `✅ Dismissed report for ${match.url}`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('approve')
      .setDescription('Approve a pending casino for the public catalog (admin only)')
      .addStringOption((o) =>
        o.setName('name').setDescription('Pending casino name').setRequired(true).setAutocomplete(true),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true);
      const pending = searchCasinos({ query: name, pendingOnly: true, limit: 1 });
      if (!pending.length) {
        await interaction.reply({ content: `❌ No pending casino matching "${name}".`, ephemeral: true });
        return;
      }
      const approved = approveCasino(pending[0].id, interaction.user.tag);
      if (!approved) {
        await interaction.reply({ content: '❌ Approval failed.', ephemeral: true });
        return;
      }
      void notifyCasinoApproved(approved, interaction.user.tag);
      await interaction.reply({
        content: `✅ **${approved.name}** approved and live in catalog.\n${approved.url}`,
      });
    },

    async autocomplete(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.respond([]);
        return;
      }
      await handleCasinoAutocomplete(interaction, getPendingCasinos());
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('reject')
      .setDescription('Reject and remove a pending casino (admin only)')
      .addStringOption((o) =>
        o.setName('name').setDescription('Pending casino name').setRequired(true).setAutocomplete(true),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true);
      const pending = searchCasinos({ query: name, pendingOnly: true, limit: 1 });
      if (!pending.length) {
        await interaction.reply({ content: `❌ No pending casino matching "${name}".`, ephemeral: true });
        return;
      }
      const casino = pending[0];
      rejectCasino(casino.id);
      await interaction.reply({
        content: `🗑️ Rejected **${casino.name}** — removed from review queue.`,
        ephemeral: true,
      });
    },

    async autocomplete(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.respond([]);
        return;
      }
      await handleCasinoAutocomplete(interaction, getPendingCasinos());
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('insights')
      .setDescription('Admin backlog and discovery stats (admin only)'),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const insights = getAdminInsights();
      await interaction.editReply({ embeds: [buildInsightsEmbed(insights)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('reports')
      .setDescription('List open user/discovery reports (admin only)'),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const reports = getOpenSiteReports();
      await interaction.editReply({
        embeds: [buildReportsEmbed(reports.map((r) => ({
          url: r.url,
          reason: r.reason,
          reportedBy: r.reportedBy,
        })))],
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('unlist')
      .setDescription('Remove a casino from the public catalog (admin only)')
      .addStringOption((o) =>
        o.setName('name').setDescription('Casino name').setRequired(true).setAutocomplete(true),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true);
      const match = searchCasinos({ query: name, catalogOnly: true, limit: 1 });
      if (!match.length) {
        await interaction.reply({ content: `❌ No catalog casino matching "${name}".`, ephemeral: true });
        return;
      }
      const ok = unlistCasino(match[0].id);
      await interaction.reply({
        content: ok
          ? `📤 **${match[0].name}** removed from the public catalog.`
          : '❌ Unlist failed.',
        ephemeral: true,
      });
    },

    async autocomplete(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.respond([]);
        return;
      }
      await handleCasinoAutocomplete(interaction, getAllCasinos(true));
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('revalidate')
      .setDescription('Re-check a casino homepage health (admin only)')
      .addStringOption((o) =>
        o.setName('name').setDescription('Casino name').setRequired(true).setAutocomplete(true),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true);
      const match = searchCasinos({ query: name, catalogOnly: true, limit: 1 });
      if (!match.length) {
        await interaction.reply({ content: `❌ No catalog casino matching "${name}".`, ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const result = await revalidateCasinoById(match[0].id);
      await interaction.editReply({
        content: result.ok
          ? `✅ **${result.name}** passed homepage revalidation.`
          : `⚠️ **${result.name}** failed: ${result.reason ?? 'check failed'}`,
      });
    },

    async autocomplete(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.respond([]);
        return;
      }
      await handleCasinoAutocomplete(interaction, getAllCasinos(true));
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('blockreport')
      .setDescription('Block a reported URL and close the report (admin only)')
      .addStringOption((o) =>
        o.setName('url').setDescription('Reported URL (partial match OK)').setRequired(true),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      const raw = interaction.options.getString('url', true);
      const reports = getOpenSiteReports();
      const match = reports.find((r) =>
        r.url.includes(raw) || raw.includes(r.url.replace(/^https?:\/\//, '')),
      );
      if (!match) {
        await interaction.reply({ content: '❌ No open report matching that URL.', ephemeral: true });
        return;
      }
      const site = addBlockedSite({
        name: match.url.replace(/^https?:\/\//, '').slice(0, 60),
        url: match.url,
        reason: 'scam',
        severity: 'high',
        description: match.reason ?? 'Blocked from report review',
        reportedBy: match.reportedBy,
        removeCasino: true,
      });
      markSiteReportReviewed(match.id, interaction.user.tag);
      await interaction.reply({
        content: site
          ? `⛔ Blocked **${match.url}** and closed the report.`
          : `⚠️ Report closed but blocklist entry may already exist for ${match.url}.`,
        ephemeral: true,
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('reporthistory')
      .setDescription('Recently closed site reports (admin only)'),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const closed = getClosedSiteReports(12);
      if (!closed.length) {
        await interaction.editReply({ content: 'No closed reports yet.' });
        return;
      }
      const lines = closed.map((r) =>
        `• ${r.url}${r.reason ? ` — ${r.reason.slice(0, 40)}` : ''}`,
      );
      await interaction.editReply({
        content: `**Recent closed reports (${closed.length})**\n${lines.join('\n')}`,
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('promotereport')
      .setDescription('Promote a ban-review URL to pending discovery (admin only)')
      .addStringOption((o) =>
        o.setName('url').setDescription('Reported URL (partial match OK)').setRequired(true),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      const raw = interaction.options.getString('url', true);
      const reports = getOpenSiteReports();
      const match = reports.find((r) =>
        r.url.includes(raw) || raw.includes(r.url.replace(/^https?:\/\//, '')),
      );
      if (!match) {
        await interaction.reply({ content: '❌ No open report matching that URL.', ephemeral: true });
        return;
      }
      const known = new Set(getKnownHosts());
      const saved = saveDiscoveryCandidateForReview(match.url, 'promoted from ban review', known);
      if (!saved) {
        await interaction.reply({
          content: '❌ Already in catalog, blocked, or not an operator URL.',
          ephemeral: true,
        });
        return;
      }
      dismissSiteReport(match.id, interaction.user.tag);
      await interaction.reply({
        content: `✅ Promoted **${saved.name}** to pending review.\nApprove with \`/approve\` or the dashboard Review Queue.`,
        ephemeral: true,
      });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('approveall')
      .setDescription('Approve up to 50 pending casinos for the catalog (admin only)')
      .addIntegerOption((o) =>
        o.setName('limit').setDescription('Max to approve (default 50)').setRequired(false).setMinValue(1).setMaxValue(50),
      ),

    async execute(interaction) {
      if (!isAdmin(interaction.user.id)) {
        await interaction.reply({ content: '❌ Admin only command.', ephemeral: true });
        return;
      }
      const limit = interaction.options.getInteger('limit') ?? 50;
      await interaction.deferReply({ ephemeral: true });
      const result = approveAllPendingCasinos(interaction.user.tag, limit);
      const remaining = getPendingCasinos().length;
      await interaction.editReply({
        content: result.approved > 0
          ? `✅ Approved **${result.approved}** casino(s) for the public catalog.${remaining > 0 ? ` ${remaining} still pending.` : ''}`
          : 'No pending casinos to approve.',
      });
    },
  },

  ...siteCommands,

  ...extraCommands,

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
        content: `🎰 **The Method** — **${casino.name}**\n${casino.url}\n_${BRAND_MOTTO}_`,
        ephemeral: false,
      });
    }
  });
}
