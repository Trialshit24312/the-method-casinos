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

/** Resolve data directory before opening SQLite (env + Render disk auto-detect). */
export function resolveDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) return path.resolve(configured);

  if (isRenderRuntime()) {
    for (const candidate of [PREFERRED_RENDER_DATA_DIR, ...LEGACY_RENDER_DATA_DIRS]) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return PREFERRED_RENDER_DATA_DIR;
  }

  return path.join(process.cwd(), 'data');
}

/** Persistent data directory — set DATA_DIR on Render to the mounted disk path. */
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

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(legacyDb, targetDb);
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = legacyDb + suffix;
      if (fs.existsSync(sidecar)) fs.copyFileSync(sidecar, targetDb + suffix);
    }
    console.log(`📦 Migrated SQLite from ${legacyDir} → ${targetDir}`);
    return;
  }
}
