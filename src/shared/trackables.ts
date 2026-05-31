import type { Casino, Trackable } from './types.js';

export function formatTrackableValue(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function buildTrackablesText(
  cashOutBeforeBlocked: number | null,
  trackables: Trackable[],
): string {
  const lines: string[] = [];

  if (cashOutBeforeBlocked !== null && cashOutBeforeBlocked !== undefined) {
    lines.push(`💰 Cash Out Before Blocked: ${formatTrackableValue(cashOutBeforeBlocked)}`);
  }

  for (const item of trackables) {
    if (item.label.trim()) {
      lines.push(`📊 ${item.label}: ${formatTrackableValue(item.value)}`);
    }
  }

  return lines.length ? lines.join('\n') : 'None set';
}

export function normalizeTrackables(raw: Trackable[] | undefined): Trackable[] {
  if (!raw?.length) return [];
  return raw
    .filter((t) => t.label.trim())
    .map((t) => ({
      label: t.label.trim(),
      value: Number.isFinite(t.value) ? t.value : 0,
    }));
}

export const CASH_OUT_LABEL = 'Cash Out Before Blocked';
