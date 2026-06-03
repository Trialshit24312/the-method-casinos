import fetch from 'node-fetch';
import type { RevalidateResult } from '../discovery/revalidate.js';
import { projectPublicFeedItem } from './discord-live-feed.js';

export async function notifyDiscordWebhook(payload: {
  title: string;
  description: string;
  color?: number;
}): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: payload.title,
          description: payload.description.slice(0, 4000),
          color: payload.color ?? 0x7c3aed,
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  } catch (err) {
    console.warn('Discord webhook failed:', err instanceof Error ? err.message : err);
  }
}

export async function notifySiteReport(report: {
  url: string;
  reason?: string;
  reportedBy: string;
}): Promise<void> {
  await notifyDiscordWebhook({
    title: 'New site report',
    description: [
      `**URL:** ${report.url}`,
      report.reason ? `**Reason:** ${report.reason}` : '',
      `**Reported by:** ${report.reportedBy}`,
      '',
      'Review at dashboard → Review Queue → User Reports',
    ].filter(Boolean).join('\n'),
    color: 0xf59e0b,
  });
}

export async function notifyCasinoApproved(casino: { name: string; url: string }, approvedBy: string): Promise<void> {
  projectPublicFeedItem({
    type: 'approval',
    at: new Date().toISOString(),
    title: casino.name,
    detail: `Approved by ${approvedBy}`,
  });
  await notifyDiscordWebhook({
    title: 'Casino approved',
    description: [
      `**${casino.name}** is now in the public catalog.`,
      `**URL:** ${casino.url}`,
      `**Approved by:** ${approvedBy}`,
    ].join('\n'),
    color: 0x10b981,
  });
}

export async function notifyDiscoveryComplete(result: {
  mode: string;
  added: number;
  rejected: number;
  scanned: number;
  durationMs: number;
  addedCasinos: { name: string; url: string }[];
}): Promise<void> {
  const mins = Math.round(result.durationMs / 60000);
  const lines = result.addedCasinos.slice(0, 8).map((c) => `• ${c.name} — ${c.url}`).join('\n');
  projectPublicFeedItem({
    type: 'discovery',
    at: new Date().toISOString(),
    title: `${result.mode} discovery scan`,
    detail: `+${result.added} queued · ${result.rejected} rejected`,
  });
  await notifyDiscordWebhook({
    title: `Discovery ${result.mode} scan complete`,
    description: [
      `**Added to review queue:** ${result.added}`,
      `**Rejected:** ${result.rejected} · **Scanned:** ${result.scanned}`,
      `**Duration:** ${mins}m`,
      lines ? `\n${lines}` : '',
      result.added ? '\nApprove at dashboard → Review Queue' : '',
    ].join('\n'),
    color: result.added > 0 ? 0x10b981 : 0x6b7280,
  });
}

export async function notifyPendingDiscovery(casino: { name: string; url: string; reason: string }): Promise<void> {
  if (process.env.DISCORD_NOTIFY_PENDING !== '1') return;
  await notifyDiscordWebhook({
    title: 'New pending discovery',
    description: [
      `**${casino.name}** queued for review.`,
      `**URL:** ${casino.url}`,
      `**Note:** ${casino.reason}`,
      '',
      'Approve at dashboard → Review Queue → Discoveries',
    ].join('\n'),
    color: 0xf59e0b,
  });
}

export async function notifyRevalidationFailures(failed: RevalidateResult[]): Promise<void> {
  if (!failed.length) return;
  const lines = failed.slice(0, 10).map((r) => `• **${r.name}** — ${r.reason ?? 'check failed'}`).join('\n');
  await notifyDiscordWebhook({
    title: `Catalog health: ${failed.length} site(s) failed revalidation`,
    description: [
      lines,
      failed.length > 10 ? `\n… and ${failed.length - 10} more` : '',
      '',
      'Review at dashboard → Review Queue → Catalog Health',
    ].join('\n'),
    color: 0xef4444,
  });
}
