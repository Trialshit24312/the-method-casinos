import fs from 'fs';
import path from 'path';

export const LEGACY_RENDER_DATA_DIRS = ['/opt/render/project/src/data'];
export const PREFERRED_RENDER_DATA_DIR = '/var/data';

let cachedDataDir: string | null = null;

/** @internal Vitest only */
export function resetDataDirCacheForTests(): void {
  cachedDataDir = null;
}

function isRenderRuntime(): boolean {
  return Boolean(process.env.RENDER) || process.env.NODE_ENV === 'production';
}

function ephemeralDataDir(): string {
  return path.join(process.cwd(), 'data');
}

/** True if we can create/write under this path (Render free tier cannot use /var/data without a disk). */
export function isWritableDataDir(dir: string): boolean {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolve data directory before opening SQLite (env + optional Render disk). */
export function resolveDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) {
    const resolved = path.resolve(configured);
    if (isWritableDataDir(resolved)) return resolved;
    console.warn(
      `⚠️  DATA_DIR=${resolved} is not writable (no disk?). Using ${ephemeralDataDir()} — remove DATA_DIR on Render free tier and use REMOTE_DB_SYNC + R2.`,
    );
  }

  if (isRenderRuntime()) {
    for (const candidate of [PREFERRED_RENDER_DATA_DIR, ...LEGACY_RENDER_DATA_DIRS]) {
      if (fs.existsSync(candidate) && isWritableDataDir(candidate)) return candidate;
    }
  }

  const local = ephemeralDataDir();
  if (!isWritableDataDir(local)) {
    throw new Error(`Cannot create writable data directory at ${local}`);
  }

  const remoteSync = process.env.REMOTE_DB_SYNC?.trim().toLowerCase();
  if (isRenderRuntime() && (remoteSync === '1' || remoteSync === 'true')) {
    console.log(`📂 Ephemeral SQLite workspace: ${local} (persisted via R2 remote sync)`);
  }

  return local;
}

/** Persistent data directory — set DATA_DIR only when a Render disk is mounted. */
export function getDataDir(): string {
  if (!cachedDataDir) cachedDataDir = resolveDataDir();
  return cachedDataDir;
}

export function getDbPath(): string {
  return path.join(getDataDir(), 'casinos.db');
}

export function getBackupDir(): string {
  return path.join(getDataDir(), 'backups');
}

export function maybeMigrateLegacyDatabase(targetDir: string): void {
  const targetDb = path.join(targetDir, 'casinos.db');
  if (fs.existsSync(targetDb)) return;

  for (const legacyDir of LEGACY_RENDER_DATA_DIRS) {
    if (path.resolve(legacyDir) === path.resolve(targetDir)) continue;
    const legacyDb = path.join(legacyDir, 'casinos.db');
    if (!fs.existsSync(legacyDb)) continue;

    if (!isWritableDataDir(targetDir)) return;

    fs.copyFileSync(legacyDb, targetDb);
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = legacyDb + suffix;
      if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, targetDb + suffix);
    }
    console.log(`📦 Migrated SQLite from ${legacyDir} → ${targetDir}`);
    return;
  }
}
