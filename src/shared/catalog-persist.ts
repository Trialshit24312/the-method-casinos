/**
 * Hard-wired catalog durability — every casino write checkpoints SQLite,
 * copies a local backup, then uploads to R2 when configured.
 */
import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { getDataDir, getDbPath, getBackupDir } from './data-path.js';
function isRemoteDbSyncEnabled(): boolean {
  const flag = process.env.REMOTE_DB_SYNC?.trim().toLowerCase();
  if (flag !== '1' && flag !== 'true') return false;
  return Boolean(
    process.env.S3_BUCKET?.trim()
    && process.env.S3_ACCESS_KEY_ID?.trim()
    && process.env.S3_SECRET_ACCESS_KEY?.trim()
    && process.env.S3_ENDPOINT?.trim(),
  );
}

let getDb: (() => Database.Database) | null = null;

export function registerCatalogDatabase(accessor: () => Database.Database): void {
  getDb = accessor;
}

function requireDb(): Database.Database {
  if (!getDb) throw new Error('Database not initialized');
  return getDb();
}

/** Merge WAL into main casinos.db file (required before copy/upload). */
export function flushSqliteToDisk(): void {
  requireDb().pragma('wal_checkpoint(TRUNCATE)');
}

const LATEST_BACKUP_NAME = 'casinos.latest.db';

export function getLatestLocalBackupPath(): string {
  return path.join(getDataDir(), LATEST_BACKUP_NAME);
}

/** Always write a restorable copy beside the live DB. */
export function writeLocalDbBackup(): string {
  const dbPath = getDbPath();
  flushSqliteToDisk();
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Cannot backup — missing ${dbPath}`);
  }

  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  const latestPath = getLatestLocalBackupPath();
  fs.copyFileSync(dbPath, latestPath);

  const backupDir = getBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });
  const stamped = path.join(backupDir, `casinos-${Date.now()}.db`);
  fs.copyFileSync(dbPath, stamped);

  const files = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith('casinos-') && f.endsWith('.db'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const old of files.slice(8)) {
    try {
      fs.unlinkSync(path.join(backupDir, old.name));
    } catch {
      /* ignore */
    }
  }

  return latestPath;
}

/** Restore from local latest backup when main DB is missing (R2 not configured / failed). */
export function restoreLatestLocalBackupIfNeeded(): boolean {
  const dbPath = getDbPath();
  const latestPath = getLatestLocalBackupPath();
  if (fs.existsSync(dbPath)) return false;
  if (!fs.existsSync(latestPath)) return false;

  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.copyFileSync(latestPath, dbPath);
  console.log(`📦 Restored SQLite from local backup ${latestPath}`);
  return true;
}

let persistChain: Promise<void> = Promise.resolve();

/**
 * Mandatory persist after catalog mutations — never optional on Render.
 * Serialized so concurrent uploads do not skip each other.
 */
export function commitCatalogWrite(reason: string): void {
  if (!getDb) return;
  persistChain = persistChain.then(async () => {
    try {
      writeLocalDbBackup();
      if (isRemoteDbSyncEnabled()) {
        const { uploadRemoteDatabase } = await import('./remote-db-sync.js');
        await uploadRemoteDatabase();
        console.log(`💾 Catalog persisted (${reason}) → R2 + local backup`);
      } else if (process.env.RENDER) {
        console.warn(
          `💾 Catalog saved locally only (${reason}) — configure REMOTE_DB_SYNC + S3_* or data is lost on redeploy`,
        );
      }
    } catch (err) {
      console.error(`💾 commitCatalogWrite failed (${reason}):`, err instanceof Error ? err.message : err);
    }
  });
}

/** Block API handlers until the write chain finishes (approve, manual add). */
export async function commitCatalogWriteAndWait(reason: string): Promise<void> {
  commitCatalogWrite(reason);
  await persistChain;
}
