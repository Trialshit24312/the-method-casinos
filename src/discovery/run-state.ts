import { nanoid } from 'nanoid';

interface ActiveRun {
  controller: AbortController;
  startedAt: number;
}

const runs = new Map<string, ActiveRun>();

export function getMaxConcurrentDiscoveries(): number {
  const n = parseInt(process.env.DISCOVERY_MAX_CONCURRENT ?? '3', 10);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(8, n);
}

export function getActiveDiscoveryRunCount(): number {
  return runs.size;
}

export function canStartDiscoveryRun(): boolean {
  return runs.size < getMaxConcurrentDiscoveries();
}

export function getActiveDiscoveryRunIds(): string[] {
  return [...runs.keys()];
}

/** Register a discovery run. Does not cancel other active runs. */
export function beginDiscoveryRun(existingRunId?: string): { runId: string; signal: AbortSignal } {
  const runId = existingRunId ?? `disc-${nanoid(10)}`;
  if (!existingRunId && runs.size >= getMaxConcurrentDiscoveries()) {
    throw new Error(`Maximum concurrent discovery runs (${getMaxConcurrentDiscoveries()}) reached`);
  }
  if (runs.has(runId)) {
    return { runId, signal: runs.get(runId)!.controller.signal };
  }
  const controller = new AbortController();
  runs.set(runId, { controller, startedAt: Date.now() });
  return { runId, signal: controller.signal };
}

export function tryBeginDiscoveryRun(): { runId: string; signal: AbortSignal } | null {
  if (!canStartDiscoveryRun()) return null;
  return beginDiscoveryRun();
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
