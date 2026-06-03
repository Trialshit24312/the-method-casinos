import { nanoid } from 'nanoid';

export type DiscoveryRunOwner = 'system' | 'user';

interface ActiveRun {
  controller: AbortController;
  startedAt: number;
  owner: DiscoveryRunOwner;
}

const runs = new Map<string, ActiveRun>();

export function getMaxConcurrentDiscoveries(): number {
  const n = parseInt(process.env.DISCOVERY_MAX_CONCURRENT ?? '3', 10);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(8, n);
}

/** Max parallel 24/7 workers — leaves slots for dashboard / Discord / manual scans. */
export function getMaxSystemDiscoveries(): number {
  const max = getMaxConcurrentDiscoveries();
  const reserved = parseInt(process.env.DISCOVERY_USER_SLOTS ?? '1', 10);
  const userSlots = Number.isFinite(reserved) && reserved >= 1 ? Math.min(max - 1, reserved) : 1;
  const systemMax = parseInt(process.env.DISCOVERY_SYSTEM_MAX ?? String(Math.max(1, max - userSlots)), 10);
  if (!Number.isFinite(systemMax) || systemMax < 0) return Math.max(1, max - userSlots);
  return Math.min(max, Math.max(0, systemMax));
}

export function getActiveDiscoveryRunCount(): number {
  return runs.size;
}

export function getActiveSystemRunCount(): number {
  return [...runs.values()].filter((r) => r.owner === 'system').length;
}

export function getActiveUserRunCount(): number {
  return [...runs.values()].filter((r) => r.owner === 'user').length;
}

export function canStartDiscoveryRun(owner: DiscoveryRunOwner = 'user'): boolean {
  if (runs.size >= getMaxConcurrentDiscoveries()) return false;
  if (owner === 'system') {
    return getActiveSystemRunCount() < getMaxSystemDiscoveries();
  }
  return true;
}

export function getActiveDiscoveryRunIds(): string[] {
  return [...runs.keys()];
}

/** Abort the oldest 24/7 worker so an admin/user scan can start. */
export function preemptOldestSystemRun(): boolean {
  let oldest: { runId: string; startedAt: number } | null = null;
  for (const [runId, run] of runs) {
    if (run.owner !== 'system') continue;
    if (!oldest || run.startedAt < oldest.startedAt) {
      oldest = { runId, startedAt: run.startedAt };
    }
  }
  if (!oldest) return false;
  cancelDiscoveryRun(oldest.runId);
  return true;
}

/** User-initiated scans get priority over 24/7 workers. */
export function ensureUserDiscoverySlot(): boolean {
  if (canStartDiscoveryRun('user')) return true;
  if (getActiveSystemRunCount() === 0) return false;
  preemptOldestSystemRun();
  return canStartDiscoveryRun('user');
}

/** Register a discovery run. Does not cancel other active runs. */
export function beginDiscoveryRun(
  existingRunId?: string,
  owner: DiscoveryRunOwner = 'user',
): { runId: string; signal: AbortSignal } {
  const runId = existingRunId ?? `disc-${nanoid(10)}`;
  if (!existingRunId) {
    if (runs.size >= getMaxConcurrentDiscoveries()) {
      throw new Error(`Maximum concurrent discovery runs (${getMaxConcurrentDiscoveries()}) reached`);
    }
    if (owner === 'system' && getActiveSystemRunCount() >= getMaxSystemDiscoveries()) {
      throw new Error(`Maximum system discovery workers (${getMaxSystemDiscoveries()}) reached`);
    }
  }
  if (runs.has(runId)) {
    return { runId, signal: runs.get(runId)!.controller.signal };
  }
  const controller = new AbortController();
  runs.set(runId, { controller, startedAt: Date.now(), owner });
  return { runId, signal: controller.signal };
}

export function tryBeginDiscoveryRun(owner: DiscoveryRunOwner = 'user'): { runId: string; signal: AbortSignal } | null {
  if (!canStartDiscoveryRun(owner)) return null;
  return beginDiscoveryRun(undefined, owner);
}

export function cancelDiscoveryRun(runId?: string): boolean {
  if (runId) {
    const run = runs.get(runId);
    if (!run) return false;
    run.controller.abort();
    runs.delete(runId);
    return true;
  }
  let cancelled = false;
  for (const run of runs.values()) {
    run.controller.abort();
    cancelled = true;
  }
  runs.clear();
  return cancelled;
}

export function endDiscoveryRun(runId?: string): void {
  if (runId) {
    runs.delete(runId);
    return;
  }
  runs.clear();
}

export function isDiscoveryRunning(): boolean {
  return runs.size > 0;
}

export function getDiscoveryAbortSignal(runId?: string): AbortSignal | undefined {
  if (runId) return runs.get(runId)?.controller.signal;
  const first = runs.values().next().value;
  return first?.controller.signal;
}

export function throwIfCancelled(runId?: string): void {
  const signal = getDiscoveryAbortSignal(runId);
  if (signal?.aborted) {
    throw new Error('Discovery cancelled');
  }
}
