let activeAbort: AbortController | null = null;
let running = false;

export function beginDiscoveryRun(): AbortSignal {
  activeAbort?.abort();
  activeAbort = new AbortController();
  running = true;
  return activeAbort.signal;
}

export function cancelDiscoveryRun(): boolean {
  if (!running || !activeAbort) return false;
  activeAbort.abort();
  return true;
}

export function endDiscoveryRun(): void {
  running = false;
  activeAbort = null;
}

export function isDiscoveryRunning(): boolean {
  return running;
}

export function getDiscoveryAbortSignal(): AbortSignal | undefined {
  return activeAbort?.signal;
}

export function throwIfCancelled(): void {
  if (activeAbort?.signal.aborted) {
    throw new Error('Discovery cancelled');
  }
}
