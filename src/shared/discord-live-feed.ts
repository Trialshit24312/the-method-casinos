import type { TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import type { DiscoveryLiveStats, DiscoveryProgressEvent } from './types.js';
import type { PublicFeedItem } from '../database/index.js';
import { getBotClient } from '../bot/state.js';

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

export function formatDiscoveryEventLine(event: DiscoveryProgressEvent): string | null {
  switch (event.type) {
    case 'phase':
      return `▸ **${event.label}**`;
    case 'search_query':
      return `🔎 Searching: \`${event.query.slice(0, 80)}\``;
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
      return `🌐 ${engine} → \`${event.query.slice(0, 60)}\`${count}`;
    }
    case 'url_scanning':
      return verboseScanLogs() ? `Scanning \`${shortUrl(event.url)}\`` : null;
    case 'browser_fetch':
      return `↻ Browser fetch \`${shortUrl(event.url)}\``;
    case 'crawl_summary':
      return `▸ ${event.label}`;
    case 'url_added':
      return event.needsReview
        ? `◐ **${event.name}** — verify (${event.reviewNote ?? 'manual check'}) · ${shortUrl(event.url)}`
        : `✓ **${event.name}** queued · ${shortUrl(event.url)}`;
    case 'url_rejected':
      return `✗ Ban review: \`${shortUrl(event.url)}\` — ${event.reason.slice(0, 120)}`;
    case 'url_skipped':
      return verboseScanLogs() ? `– Skipped \`${shortUrl(event.url)}\` — ${event.reason}` : null;
    case 'url_blocked':
      return `🚫 Blocked \`${shortUrl(event.url)}\``;
    case 'complete': {
      const r = event.result;
      const mins = Math.round(r.durationMs / 60000);
      const top = r.addedCasinos.slice(0, 5).map((c) => `• ${c.name}`).join('\n');
      return [
        `**${r.mode} scan complete** — +${r.added} queued · ${r.rejected} rejected · ${r.scanned} scanned · ${mins}m`,
        top || undefined,
      ].filter(Boolean).join('\n');
    }
    default:
      return null;
  }
}

const recentLines: string[] = [];
const pendingPosts: string[] = [];
let lastPostAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let statusMessageId: string | null = null;
let lastStats: DiscoveryLiveStats | null = null;
let statusEditTimer: ReturnType<typeof setInterval> | null = null;

function rememberLine(line: string): void {
  recentLines.push(line);
  if (recentLines.length > 12) recentLines.shift();
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

async function sendFeedContent(content: string): Promise<void> {
  if (!canPostExternally()) return;

  const channelId = process.env.DISCORD_FEED_CHANNEL_ID?.trim();
  const client = getBotClient();

  if (channelId && client?.isReady()) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased() && 'send' in channel) {
      await (channel as TextChannel).send({ content: content.slice(0, 2000) });
      return;
    }
  }

  const webhook = getLiveFeedWebhookUrl();
  if (!webhook) return;

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Discovery Live',
      content: content.slice(0, 2000),
    }),
  });
}

async function flushPendingPosts(): Promise<void> {
  if (pendingPosts.length === 0) return;
  const batch = pendingPosts.splice(0, 4).join('\n');
  try {
    await sendFeedContent(batch);
    lastPostAt = Date.now();
  } catch (err) {
    console.warn('Discord live feed post failed:', err instanceof Error ? err.message : err);
  }
  if (pendingPosts.length > 0) scheduleFlush();
}

function enqueueLine(line: string, immediate = false): void {
  rememberLine(line);
  pendingPosts.push(line);
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
    ? `Scanned **${s.scanned}** · Queue **${s.queued}** · Added **${s.added}** · Rejected **${s.rejected}**\nQuery **${s.queryIndex}/${s.queryTotal}** · Phase **${s.phase}**`
    : '_Waiting for scan stats…_';
  const logBlock = recentLines.length
    ? recentLines.slice(-8).map((l) => l.slice(0, 180)).join('\n')
    : '_No events yet this session._';

  return new EmbedBuilder()
    .setColor(0x00aeef)
    .setTitle('🔍 Discovery live feed')
    .setDescription(`${statsLine}\n\n**Recent**\n${logBlock.slice(0, 3500)}`)
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

  const line = formatDiscoveryEventLine(event);
  if (!line) return;

  const immediate = event.type === 'url_added'
    || event.type === 'complete'
    || event.type === 'phase'
    || event.type === 'url_blocked';

  enqueueLine(line, immediate);
  void refreshStatusEmbed();
}

export function projectPublicFeedItem(item: PublicFeedItem): void {
  if (!isDiscordLiveFeedEnabled()) return;

  const when = `<t:${Math.floor(new Date(item.at).getTime() / 1000)}:R>`;
  const icon = item.type === 'approval' ? '✅' : '🔍';
  const line = `${icon} **${item.title}** — ${item.detail} (${when})`;
  enqueueLine(line, item.type === 'approval');
}
