import type { DiscoveryProgressEvent, DiscoveryResult, DiscoveryLiveSnapshot } from '../shared/types.js';
import {
  appendDiscoveryLiveEventStorage,
  finishDiscoveryLiveStorage,
  getDiscoveryLiveStorage,
  isDiscoveryLiveRunningStorage,
  resetDiscoveryLiveStorage,
  updateDiscoveryLiveStorage,
} from '../database/index.js';

export type { DiscoveryLiveSnapshot };

export function isDiscoveryLiveActive(): boolean {
  return isDiscoveryLiveRunningStorage();
}

export function beginDiscoveryLive(mode: 'quick' | 'deep'): void {
  resetDiscoveryLiveStorage(mode);
}

export function pushDiscoveryLiveEvent(event: DiscoveryProgressEvent): void {
  if (event.type === 'heartbeat') return;

  if (event.type === 'progress') {
    updateDiscoveryLiveStorage({ stats: event.stats });
    return;
  }
  if (event.type === 'phase') {
    updateDiscoveryLiveStorage({ phaseLabel: event.label });
  }
  if (event.type === 'complete') {
    finishDiscoveryLiveStorage(event.result);
    return;
  }

  appendDiscoveryLiveEventStorage(event);
}

export function finishDiscoveryLive(result: DiscoveryResult): void {
  finishDiscoveryLiveStorage(result);
}

export function getDiscoveryLiveSnapshot(sinceSeq = 0): DiscoveryLiveSnapshot {
  return getDiscoveryLiveStorage(sinceSeq);
}
