import { hasDiscoverySession } from '../database/index.js';
import { runDiscovery } from './engine.js';
import { isDiscoveryRunning } from './run-state.js';
import { beginDiscoveryLive, isDiscoveryLiveActive, pushDiscoveryLiveEvent } from './live-state.js';

let loopStarted = false;
let runInFlight = false;

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

function discoveryBusy(): boolean {
  return isDiscoveryRunning() || isDiscoveryLiveActive() || hasDiscoverySession();
}

async function runDeepCycle(): Promise<void> {
  if (runInFlight || discoveryBusy()) return;
  runInFlight = true;

  console.log('🔍 24/7 deep discovery cycle starting…');
  beginDiscoveryLive('deep');

  try {
    const result = await runDiscovery(true, pushDiscoveryLiveEvent);
    console.log(
      `🔍 24/7 cycle done: +${result.added} queued, ${result.rejected} rejected, ${result.scanned} scanned`,
    );
  } catch (err) {
    console.warn('24/7 discovery cycle failed:', err instanceof Error ? err.message : err);
  } finally {
    runInFlight = false;
    scheduleNextCycle(cooldownMs());
  }
}

function scheduleNextCycle(delayMs: number): void {
  setTimeout(() => {
    if (!isContinuousDiscoveryEnabled()) return;
    if (discoveryBusy()) {
      scheduleNextCycle(60_000);
      return;
    }
    void runDeepCycle();
  }, delayMs);
}

export function startContinuousDiscovery(): void {
  if (!isContinuousDiscoveryEnabled()) return;
  if (loopStarted) return;
  loopStarted = true;

  console.log('⏱️  24/7 deep discovery loop enabled (server-side, no browser tab required)');

  scheduleNextCycle(bootDelayMs());
}
