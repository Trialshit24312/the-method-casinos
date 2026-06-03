import fs from 'fs';
import path from 'path';
import { isDiscoveryRunning } from '../discovery/run-state.js';
import { isDiscoveryLiveActive } from '../discovery/live-state.js';
import { runDiscovery } from '../discovery/engine.js';
import { startContinuousDiscovery, isContinuousDiscoveryEnabled } from '../discovery/continuous.js';
import { runRevalidationBatch } from '../discovery/revalidate.js';
import { getBackupDir, getDbPath } from '../shared/data-path.js';
import { initDiscordLiveFeed } from './discord-live-feed.js';
import { isRemoteDbSyncEnabled, scheduleRemoteDbSync } from './remote-db-sync.js';

const DB_PATH = getDbPath();
const BACKUP_DIR = getBackupDir();

function runDbBackup(): void {
  try {
    if (!fs.existsSync(DB_PATH)) return;
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(BACKUP_DIR, `casinos-${stamp}.db`);
    fs.copyFileSync(DB_PATH, dest);
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort().reverse();
    for (const old of files.slice(10)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }
    console.log(`💾 DB backup: ${path.basename(dest)}`);
  } catch (err) {
    console.warn('DB backup failed:', err instanceof Error ? err.message : err);
  }
}

export function scheduleBackgroundJobs(): void {
  initDiscordLiveFeed();

  const revalidateHours = parseFloat(process.env.REVALIDATE_INTERVAL_HOURS ?? '');
  if (Number.isFinite(revalidateHours) && revalidateHours > 0) {
    const ms = revalidateHours * 60 * 60 * 1000;
    const limit = Math.min(25, parseInt(process.env.REVALIDATE_BATCH_SIZE ?? '8', 10) || 8);
    setInterval(() => {
      void runRevalidationBatch(limit).then((r) => {
        if (r.checked > 0) {
          console.log(`🔄 Revalidated ${r.passed}/${r.checked} stale catalog entries`);
        }
      }).catch((err) => console.warn('Revalidation job failed:', err));
    }, ms);
    console.log(`⏱️  Catalog revalidation every ${revalidateHours}h (batch ${limit})`);
  }

  startContinuousDiscovery();

  const discoveryHours = parseFloat(process.env.DISCOVERY_SCHEDULE_HOURS ?? '');
  if (!isContinuousDiscoveryEnabled() && Number.isFinite(discoveryHours) && discoveryHours > 0) {
    const ms = discoveryHours * 60 * 60 * 1000;
    const deep = process.env.DISCOVERY_SCHEDULE_DEEP === 'true';
    setInterval(() => {
      if (isDiscoveryRunning() || isDiscoveryLiveActive()) return;
      console.log(`🔍 Scheduled ${deep ? 'deep' : 'quick'} discovery starting…`);
      void runDiscovery(deep).then((r) => {
        console.log(`🔍 Scheduled discovery done: +${r.added} queued, ${r.rejected} rejected`);
      }).catch((err) => console.warn('Scheduled discovery failed:', err));
    }, ms);
    console.log(`⏱️  Discovery scheduled every ${discoveryHours}h (${deep ? 'deep' : 'quick'})`);
  }

  scheduleRemoteDbSync();

  const backupHours = parseFloat(process.env.DB_BACKUP_INTERVAL_HOURS ?? '24');
  if (!isRemoteDbSyncEnabled() && Number.isFinite(backupHours) && backupHours > 0) {
    runDbBackup();
    setInterval(runDbBackup, backupHours * 60 * 60 * 1000);
    console.log(`⏱️  DB backup every ${backupHours}h`);
  }
}
