import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginDiscoveryRun,
  cancelDiscoveryRun,
  claimUserDiscoverySlot,
  ensureUserDiscoverySlot,
  endDiscoveryRun,
  getActiveDiscoveryRunCount,
  getActiveSystemRunCount,
  getMaxConcurrentDiscoveries,
  preemptOldestSystemRun,
} from '../src/discovery/run-state.js';

describe('discovery run-state slots', () => {
  beforeEach(() => {
    cancelDiscoveryRun();
    process.env.DISCOVERY_MAX_CONCURRENT = '4';
    process.env.DISCOVERY_SYSTEM_MAX = '2';
    process.env.DISCOVERY_USER_SLOTS = '2';
  });

  it('registers user and system runs up to their limits', () => {
    beginDiscoveryRun(undefined, 'system');
    beginDiscoveryRun(undefined, 'system');
    expect(getActiveSystemRunCount()).toBe(2);
    expect(getActiveDiscoveryRunCount()).toBe(2);

    const user = beginDiscoveryRun(undefined, 'user');
    expect(user.runId).toBeTruthy();
    expect(getActiveDiscoveryRunCount()).toBe(3);
    endDiscoveryRun(user.runId);
  });

  it('preempts oldest system worker for user slot', () => {
    const first = beginDiscoveryRun(undefined, 'system');
    beginDiscoveryRun(undefined, 'system');
    beginDiscoveryRun(undefined, 'user');
    beginDiscoveryRun(undefined, 'user');
    expect(getActiveDiscoveryRunCount()).toBe(getMaxConcurrentDiscoveries());

    expect(ensureUserDiscoverySlot()).toBe(true);
    expect(getActiveSystemRunCount()).toBe(1);

    cancelDiscoveryRun(first.runId);
    cancelDiscoveryRun();
  });

  it('claimUserDiscoverySlot registers a user run atomically', () => {
    beginDiscoveryRun(undefined, 'system');
    beginDiscoveryRun(undefined, 'system');
    beginDiscoveryRun(undefined, 'user');
    beginDiscoveryRun(undefined, 'user');
    expect(getActiveDiscoveryRunCount()).toBe(getMaxConcurrentDiscoveries());

    const claimed = claimUserDiscoverySlot();
    expect(claimed).not.toBeNull();
    expect(claimed!.runId).toMatch(/^disc-/);
    expect(getActiveDiscoveryRunCount()).toBe(getMaxConcurrentDiscoveries());

    cancelDiscoveryRun();
  });
});
