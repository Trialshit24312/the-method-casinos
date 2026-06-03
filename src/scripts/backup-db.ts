import fs from 'fs';
import path from 'path';
import { getBackupDir, getDbPath } from '../shared/data-path.js';

const DB_PATH = getDbPath();
const BACKUP_DIR = getBackupDir();

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function main(): void {
  if (!fs.existsSync(DB_PATH)) {
    console.error('No database found at', DB_PATH);
    process.exit(1);
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const dest = path.join(BACKUP_DIR, `casinos-${timestamp()}.db`);
  fs.copyFileSync(DB_PATH, dest);

  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse();

  const keep = 10;
  for (const old of files.slice(keep)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old));
  }

  console.log(`✅ Backup saved: ${dest}`);
  console.log(`   Keeping ${Math.min(files.length, keep)} most recent backup(s)`);
}

main();
