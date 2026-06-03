import fs from 'fs';
import path from 'path';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getDataDir, getDbPath } from './data-path.js';

const DEFAULT_OBJECT_KEY = 'casinos.db';

export function isRemoteDbSyncEnabled(): boolean {
  const flag = process.env.REMOTE_DB_SYNC?.trim().toLowerCase();
  if (flag !== '1' && flag !== 'true') return false;
  return Boolean(
    process.env.S3_BUCKET?.trim()
    && process.env.S3_ACCESS_KEY_ID?.trim()
    && process.env.S3_SECRET_ACCESS_KEY?.trim()
    && process.env.S3_ENDPOINT?.trim(),
  );
}

function getObjectKey(): string {
  return process.env.S3_OBJECT_KEY?.trim() || DEFAULT_OBJECT_KEY;
}

function createS3Client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION?.trim() || 'auto',
    endpoint: process.env.S3_ENDPOINT!.trim(),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== '0',
  });
}

async function remoteObjectExists(client: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Download SQLite from S3-compatible storage before opening the DB (Render free tier). */
export async function restoreRemoteDatabaseIfConfigured(): Promise<boolean> {
  if (!isRemoteDbSyncEnabled()) return false;

  const bucket = process.env.S3_BUCKET!.trim();
  const key = getObjectKey();
  const client = createS3Client();
  const dataDir = getDataDir();
  const dbPath = getDbPath();
  const tmpPath = `${dbPath}.restore`;

  if (!(await remoteObjectExists(client, bucket, key))) {
    console.log(`☁️  Remote DB: no object s3://${bucket}/${key} yet (starting fresh)`);
    return false;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = response.Body;
  if (!body) throw new Error('Empty remote database object');

  const bytes = await body.transformToByteArray();
  fs.writeFileSync(tmpPath, Buffer.from(bytes));
  fs.renameSync(tmpPath, dbPath);
  for (const suffix of ['-wal', '-shm']) {
    const side = dbPath + suffix;
    if (fs.existsSync(side)) fs.unlinkSync(side);
  }

  console.log(`☁️  Restored database from s3://${bucket}/${key} (${bytes.length} bytes)`);
  return true;
}

/** Upload SQLite after WAL checkpoint (call while DB is open or right after checkpoint). */
export async function uploadRemoteDatabase(): Promise<void> {
  if (!isRemoteDbSyncEnabled()) return;

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return;

  const bucket = process.env.S3_BUCKET!.trim();
  const key = getObjectKey();
  const client = createS3Client();
  const body = fs.readFileSync(dbPath);

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/x-sqlite3',
  }));

  console.log(`☁️  Uploaded database to s3://${bucket}/${key} (${body.length} bytes)`);
}

export function scheduleRemoteDbSync(): void {
  if (!isRemoteDbSyncEnabled()) return;

  const minutes = parseFloat(process.env.REMOTE_DB_SYNC_INTERVAL_MINUTES ?? '15');
  const ms = (Number.isFinite(minutes) && minutes > 0 ? minutes : 15) * 60 * 1000;

  const run = async () => {
    try {
      const { getDatabase } = await import('../database/index.js');
      getDatabase().pragma('wal_checkpoint(TRUNCATE)');
      await uploadRemoteDatabase();
    } catch (err) {
      console.warn('Remote DB sync failed:', err instanceof Error ? err.message : err);
    }
  };

  console.log(`⏱️  Remote DB sync every ${minutes}m (S3-compatible storage)`);
  setInterval(() => void run(), ms);
}
