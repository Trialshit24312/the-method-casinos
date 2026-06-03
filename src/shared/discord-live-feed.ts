import type { APIEmbed, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import type { DiscoveryLiveStats, DiscoveryProgressEvent } from './types.js';
import type { PublicFeedItem } from '../database/index.js';
import { getBotClient } from '../bot/state.js';

const BRAND_CYAN = 0x00aeef;
const BRAND_BRONZE = 0xb87333;
const BRAND_GREEN = 0x22c55e;
const BRAND_AMBER = 0xf59e0b;
const BRAND_RED = 0xef4444;

function shortUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.slice(0, 24) : '');
  } catch {
    return url.slice(0, 40);
  }
}

export function getLiveFeedWebhookUrl(): string | undefined {
  return (
    process.env.DISCORD_LIVE_FEED_WEBHOOK_URL?.trim()
    || process.env.DISCORD_WEBHOOK_URL?.trim()
    || undefined
  );
}

export function isDiscordLiveFeedEnabled(): boolean {
  if (process.env.VITEST === 'true') return false;
  const flag = process.env.DISCORD_LIVE_FEED?.trim().toLowerCase();
  if (flag === '1' || flag === 'true') return true;
  return Boolean(
    process.env.DISCORD_FEED_CHANNEL_ID?.trim() || getLiveFeedWebhookUrl(),
  );
}

function verboseScanLogs(): boolean {
  const v = process.env.DISCORD_LIVE_FEED_VERBOSE?.trim().toLowerCase();
  return v === '1' || v === 'true';
}

function feedUsername(): string {
  return process.env.DISCORD_LIVE_FEED_USERNAME?.trim() || 'The Method · Discovery';
}

function feedAvatarUrl(): string | undefined {
  return process.env.DISCORD_LIVE_FEED_AVATAR?.trim() || undefined;
}

export function formatDiscoveryEventLine(event: DiscoveryProgressEvent): string | null {
  switch (event.type) {
    case 'phase':
      return `▸ **${event.label}**`;
    case 'search_query':
      return `🔎 \`${event.query.slice(0, 80)}\``;
    case 'search_engine': {
      const labels: Record<string, string> = {
        serper: 'Google',
        ddg_instant: 'DDG Instant',
        reddit: 'Reddit',
        browser: 'Browser',
        duckduckgo: 'DuckDuckGo',
        duckduckgo_lite: 'DDG Lite',
        bing: 'Bing',
        brave: 'Brave',
      };
      const engine = labels[event.engine] ?? event.engine;
      const count = event.linkCount != null ? ` · ${event.linkCount} links` : '';
      return `🌐 **${engine}** → \`${event.query.slice(0, 60)}\`${count}`;
    }
    case 'url_scanning':
      return verboseScanLogs() ? `Scanning \`${shortUrl(event.url)}\`` : null;
    case 'browser_fetch':
      return `↻ Browser fetch \`${shortUrl(event.url)}\``;
    case 'crawl_summary':
      return `▸ ${event.label}`;
    case 'url_added':
      return event.needsReview
        ? `◐ **${event.name}** — verify · ${shortUrl(event.url)}`
        : `✓ **${event.name}** queued · ${shortUrl(event.url)}`;
    case 'url_rejected':
      return `✗ \`${shortUrl(event.url)}\` — ${event.reason.slice(0, 100)}`;
    case 'url_skipped':
      return verboseScanLogs() ? `– Skipped \`${shortUrl(event.url)}\`` : null;
    case 'url_blocked':
      return `🚫 Blocked \`${shortUrl(event.url)}\``;
    case 'complete': {
      const r = event.result;
      const mins = Math.round(r.durationMs / 60000);
      return `**${r.mode} scan complete** — +${r.added} queued · ${r.rejected} rejected · ${mins}m`;
    }
    default:
      return null;
  }
}

