import fs from 'fs';
import path from 'path';
import {
  getDataDir,
  getDbPath,
  PREFERRED_RENDER_DATA_DIR,
  LEGACY_RENDER_DATA_DIRS,
} from './data-path.js';

const BOOT_MARKER = '.persistence-boot';

export interface PersistenceStatus {
  dataDir: string;
  dbPath: string;
  dbExists: boolean;
  diskLikelyPersistent: boolean;
  warnings: string[];
}

function isRenderRuntime(): boolean {
  return Boolean(process.env.RENDER) || process.env.NODE_ENV === 'production';
}

function isEphemeralCwdDataDir(dir: string): boolean {
  const cwdData = path.resolve(path.join(process.cwd(), 'data'));
  return path.resolve(dir) === cwdData;
}

function touchBootMarker(dataDir: string): { ok: boolean; boots: number; error?: string } {
  const markerPath = path.join(dataDir, BOOT_MARKER);
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    let boots = 1;
    if (fs.existsSync(markerPath)) {
      const prev = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as { boots?: number };
      boots = (prev.boots ?? 0) + 1;
    }
    fs.writeFileSync(markerPath, JSON.stringify({ boots, lastBoot: new Date().toISOString() }));
    return { ok: true, boots };
  } catch (err) {
    return { ok: false, boots: 0, error: err instanceof Error ? err.message : 'unknown error' };
  }
}

export function assessPersistence(): PersistenceStatus {
  const dataDir = getDataDir();
  const dbPath = getDbPath();
  const warnings: string[] = [];
  const onRender = isRenderRuntime();
  const persistentRoots = [PREFERRED_RENDER_DATA_DIR, ...LEGACY_RENDER_DATA_DIRS];
  const onPersistentRoot = persistentRoots.some((root) => {
    const resolved = path.resolve(dataDir);
    return resolved === path.resolve(root) || resolved.startsWith(path.resolve(root) + path.sep);
  });

  let diskLikelyPersistent = !onRender || onPersistentRoot;
  if (onRender && isEphemeralCwdDataDir(dataDir)) {
    diskLikelyPersistent = false;
    warnings.push(
      'DATA_DIR is unset and the database is under ./data (ephemeral on Render). Attach a persistent disk and set DATA_DIR to its mount path (e.g. /var/data).',
    );
  }
  if (onRender && !onPersistentRoot && !process.env.DATA_DIR?.trim()) {
    warnings.push(
      `DATA_DIR not set; using ${dataDir}. Confirm this path is your Render disk mount.`,
    );
  }

  const markerPath = path.join(dataDir, BOOT_MARKER);
  const markerExists = fs.existsSync(markerPath);
  if (!markerExists && onRender) {
    warnings.push('No boot marker on disk yet — first deploy or DATA_DIR may not point at the persistent volume.');
  }
  if (onRender && markerExists && !fs.existsSync(dbPath)) {
    warnings.push('Boot marker exists but casinos.db is missing — disk may have been wiped or DATA_DIR changed.');
  }

  return {
    dataDir,
    dbPath,
    dbExists: fs.existsSync(dbPath),
    diskLikelyPersistent,
    warnings,
  };
}

export function logPersistenceStatus(): PersistenceStatus {
  const dataDir = getDataDir();
  const marker = touchBootMarker(dataDir);
  const status = assessPersistence();
  if (!marker.ok) {
    status.warnings.push(`Cannot write boot marker in ${dataDir}: ${marker.error}`);
    status.diskLikelyPersistent = false;
  } else if (marker.boots > 1) {
    console.log(`💾 Disk boot #${marker.boots} (data surviving restarts)`);
  }
  if (status.diskLikelyPersistent) {
    console.log(`💾 Persistent data directory: ${status.dataDir}`);
  } else {
    console.warn(`⚠️  Data may NOT survive Render restarts (directory: ${status.dataDir})`);
  }
  for (const w of status.warnings) console.warn(`⚠️  ${w}`);
  return status;
}
