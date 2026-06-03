import type { DiscoveryLiveStats, DiscoveryProgressEvent, DiscoveryResult } from '../shared/types.js';

const MAX_EVENTS = 400;

interface StoredEvent {
  seq: number;
  event: DiscoveryProgressEvent;
}

export interface DiscoveryLiveSnapshot {
  running: boolean;
  mode: 'quick' | 'deep' | null;
  startedAt: number | null;
  phaseLabel: string;
  stats: DiscoveryLiveStats | null;
  events: Array<DiscoveryProgressEvent & { seq: number }>;
  lastSeq: number;
  result: DiscoveryResult | null;
}

const emptyStats = (): DiscoveryLiveStats => ({
  scanned: 0,
  queued: 0,
  added: 0,
  rejected: 0,
  skipped: 0,
  blocked: 0,
  sourcesChecked: 0,
  phase: 'curated',
  queryIndex: 0,
  queryTotal: 0,
});

let live: DiscoveryLiveSnapshot = {
  running: false,
  mode: null,
  startedAt: null,
  phaseLabel: '',
  stats: null,
  events: [],
  lastSeq: -1,
  result: null,
};

let eventBuffer: StoredEvent[] = [];
let nextSeq = 0;

function resetLiveBuffer(): void {
  eventBuffer = [];
  nextSeq = 0;
}

export function isDiscoveryLiveActive(): boolean {
  return live.running;
}

export function beginDiscoveryLive(mode: 'quick' | 'deep'): void {
  resetLiveBuffer();
  live = {
    running: true,
    mode,
    startedAt: Date.now(),
    phaseLabel: 'Starting…',
    stats: emptyStats(),
    events: [],
    lastSeq: -1,
    result: null,
  };
}

export function pushDiscoveryLiveEvent(event: DiscoveryProgressEvent): void {
  if (event.type === 'heartbeat') return;

  if (event.type === 'progress') {
    live.stats = event.stats;
    return;
  }
  if (event.type === 'phase') {
    live.phaseLabel = event.label;
  }
  if (event.type === 'complete') {
    live.result = event.result;
    live.running = false;
    live.lastSeq = nextSeq > 0 ? nextSeq - 1 : -1;
    return;
  }

  const stored: StoredEvent = { seq: nextSeq++, event };
  eventBuffer.push(stored);
  if (eventBuffer.length > MAX_EVENTS) eventBuffer.shift();
  live.lastSeq = stored.seq;
}

export function finishDiscoveryLive(result: DiscoveryResult): void {
  live.result = result;
  live.running = false;
}

export function getDiscoveryLiveSnapshot(sinceSeq = 0): DiscoveryLiveSnapshot {
  const events = eventBuffer
    .filter((e) => e.seq >= sinceSeq)
    .map(({ seq, event }) => ({ seq, ...event }));

  return {
    running: live.running,
    mode: live.mode,
    startedAt: live.startedAt,
    phaseLabel: live.phaseLabel,
    stats: live.stats,
    events,
    lastSeq: live.lastSeq,
    result: live.result,
  };
}