function embedFromEvent(event: DiscoveryProgressEvent): APIEmbed | null {
  switch (event.type) {
    case 'url_added':
      return new EmbedBuilder()
        .setColor(event.needsReview ? BRAND_AMBER : BRAND_GREEN)
        .setTitle(event.needsReview ? '◐ New find — needs review' : '✓ New casino queued')
        .setDescription(`**${event.name}**`)
        .addFields(
          { name: 'Site', value: `[${shortUrl(event.url)}](${event.url.startsWith('http') ? event.url : `https://${event.url}`})`, inline: true },
          ...(event.reviewNote ? [{ name: 'Note', value: event.reviewNote.slice(0, 200), inline: false }] : []),
        )
        .setFooter({ text: 'The Method Casinos · Discovery Live' })
        .setTimestamp()
        .toJSON();
    case 'complete': {
      const r = event.result;
      const mins = Math.round(r.durationMs / 60000);
      const top = r.addedCasinos.slice(0, 5).map((c) => `• **${c.name}**`).join('\n') || '_No new operators this pass_';
      return new EmbedBuilder()
        .setColor(BRAND_CYAN)
        .setTitle(`${r.mode === 'deep' ? 'Deep' : 'Quick'} scan complete`)
        .setDescription(top)
        .addFields(
          { name: 'Queued', value: String(r.added), inline: true },
          { name: 'Rejected', value: String(r.rejected), inline: true },
          { name: 'Scanned', value: String(r.scanned), inline: true },
          { name: 'Duration', value: `${mins} min`, inline: true },
        )
        .setFooter({ text: 'The Method Casinos · Discovery Live' })
        .setTimestamp()
        .toJSON();
    }
    case 'phase':
      return new EmbedBuilder()
        .setColor(BRAND_BRONZE)
        .setTitle('Discovery phase')
        .setDescription(event.label)
        .setFooter({ text: 'The Method Casinos · Discovery Live' })
        .setTimestamp()
        .toJSON();
    case 'url_blocked':
      return new EmbedBuilder()
        .setColor(BRAND_RED)
        .setTitle('🚫 Blocked URL')
        .setDescription(`\`${shortUrl(event.url)}\``)
        .setFooter({ text: 'The Method Casinos · Discovery Live' })
        .setTimestamp()
        .toJSON();
    default:
      return null;
  }
}

const recentLines: string[] = [];
const pendingLines: string[] = [];
let lastPostAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let statusMessageId: string | null = null;
let lastStats: DiscoveryLiveStats | null = null;
let statusEditTimer: ReturnType<typeof setInterval> | null = null;

function rememberLine(line: string): void {
  recentLines.push(line);
  if (recentLines.length > 14) recentLines.shift();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  const minGap = 3500;
  const delay = Math.max(0, minGap - (Date.now() - lastPostAt));
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPendingPosts();
  }, delay);
}

function canPostExternally(): boolean {
  return process.env.VITEST !== 'true' && process.env.NODE_ENV !== 'test';
}

async function sendFeedPayload(payload: { content?: string; embeds?: APIEmbed[] }): Promise<void> {
  if (!canPostExternally()) return;

  const channelId = process.env.DISCORD_FEED_CHANNEL_ID?.trim();
  const client = getBotClient();

  if (channelId && client?.isReady()) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased() && 'send' in channel) {
      await (channel as TextChannel).send(payload);
      return;
    }
  }

  const webhook = getLiveFeedWebhookUrl();
  if (!webhook) return;

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: feedUsername(),
      avatar_url: feedAvatarUrl(),
      ...payload,
    }),
  });
}

async function flushPendingPosts(): Promise<void> {
  if (pendingLines.length === 0) return;
  const batch = pendingLines.splice(0, 6);
  const body = batch.join('\n').slice(0, 4000);
  try {
    await sendFeedPayload({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND_CYAN)
          .setTitle('Discovery activity')
          .setDescription(body)
          .setFooter({ text: 'The Method Casinos · Live feed' })
          .setTimestamp()
          .toJSON(),
      ],
    });
    lastPostAt = Date.now();
  } catch (err) {
    console.warn('Discord live feed post failed:', err instanceof Error ? err.message : err);
  }
  if (pendingLines.length > 0) scheduleFlush();
}

function enqueueLine(line: string, immediate = false): void {
  rememberLine(line);
  pendingLines.push(line);
  if (immediate) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushPendingPosts();
    return;
  }
  scheduleFlush();
}

