import path from 'path';

/** Persistent data directory — set DATA_DIR on Render to the mounted disk path. */
export function getDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), 'data');
}

export function getDbPath(): string {
  return path.join(getDataDir(), 'casinos.db');
}

export function getBackupDir(): string {
  return path.join(getDataDir(), 'backups');
}
