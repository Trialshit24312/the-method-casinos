import { hasDiscoverySession } from '../database/index.js';
import { runDiscovery } from './engine.js';
import {
  canStartDiscoveryRun,
  endDiscoveryRun,
  getActiveDiscoveryRunCount,
  getActiveSystemRunCount,
  getMaxConcurrentDiscoveries,
  getMaxSystemDiscoveries,
  tryBeginDiscoveryRun,
} from './run-state.js';
import { releaseListSitesForRun } from './list-site-coordinator.js';
import { beginDiscoveryLive, isDiscoveryLiveActive, pushDiscoveryLiveEvent } from './live-state.js';

let loopStarted = false;

export function isContinuousDiscoveryEnabled(): boolean {
  const v = process.env.DISCOVERY_CONTINUOUS?.trim().toLowerCase();
  return v === '1' || v === 'true';
}

function cooldownMs(): number {
  const sec = parseInt(process.env.DISCOVERY_CONTINUOUS_COOLDOWN_SEC ?? '90', 10);
  return (Number.isFinite(sec) && sec >= 0 ? sec : 90) * 1000;
}

function bootDelayMs(): number {
  const sec = parseInt(process.env.DISCOVERY_CONTINUOUS_BOOT_DELAY_SEC ?? '45', 10);
  return (Number.isFinite(sec) && sec >= 0 ? sec : 45) * 1000;
}

function clientDiscoveryActive(): boolean {
  return hasDiscoverySession();
}

async function runDeepCycle(runId: string): Promise<void> {
  const useLiveFeed = !isDiscoveryLiveActive();
  if (useLiveFeed) beginDiscoveryLive('deep');

  console.log(`🔍 Deep discovery worker ${runId} starting (list sites + crawl)…`);

  try {
    const result = await runDiscovery(true, pushDiscoveryLiveEvent, { runId, registerRun: false });
    console.log(
      `🔍 Worker ${runId} done: +${result.added} added, ${result.rejected} rejected, ${result.scanned} scanned`,
    );
  } catch (err) {
    console.warn(`24/7 worker ${runId} failed:`, err instanceof Error ? err.message : err);
  } finally {
    releaseListSitesForRun(runId);
    endDiscoveryRun(runId);
  }
}

function trySpawnWorkers(): void {
  if (!isContinuousDiscoveryEnabled()) return;
  if (clientDiscoveryActive()) return;

  while (canStartDiscoveryRun('system')) {
    const started = tryBeginDiscoveryRun('system');
    if (!started) break;
    void runDeepCycle(started.runId);
  }
}

function scheduleWorkerPump(delayMs: number): void {
  setTimeout(() => {
    trySpawnWorkers();
    scheduleWorkerPump(cooldownMs());
  }, delayMs);
}

export function startContinuousDiscovery(): void {
  if (!isContinuousDiscoveryEnabled()) return;
  if (loopStarted) return;
  loopStarted = true;

  const max = getMaxSystemDiscoveries();
  console.log(
    `⏱️  24/7 discovery: up to ${getMaxSystemDiscoveries()} system worker(s), ${getMaxConcurrentDiscoveries()} total slots`,
  );

  scheduleWorkerPump(bootDelayMs());
}

/** Exposed for health/debug. */
export function getContinuousDiscoveryStatus(): { enabled: boolean; activeWorkers: number; maxWorkers: number; systemWorkers: number; maxSystemWorkers: number } {
  return {
    enabled: isContinuousDiscoveryEnabled(),
    activeWorkers: getActiveDiscoveryRunCount(),
    maxWorkers: getMaxConcurrentDiscoveries(),
    systemWorkers: getActiveSystemRunCount(),
    maxSystemWorkers: getMaxSystemDiscoveries(),
  };
}