function buildStatusEmbed(): EmbedBuilder {
  const s = lastStats;
  const statsLine = s
    ? [
        `**Scanned** ${s.scanned} · **Queue** ${s.queued} · **Added** ${s.added} · **Rejected** ${s.rejected}`,
        `**Phase** \`${s.phase}\` · **Query** ${s.queryIndex}/${s.queryTotal} · **Sources** ${s.sourcesChecked}`,
      ].join('\n')
    : '_Waiting for scan stats…_';
  const logBlock = recentLines.length
    ? recentLines.slice(-10).map((l) => l.slice(0, 200)).join('\n')
    : '_No events yet this session._';

  return new EmbedBuilder()
    .setColor(BRAND_CYAN)
    .setAuthor({ name: 'The Method Casinos', iconURL: feedAvatarUrl() })
    .setTitle('🔍 Discovery Live')
    .setDescription(`${statsLine}\n\n**Recent activity**\n${logBlock.slice(0, 3200)}`)
    .setFooter({ text: 'Bronze & cyan · Sweepstakes catalog' })
    .setTimestamp();
}

async function ensureStatusMessage(): Promise<void> {
  if (!canPostExternally()) return;

  const channelId = process.env.DISCORD_FEED_CHANNEL_ID?.trim();
  const pin = process.env.DISCORD_LIVE_FEED_PIN === '1' || process.env.DISCORD_LIVE_FEED_PIN === 'true';
  if (!pin || !channelId) return;

  const client = getBotClient();
  if (!client?.isReady() || statusMessageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !('send' in channel)) return;

  const msg = await (channel as TextChannel).send({ embeds: [buildStatusEmbed()] });
  statusMessageId = msg.id;
  try {
    await msg.pin();
  } catch {
    /* missing Manage Messages */
  }
}

async function refreshStatusEmbed(): Promise<void> {
  if (!canPostExternally()) return;

  const channelId = process.env.DISCORD_FEED_CHANNEL_ID?.trim();
  if (!channelId || !statusMessageId) return;

  const client = getBotClient();
  if (!client?.isReady()) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !('messages' in channel)) return;

  try {
    const msg = await (channel as TextChannel).messages.fetch(statusMessageId);
    await msg.edit({ embeds: [buildStatusEmbed()] });
  } catch {
    statusMessageId = null;
    void ensureStatusMessage();
  }
}

let feedInitialized = false;

export function initDiscordLiveFeed(): void {
  if (feedInitialized || !isDiscordLiveFeedEnabled()) return;
  feedInitialized = true;

  const channel = process.env.DISCORD_FEED_CHANNEL_ID?.trim();
  const via = channel
    ? `channel ${channel}`
    : process.env.DISCORD_LIVE_FEED_WEBHOOK_URL?.trim()
      ? 'live-feed webhook'
      : 'webhook (DISCORD_WEBHOOK_URL)';
  console.log(`📡 Discord live feed enabled (${via})`);

  if (statusEditTimer) clearInterval(statusEditTimer);
  statusEditTimer = setInterval(() => {
    void refreshStatusEmbed();
  }, 45_000);

  void ensureStatusMessage();
}

export function projectDiscoveryEvent(event: DiscoveryProgressEvent): void {
  if (!canPostExternally() || !isDiscordLiveFeedEnabled()) return;
  if (event.type === 'heartbeat') return;

  if (event.type === 'progress') {
    lastStats = event.stats;
    return;
  }

  const richEmbed = embedFromEvent(event);
  if (richEmbed) {
    void sendFeedPayload({ embeds: [richEmbed] }).catch((err) => {
      console.warn('Discord live feed embed failed:', err instanceof Error ? err.message : err);
    });
    const line = formatDiscoveryEventLine(event);
    if (line) rememberLine(line);
    void refreshStatusEmbed();
    return;
  }

  const line = formatDiscoveryEventLine(event);
  if (!line) return;

  const immediate = event.type === 'search_engine' || event.type === 'crawl_summary';
  enqueueLine(line, immediate);
  void refreshStatusEmbed();
}

export function projectPublicFeedItem(item: PublicFeedItem): void {
  if (!isDiscordLiveFeedEnabled()) return;

  const when = `<t:${Math.floor(new Date(item.at).getTime() / 1000)}:R>`;
  const embed = new EmbedBuilder()
    .setColor(item.type === 'approval' ? BRAND_GREEN : BRAND_CYAN)
    .setTitle(item.type === 'approval' ? '✅ Catalog approval' : '🔍 Discovery update')
    .setDescription(`**${item.title}**`)
    .addFields({ name: 'Detail', value: `${item.detail} · ${when}` })
    .setFooter({ text: 'The Method Casinos · Public feed' })
    .setTimestamp(new Date(item.at));

  void sendFeedPayload({ embeds: [embed.toJSON()] });
}
