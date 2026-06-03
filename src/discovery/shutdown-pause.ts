import { endDiscoveryRun, cancelDiscoveryRun, isDiscoveryRunning } from './run-state.js';
import { hasDiscoverySession, pauseDiscoveryLiveForRestart } from '../database/index.js';

/** On deploy SIGTERM — save discovery progress; do not wipe the client session. */
export function pauseDiscoveryForShutdown(): void {
  if (hasDiscoverySession()) {
    pauseDiscoveryLiveForRestart('Deploy restart — progress saved. Resume from Discovery when the site is back.');
    endDiscoveryRun();
    return;
  }
  if (isDiscoveryRunning()) {
    cancelDiscoveryRun();
    endDiscoveryRun();
  }
}
